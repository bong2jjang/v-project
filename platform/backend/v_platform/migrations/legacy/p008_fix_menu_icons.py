"""015: 메뉴 아이콘 중복 수정

- permission_groups: "Users" → "UserCog" (사용자 관리와 아이콘 중복 해소)
- menu_management: "Menu" → "ListTree" (메뉴 계층 구조를 더 잘 표현)
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine) -> bool:
    """마이그레이션 실행"""
    try:
        with engine.connect() as conn:
            updates = [
                ("permission_groups", "UserCog"),
                ("menu_management", "ListTree"),
            ]

            for perm_key, new_icon in updates:
                conn.execute(
                    text(
                        """
                        UPDATE menu_items
                        SET icon = :icon, updated_at = NOW()
                        WHERE permission_key = :key
                        """
                    ),
                    {"icon": new_icon, "key": perm_key},
                )

            conn.commit()
            logger.info(
                "Migration 015 completed: fixed duplicate menu icons "
                "(permission_groups→UserCog, menu_management→ListTree)"
            )
            return True

    except Exception as e:
        logger.error(f"Migration 015 failed: {e}")
        return False
