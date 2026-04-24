"""a015: 기존 19개 테이블에 workspace_id(NULLABLE) 추가 + Default WS 백필 + 멤버 seed.

설계 문서: docusaurus/docs/apps/v-itsm/design/WORKSPACE_DESIGN.md §6.1 2단계

처리 내용:
  1. 19개 테이블에 workspace_id VARCHAR(26) NULL 컬럼 추가
  2. 기존 전체 행을 Default WS 로 백필
  3. 기존 사용자 전원을 Default WS 멤버로 등록 (이미 등록된 경우 건너뜀)
  4. ScopeGrant UniqueConstraint 에 workspace_id 포함 (기존 제약 교체)
  5. UserNotificationPref 의 유저 단독 unique → (user_id, workspace_id) 복합 unique 교체

멱등: IF NOT EXISTS / IF EXISTS / ON CONFLICT DO NOTHING 사용.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

DEFAULT_WS_ID = "01JDEFAULTWORKSPACE0000000"

# workspace_id 컬럼을 추가할 테이블 목록
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


def _add_workspace_id_stmts() -> list[str]:
    stmts = []
    for table in TABLES_WITH_WS:
        stmts.append(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS "
            f"workspace_id VARCHAR(26) NULL REFERENCES itsm_workspaces(id)"
        )
    return stmts


def _backfill_stmts() -> list[str]:
    stmts = []
    for table in TABLES_WITH_WS:
        stmts.append(
            f"UPDATE {table} SET workspace_id = '{DEFAULT_WS_ID}' "
            f"WHERE workspace_id IS NULL"
        )
    return stmts


EXTRA_STATEMENTS: list[str] = [
    # ── 전 사용자를 Default WS 멤버로 등록 ──────────────────────────
    f"""
    INSERT INTO itsm_workspace_members (id, workspace_id, user_id, role, is_default, joined_at)
    SELECT
        CONCAT('{DEFAULT_WS_ID[:8]}', LPAD(id::text, 18, '0')),
        '{DEFAULT_WS_ID}',
        id,
        'ws_member',
        TRUE,
        NOW()
    FROM users
    ON CONFLICT (workspace_id, user_id) DO NOTHING
    """,

    # ── ScopeGrant UniqueConstraint 교체 (workspace_id 포함) ─────────
    "ALTER TABLE itsm_scope_grant DROP CONSTRAINT IF EXISTS uq_itsm_scope_grant_tuple",
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_itsm_scope_grant_ws_tuple'
        ) THEN
            ALTER TABLE itsm_scope_grant
                ADD CONSTRAINT uq_itsm_scope_grant_ws_tuple
                UNIQUE (workspace_id, permission_group_id, service_type, customer_id, product_id);
        END IF;
    END$$
    """,

    # ── UserNotificationPref UniqueConstraint 교체 (user_id 단독 → user+ws) ──
    # 기존 unique 인덱스가 있을 경우 제거 후 복합 unique 추가
    "ALTER TABLE itsm_user_notification_pref DROP CONSTRAINT IF EXISTS uq_itsm_user_notification_pref_user",
    "DROP INDEX IF EXISTS uq_itsm_user_notification_pref_user",
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'uq_itsm_user_notification_pref_user_ws'
        ) THEN
            ALTER TABLE itsm_user_notification_pref
                ADD CONSTRAINT uq_itsm_user_notification_pref_user_ws
                UNIQUE (user_id, workspace_id);
        END IF;
    END$$
    """,
]


def migrate(engine) -> None:
    """Platform 공통 러너(_run_migrations)가 호출하는 진입점."""
    with engine.connect() as conn:
        for stmt in _add_workspace_id_stmts():
            conn.execute(text(stmt))
        for stmt in _backfill_stmts():
            conn.execute(text(stmt))
        for stmt in EXTRA_STATEMENTS:
            conn.execute(text(stmt))
        conn.commit()
    logger.info("a015_add_workspace_id: workspace_id 컬럼 + Default WS 백필 + 멤버 seed + 제약 교체 완료")


def upgrade(db) -> None:
    for stmt in _add_workspace_id_stmts():
        db.execute(text(stmt))
    logger.info("a015: workspace_id 컬럼 추가 완료")

    for stmt in _backfill_stmts():
        db.execute(text(stmt))
    logger.info("a015: Default WS 백필 완료")

    for stmt in EXTRA_STATEMENTS:
        db.execute(text(stmt))
    logger.info("a015: 멤버 seed + 제약 교체 완료")

    db.commit()
    logger.info("a015_add_workspace_id: 완료")


def downgrade(db) -> None:
    # workspace_id 컬럼 제거
    for table in TABLES_WITH_WS:
        db.execute(text(f"ALTER TABLE {table} DROP COLUMN IF EXISTS workspace_id"))

    # ScopeGrant unique 원복
    db.execute(text(
        "ALTER TABLE itsm_scope_grant DROP CONSTRAINT IF EXISTS uq_itsm_scope_grant_ws_tuple"
    ))
    db.execute(text("""
        ALTER TABLE itsm_scope_grant
            ADD CONSTRAINT uq_itsm_scope_grant_tuple
            UNIQUE (permission_group_id, service_type, customer_id, product_id)
    """))

    # UserNotificationPref unique 원복
    db.execute(text(
        "ALTER TABLE itsm_user_notification_pref "
        "DROP CONSTRAINT IF EXISTS uq_itsm_user_notification_pref_user_ws"
    ))

    db.commit()
    logger.info("a015_add_workspace_id: 롤백 완료")
