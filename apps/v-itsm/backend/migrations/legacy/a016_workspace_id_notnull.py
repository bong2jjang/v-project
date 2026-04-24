"""a016: workspace_id NOT NULL 승격 + 복합 인덱스 + FK ON DELETE RESTRICT.

설계 문서: docusaurus/docs/apps/v-itsm/design/WORKSPACE_DESIGN.md §6.1 3단계

전제 조건: a015 에서 모든 행의 workspace_id 가 백필된 상태.

처리 내용:
  1. 19개 테이블 workspace_id → NOT NULL
  2. FK 재생성: ON DELETE RESTRICT (WS 삭제 시 이관 필수 강제)
  3. 복합 인덱스: (workspace_id, created_at DESC), (workspace_id, status) 등

멱등: IF NOT EXISTS 사용 (NOT NULL 승격은 이미 NOT NULL 이면 무해).
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

TABLES_WITH_WS: list[str] = [
    "itsm_ticket",
    "itsm_sla_policy",
    "itsm_sla_tier",
    "itsm_sla_timer",
    "itsm_sla_notification_policy",
    "itsm_assignment",
    "itsm_kpi_snapshot",
    "itsm_notification_log",
    "itsm_loop_transition",
    "itsm_loop_transition_revision",
    "itsm_customer",
    "itsm_contract",
    "itsm_product",
    "itsm_feedback",
    "itsm_ai_suggestion",
    "itsm_user_notification_pref",
    "itsm_integration_settings",
    "itsm_scheduler_override",
    "itsm_scope_grant",
]

# (테이블, 인덱스명_suffix, 컬럼 목록) — 복합 인덱스
COMPOSITE_INDEXES: list[tuple[str, str, str]] = [
    ("itsm_ticket",             "ws_created",  "workspace_id, created_at DESC"),
    ("itsm_ticket",             "ws_stage",    "workspace_id, current_stage"),
    ("itsm_ticket",             "ws_customer", "workspace_id, customer_id"),
    ("itsm_assignment",         "ws_assigned", "workspace_id, assigned_at DESC"),
    ("itsm_sla_policy",         "ws_active",   "workspace_id, active"),
    ("itsm_sla_timer",          "ws_created",  "workspace_id, created_at DESC"),
    ("itsm_kpi_snapshot",       "ws_created",  "workspace_id, created_at DESC"),
    ("itsm_notification_log",   "ws_created",  "workspace_id, created_at DESC"),
    ("itsm_loop_transition",    "ws_transitioned", "workspace_id, transitioned_at DESC"),
    ("itsm_customer",           "ws_created",  "workspace_id, created_at DESC"),
    ("itsm_scope_grant",        "ws_group",    "workspace_id, permission_group_id"),
]


def _notnull_stmts() -> list[str]:
    return [
        f"ALTER TABLE {t} ALTER COLUMN workspace_id SET NOT NULL"
        for t in TABLES_WITH_WS
    ]


def _fk_restrict_stmts() -> list[str]:
    """기존 FK 를 RESTRICT 버전으로 교체. 이름 중복 시 ADD 가 실패하므로 DO $$ 가드 사용."""
    stmts = []
    for table in TABLES_WITH_WS:
        fk_name = f"fk_{table}_workspace"
        stmts += [
            f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {fk_name}",
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = '{fk_name}'
                ) THEN
                    ALTER TABLE {table}
                        ADD CONSTRAINT {fk_name}
                        FOREIGN KEY (workspace_id)
                        REFERENCES itsm_workspaces(id)
                        ON DELETE RESTRICT;
                END IF;
            END$$
            """,
        ]
    return stmts


def _index_stmts() -> list[str]:
    stmts = []
    for table, suffix, cols in COMPOSITE_INDEXES:
        idx = f"ix_{table}_{suffix}"
        stmts.append(f"CREATE INDEX IF NOT EXISTS {idx} ON {table} ({cols})")
    return stmts


def migrate(engine) -> None:
    """Platform 공통 러너(_run_migrations)가 호출하는 진입점."""
    with engine.connect() as conn:
        for stmt in _notnull_stmts():
            conn.execute(text(stmt))
        for stmt in _fk_restrict_stmts():
            conn.execute(text(stmt))
        for stmt in _index_stmts():
            conn.execute(text(stmt))
        conn.commit()
    logger.info("a016_workspace_id_notnull: NOT NULL + FK RESTRICT + 복합 인덱스 완료")


def upgrade(db) -> None:
    for stmt in _notnull_stmts():
        db.execute(text(stmt))
    logger.info("a016: workspace_id NOT NULL 승격 완료")

    for stmt in _fk_restrict_stmts():
        db.execute(text(stmt))
    logger.info("a016: FK ON DELETE RESTRICT 설정 완료")

    for stmt in _index_stmts():
        db.execute(text(stmt))
    logger.info("a016: 복합 인덱스 생성 완료")

    db.commit()
    logger.info("a016_workspace_id_notnull: 완료")


def downgrade(db) -> None:
    # 인덱스 제거
    for table, suffix, _ in COMPOSITE_INDEXES:
        idx = f"ix_{table}_{suffix}"
        db.execute(text(f"DROP INDEX IF EXISTS {idx}"))

    # FK 제거 + NULLABLE 복원
    for table in TABLES_WITH_WS:
        fk_name = f"fk_{table}_workspace"
        db.execute(text(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {fk_name}"))
        db.execute(text(f"ALTER TABLE {table} ALTER COLUMN workspace_id DROP NOT NULL"))

    db.commit()
    logger.info("a016_workspace_id_notnull: 롤백 완료")
