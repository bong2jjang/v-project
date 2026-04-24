"""a014: 워크스페이스 테이블 신설 + Default WS seed.

설계 문서: docusaurus/docs/apps/v-itsm/design/WORKSPACE_DESIGN.md §6.1 1단계

생성 테이블:
  - itsm_workspaces       — 워크스페이스 정보
  - itsm_workspace_members — 워크스페이스 멤버십 + 역할

멱등: IF NOT EXISTS + ON CONFLICT DO NOTHING 사용.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

WORKSPACE_DEFAULT_ID = "01JDEFAULTWORKSPACE0000000"

STATEMENTS: list[str] = [
    # ── 워크스페이스 ────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS itsm_workspaces (
        id           VARCHAR(26)  PRIMARY KEY,
        name         VARCHAR(100) NOT NULL,
        slug         VARCHAR(100) NOT NULL UNIQUE,
        description  TEXT,
        icon_url     TEXT,
        settings     JSONB        NOT NULL DEFAULT '{}',
        is_default   BOOLEAN      NOT NULL DEFAULT FALSE,
        created_by   INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        archived_at  TIMESTAMPTZ
    )
    """,
    # ── 워크스페이스 멤버십 ─────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS itsm_workspace_members (
        id           VARCHAR(26)  PRIMARY KEY,
        workspace_id VARCHAR(26)  NOT NULL REFERENCES itsm_workspaces(id) ON DELETE CASCADE,
        user_id      INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role         VARCHAR(20)  NOT NULL DEFAULT 'ws_member',
        is_default   BOOLEAN      NOT NULL DEFAULT FALSE,
        joined_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_itsm_ws_member UNIQUE (workspace_id, user_id),
        CONSTRAINT chk_itsm_ws_member_role CHECK (role IN ('ws_admin', 'ws_member', 'ws_viewer'))
    )
    """,
    # ── 유저당 기본 WS 는 1개만 허용 (부분 유니크 인덱스) ─────────────
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_itsm_ws_member_user_default
        ON itsm_workspace_members (user_id)
        WHERE is_default = TRUE
    """,
    # ── 조회 인덱스 ────────────────────────────────────────────────
    "CREATE INDEX IF NOT EXISTS ix_itsm_workspaces_slug ON itsm_workspaces (slug)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_ws_members_user ON itsm_workspace_members (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_ws_members_ws   ON itsm_workspace_members (workspace_id)",
    # ── Default 워크스페이스 seed ───────────────────────────────────
    f"""
    INSERT INTO itsm_workspaces (id, name, slug, description, settings, is_default, created_at)
    VALUES (
        '{WORKSPACE_DEFAULT_ID}',
        '전사 공통',
        'default',
        '모든 사용자의 기본 워크스페이스',
        '{{}}'::jsonb,
        TRUE,
        NOW()
    )
    ON CONFLICT (id) DO NOTHING
    """,
]


def migrate(engine) -> None:
    with engine.connect() as conn:
        for stmt in STATEMENTS:
            conn.execute(text(stmt))
        conn.commit()
    logger.info("a014_workspaces: itsm_workspaces / itsm_workspace_members + Default WS seed 완료")


def upgrade(db) -> None:
    for stmt in STATEMENTS:
        db.execute(text(stmt))
    db.commit()


def downgrade(db) -> None:
    db.execute(text("DROP TABLE IF EXISTS itsm_workspace_members"))
    db.execute(text("DROP TABLE IF EXISTS itsm_workspaces"))
    db.commit()
    logger.info("a014_workspaces: 롤백 완료")
