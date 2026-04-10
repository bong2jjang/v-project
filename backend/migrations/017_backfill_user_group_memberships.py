"""017: 기존 사용자를 역할에 맞는 기본 권한 그룹에 자동 할당

역할 → 기본 그룹 매핑:
  system_admin → 시스템 관리자 (system_admin)
  org_admin    → 조직 관리자   (org_admin)
  user         → 일반 사용자   (user)
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)

ROLE_GROUP_MAP = {
    "SYSTEM_ADMIN": "(system_admin)",
    "ORG_ADMIN": "(org_admin)",
    "USER": "(user)",
}


def migrate(engine) -> bool:
    """마이그레이션 실행"""
    try:
        with engine.connect() as conn:
            for role_value, marker in ROLE_GROUP_MAP.items():
                conn.execute(
                    text(
                        """
                        INSERT INTO user_group_memberships
                            (user_id, permission_group_id, created_at)
                        SELECT u.id, pg.id, NOW()
                        FROM users u
                        CROSS JOIN permission_groups pg
                        WHERE u.role = :role
                          AND pg.is_default = TRUE
                          AND pg.description LIKE :marker
                        ON CONFLICT (user_id, permission_group_id) DO NOTHING
                        """
                    ),
                    {"role": role_value, "marker": f"%{marker}%"},
                )

            conn.commit()
            logger.info("Backfilled user_group_memberships for all existing users")
            return True

    except Exception as e:
        logger.error(f"Migration 017 failed: {e}")
        return False
