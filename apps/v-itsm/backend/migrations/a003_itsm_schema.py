"""a003: v-itsm Phase 1 핵심 스키마.

설계 문서 `docusaurus/docs/apps/v-itsm/design/V_ITSM_DESIGN.md` §4.1 기준.

생성 테이블 (모두 `itsm_` 접두사 — MULTI_APP_DATA_ISOLATION 준수):
  - itsm_ticket
  - itsm_loop_transition
  - itsm_sla_policy
  - itsm_sla_timer
  - itsm_assignment
  - itsm_feedback
  - itsm_ai_suggestion
  - itsm_kpi_snapshot
  - itsm_ticket_no_seq (티켓 번호 시퀀스)

멱등: IF NOT EXISTS 사용. 여러 번 실행해도 안전.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


STATEMENTS: list[str] = [
    # -------- 시퀀스 (사람이 읽는 ticket_no 발급용) --------
    """
    CREATE SEQUENCE IF NOT EXISTS itsm_ticket_no_seq
        START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1
    """,
    # -------- 4.1.3 SLA 정책 (ticket 이 FK 참조하므로 먼저 생성) --------
    """
    CREATE TABLE IF NOT EXISTS itsm_sla_policy (
        id                  VARCHAR(26) PRIMARY KEY,
        name                VARCHAR(100) NOT NULL,
        priority            VARCHAR(20)  NOT NULL,
        category            VARCHAR(100),
        response_minutes    INTEGER      NOT NULL,
        resolution_minutes  INTEGER      NOT NULL,
        business_hours      JSONB,
        active              BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_itsm_sla_policy_priority_cat UNIQUE (priority, category)
    )
    """,
    # -------- 4.1.1 Ticket --------
    """
    CREATE TABLE IF NOT EXISTS itsm_ticket (
        id                VARCHAR(26) PRIMARY KEY,
        ticket_no         VARCHAR(32)  NOT NULL UNIQUE,
        title             VARCHAR(200) NOT NULL,
        description       TEXT,
        source_channel    VARCHAR(20)  NOT NULL,
        source_ref        VARCHAR(200),
        priority          VARCHAR(20)  NOT NULL DEFAULT 'normal',
        category_l1       VARCHAR(100),
        category_l2       VARCHAR(100),
        current_stage     VARCHAR(20)  NOT NULL DEFAULT 'intake',
        requester_id      INTEGER      REFERENCES users(id),
        current_owner_id  INTEGER      REFERENCES users(id),
        sla_policy_id     VARCHAR(26)  REFERENCES itsm_sla_policy(id),
        opened_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        closed_at         TIMESTAMPTZ,
        reopened_count    INTEGER      NOT NULL DEFAULT 0,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_itsm_ticket_stage ON itsm_ticket(current_stage)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_ticket_priority ON itsm_ticket(priority)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_ticket_owner ON itsm_ticket(current_owner_id)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_ticket_opened_at ON itsm_ticket(opened_at)",
    # -------- 4.1.2 Loop Transition --------
    """
    CREATE TABLE IF NOT EXISTS itsm_loop_transition (
        id               VARCHAR(26) PRIMARY KEY,
        ticket_id        VARCHAR(26)  NOT NULL
                         REFERENCES itsm_ticket(id) ON DELETE CASCADE,
        from_stage       VARCHAR(20),
        to_stage         VARCHAR(20)  NOT NULL,
        action           VARCHAR(20)  NOT NULL,
        actor_id         INTEGER      REFERENCES users(id),
        note             TEXT,
        artifacts        JSONB,
        transitioned_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_itsm_loop_transition_ticket
        ON itsm_loop_transition(ticket_id, transitioned_at)
    """,
    # -------- 4.1.3 SLA Timer --------
    """
    CREATE TABLE IF NOT EXISTS itsm_sla_timer (
        id               VARCHAR(26) PRIMARY KEY,
        ticket_id        VARCHAR(26)  NOT NULL
                         REFERENCES itsm_ticket(id) ON DELETE CASCADE,
        kind             VARCHAR(20)  NOT NULL,
        due_at           TIMESTAMPTZ  NOT NULL,
        warning_sent_at  TIMESTAMPTZ,
        breached_at      TIMESTAMPTZ,
        satisfied_at     TIMESTAMPTZ,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_itsm_sla_timer_ticket_kind UNIQUE (ticket_id, kind)
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_itsm_sla_timer_due ON itsm_sla_timer(due_at)",
    # -------- 4.1.4 Assignment --------
    """
    CREATE TABLE IF NOT EXISTS itsm_assignment (
        id           VARCHAR(26) PRIMARY KEY,
        ticket_id    VARCHAR(26)  NOT NULL
                     REFERENCES itsm_ticket(id) ON DELETE CASCADE,
        owner_id     INTEGER      NOT NULL REFERENCES users(id),
        role         VARCHAR(20)  NOT NULL DEFAULT 'primary',
        assigned_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        released_at  TIMESTAMPTZ
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_itsm_assignment_ticket
        ON itsm_assignment(ticket_id, assigned_at)
    """,
    "CREATE INDEX IF NOT EXISTS ix_itsm_assignment_owner ON itsm_assignment(owner_id)",
    # -------- 4.1.5 Feedback --------
    """
    CREATE TABLE IF NOT EXISTS itsm_feedback (
        id            VARCHAR(26) PRIMARY KEY,
        ticket_id     VARCHAR(26)  NOT NULL
                      REFERENCES itsm_ticket(id) ON DELETE CASCADE,
        score         INTEGER,
        comment       TEXT,
        reopen        BOOLEAN      NOT NULL DEFAULT FALSE,
        submitted_by  INTEGER      REFERENCES users(id),
        submitted_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_itsm_feedback_ticket ON itsm_feedback(ticket_id)",
    # -------- 4.1.6 AI Suggestion --------
    """
    CREATE TABLE IF NOT EXISTS itsm_ai_suggestion (
        id          VARCHAR(26) PRIMARY KEY,
        ticket_id   VARCHAR(26)  NOT NULL
                    REFERENCES itsm_ticket(id) ON DELETE CASCADE,
        kind        VARCHAR(30)  NOT NULL,
        prompt_ref  VARCHAR(100),
        result      JSONB        NOT NULL,
        accepted    BOOLEAN,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_itsm_ai_suggestion_ticket
        ON itsm_ai_suggestion(ticket_id, created_at)
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_itsm_ai_suggestion_kind
        ON itsm_ai_suggestion(kind)
    """,
    # -------- 4.1.7 KPI Snapshot --------
    """
    CREATE TABLE IF NOT EXISTS itsm_kpi_snapshot (
        id                 VARCHAR(26) PRIMARY KEY,
        period_start       DATE         NOT NULL,
        period_end         DATE         NOT NULL,
        dept_id            INTEGER      REFERENCES departments(id),
        sla_met_ratio      NUMERIC(5,2),
        mttr_minutes       INTEGER,
        reopen_ratio       NUMERIC(5,2),
        volume             INTEGER      NOT NULL DEFAULT 0,
        ai_adoption_ratio  NUMERIC(5,2),
        created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_itsm_kpi_period_dept UNIQUE (period_start, period_end, dept_id)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_itsm_kpi_period
        ON itsm_kpi_snapshot(period_start, period_end)
    """,
]


def migrate(engine):
    with engine.connect() as conn:
        for stmt in STATEMENTS:
            conn.execute(text(stmt))
        conn.commit()
    logger.info("a003: itsm schema (tables + indexes + seq) applied")
