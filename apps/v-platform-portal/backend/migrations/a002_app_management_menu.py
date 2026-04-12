"""Add app_management menu item for Portal admin page."""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        # Insert app_management menu (portal-specific)
        conn.execute(
            text(
                """
                INSERT INTO menu_items
                    (permission_key, label, icon, path, menu_type, section,
                     sort_order, is_active, open_in_new_tab, app_id,
                     created_at, updated_at)
                VALUES
                    ('app_management', '앱 관리', 'Box', '/admin/apps',
                     'built_in', 'admin', 1500, TRUE, FALSE,
                     'v-platform-portal', NOW(), NOW())
                ON CONFLICT (permission_key) DO NOTHING
                """
            )
        )

        # Grant write permission to 전체 관리자 group
        conn.execute(
            text(
                """
                INSERT INTO permission_group_grants
                    (permission_group_id, menu_item_id, access_level)
                SELECT pg.id, mi.id, 'write'
                FROM permission_groups pg
                CROSS JOIN menu_items mi
                WHERE pg.name = '전체 관리자'
                  AND mi.permission_key = 'app_management'
                ON CONFLICT (permission_group_id, menu_item_id) DO NOTHING
                """
            )
        )

        conn.commit()
        logger.info("Migration a002: added app_management menu item")
