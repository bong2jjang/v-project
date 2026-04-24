"""008: RBAC 권한 관리 및 커스텀 메뉴 시스템

1. UserRole enum 변경: admin → system_admin, 신규 org_admin 추가
2. 기존 admin 사용자 → system_admin으로 업데이트
3. menu_items 테이블 생성 + built_in 시드 데이터 삽입
4. user_permissions 테이블 생성
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine) -> bool:
    """마이그레이션 실행"""
    try:
        with engine.connect() as conn:
            # ── 1. UserRole enum 변경 ─────────────────────────────────
            # PostgreSQL enum 타입에 새 값 추가
            # 'system_admin', 'org_admin' 추가 (이미 존재하면 무시)
            conn.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        -- 새 enum 값 추가 (IF NOT EXISTS는 PG 9.3+ 지원)
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_enum
                            WHERE enumlabel = 'system_admin'
                            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
                        ) THEN
                            ALTER TYPE userrole ADD VALUE 'system_admin';
                        END IF;

                        IF NOT EXISTS (
                            SELECT 1 FROM pg_enum
                            WHERE enumlabel = 'org_admin'
                            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
                        ) THEN
                            ALTER TYPE userrole ADD VALUE 'org_admin';
                        END IF;
                    END
                    $$;
                    """
                )
            )
            conn.commit()
            logger.info("Added system_admin, org_admin to userrole enum")

            # ── 2. 기존 admin → system_admin 변환 ────────────────────
            # enum에 'admin' 값이 존재하는 경우에만 실행 (idempotent)
            has_admin = conn.execute(
                text(
                    """
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = 'admin'
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
                    """
                )
            ).fetchone()
            if has_admin:
                result = conn.execute(
                    text(
                        """
                        UPDATE users SET role = 'system_admin' WHERE role = 'admin'
                        """
                    )
                )
                conn.commit()
                logger.info(f"Converted {result.rowcount} admin users to system_admin")
            else:
                logger.info("'admin' enum value not found, skipping role conversion")

            # ── 3. menu_items 테이블 생성 ─────────────────────────────
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS menu_items (
                        id              SERIAL PRIMARY KEY,
                        permission_key  VARCHAR(100) UNIQUE NOT NULL,
                        label           VARCHAR(200) NOT NULL,
                        icon            VARCHAR(100),
                        path            VARCHAR(500) NOT NULL,
                        menu_type       VARCHAR(20) NOT NULL DEFAULT 'built_in',
                        iframe_url      TEXT,
                        open_in_new_tab BOOLEAN DEFAULT FALSE,
                        parent_key      VARCHAR(100),
                        sort_order      INTEGER DEFAULT 0,
                        is_active       BOOLEAN DEFAULT TRUE,
                        created_by      INTEGER REFERENCES users(id),
                        updated_by      INTEGER REFERENCES users(id),
                        created_at      TIMESTAMP DEFAULT NOW(),
                        updated_at      TIMESTAMP DEFAULT NOW()
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_menu_items_permission_key "
                    "ON menu_items(permission_key)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_menu_items_sort_order "
                    "ON menu_items(sort_order)"
                )
            )
            # Ensure UNIQUE index on permission_key exists
            # (create_all may have created the table without UNIQUE constraint)
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_items_permission_key "
                    "ON menu_items(permission_key)"
                )
            )
            conn.commit()
            logger.info("Created menu_items table")

            # ── 4. built_in 시드 데이터 삽입 ─────────────────────────
            # 주의: `dashboard`, `help` 는 p032 이후 각 앱이 자체 등록한다
            # (v-channel-bridge=dashboard/help, v-platform-portal=portal_home/portal_help,
            #  v-platform-template=dashboard/help, v-ui-builder=ui_builder_sandpack/ui_builder_help).
            seed_menus = [
                # 기본 메뉴
                ("channels", "채널 관리", "Radio", "/channels", "built_in", None, 200),
                (
                    "messages",
                    "메시지 히스토리",
                    "MessageSquare",
                    "/messages",
                    "built_in",
                    None,
                    300,
                ),
                (
                    "statistics",
                    "통계",
                    "BarChart3",
                    "/statistics",
                    "built_in",
                    None,
                    400,
                ),
                (
                    "integrations",
                    "연동 관리",
                    "Link",
                    "/integrations",
                    "built_in",
                    None,
                    500,
                ),
                ("settings", "설정", "Settings", "/settings", "built_in", None, 600),
                # 관리 메뉴
                ("users", "사용자 관리", "Users", "/users", "built_in", "admin", 800),
                (
                    "audit_logs",
                    "감사 로그",
                    "FileText",
                    "/audit-logs",
                    "built_in",
                    "admin",
                    900,
                ),
                (
                    "monitoring",
                    "모니터링",
                    "Activity",
                    "/monitoring",
                    "built_in",
                    "admin",
                    1000,
                ),
                (
                    "menu_management",
                    "메뉴 관리",
                    "Menu",
                    "/admin/menus",
                    "built_in",
                    "admin",
                    1100,
                ),
                (
                    "permission_management",
                    "권한 관리",
                    "Shield",
                    "/admin/permissions",
                    "built_in",
                    "admin",
                    1200,
                ),
            ]

            for key, label, icon, path, menu_type, parent_key, sort_order in seed_menus:
                conn.execute(
                    text(
                        """
                        INSERT INTO menu_items (permission_key, label, icon, path, menu_type, parent_key, sort_order,
                                                is_active, open_in_new_tab, created_at, updated_at)
                        VALUES (:key, :label, :icon, :path, :type, :parent, :sort,
                                TRUE, FALSE, NOW(), NOW())
                        ON CONFLICT (permission_key) DO NOTHING
                        """
                    ),
                    {
                        "key": key,
                        "label": label,
                        "icon": icon,
                        "path": path,
                        "type": menu_type,
                        "parent": parent_key,
                        "sort": sort_order,
                    },
                )
            conn.commit()
            logger.info("Inserted built_in menu seed data")

            # ── 5. user_permissions 테이블 생성 ──────────────────────
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS user_permissions (
                        id              SERIAL PRIMARY KEY,
                        user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        menu_item_id    INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
                        access_level    VARCHAR(10) NOT NULL DEFAULT 'none',
                        granted_by      INTEGER REFERENCES users(id),
                        created_at      TIMESTAMP DEFAULT NOW(),
                        updated_at      TIMESTAMP DEFAULT NOW(),
                        UNIQUE(user_id, menu_item_id)
                    )
                    """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_user_permissions_user_id "
                    "ON user_permissions(user_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_user_permissions_menu_item_id "
                    "ON user_permissions(menu_item_id)"
                )
            )
            conn.commit()
            logger.info("Created user_permissions table")

            # ── 6. 기존 admin enum 값 제거 (선택) ────────────────────
            # PostgreSQL은 enum 값 삭제를 직접 지원하지 않으므로 남겨둠
            # 새 코드에서는 system_admin/org_admin/user만 사용

            logger.info("Migration 008 completed successfully")
            return True

    except Exception as e:
        logger.error(f"Migration 008 failed: {e}")
        return False
