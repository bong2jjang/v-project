"""014: 권한 그룹 관리 + 조직 관리 메뉴 항목 추가

menu_items에 permission_groups, organizations 메뉴 추가.
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine) -> bool:
    """마이그레이션 실행"""
    try:
        with engine.connect() as conn:
            new_menus = [
                (
                    "permission_groups",
                    "권한 그룹",
                    "Users",
                    "/admin/permission-groups",
                    "built_in",
                    "admin",
                    1300,
                ),
                (
                    "organizations",
                    "조직 관리",
                    "Building2",
                    "/admin/organizations",
                    "built_in",
                    "admin",
                    1400,
                ),
            ]

            for key, label, icon, path, menu_type, section, sort_order in new_menus:
                conn.execute(
                    text(
                        """
                        INSERT INTO menu_items (permission_key, label, icon, path, menu_type, section, sort_order,
                                                is_active, open_in_new_tab, created_at, updated_at)
                        VALUES (:key, :label, :icon, :path, :type, :section, :sort,
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
                        "section": section,
                        "sort": sort_order,
                    },
                )

            # 기본 그룹(전체 관리자)에 새 메뉴 write 권한 부여
            conn.execute(
                text(
                    """
                    INSERT INTO permission_group_grants (permission_group_id, menu_item_id, access_level)
                    SELECT pg.id, mi.id, 'write'
                    FROM permission_groups pg
                    CROSS JOIN menu_items mi
                    WHERE pg.name = '전체 관리자'
                    AND mi.permission_key IN ('permission_groups', 'organizations')
                    ON CONFLICT (permission_group_id, menu_item_id) DO NOTHING
                    """
                )
            )

            conn.commit()
            logger.info("Added permission_groups and organizations menu items")
            return True

    except Exception as e:
        logger.error(f"Migration 014 failed: {e}")
        return False
