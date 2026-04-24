"""v-channel-bridge 앱 전용 메뉴 section 보정 및 데모 그룹 grants.

플랫폼 demo seed에서 분리된 앱 전용 데이터:
  - channels, messages, statistics, integrations: section='basic'
  - 데모그룹-운영 → 앱 메뉴 write 권한
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)

# 앱 전용 메뉴 section 설정
APP_MENU_SECTIONS = [
    ("channels", "basic"),
    ("messages", "basic"),
    ("statistics", "basic"),
    ("integrations", "basic"),
]

# 데모그룹-운영에 부여할 앱 전용 메뉴 권한
DEMO_GROUP_GRANTS = {
    "데모그룹-운영": {
        "channels": "write",
        "messages": "write",
        "statistics": "write",
        "integrations": "write",
    },
}


def migrate(engine):
    with engine.connect() as conn:
        # 1) 앱 전용 메뉴 section 보정
        for pkey, section in APP_MENU_SECTIONS:
            conn.execute(
                text(
                    """
                    UPDATE menu_items SET section = :section
                    WHERE permission_key = :pkey
                      AND app_id = 'v-channel-bridge'
                      AND (section IS NULL OR section = '')
                    """
                ),
                {"pkey": pkey, "section": section},
            )
        logger.info("a009: app menu sections updated")

        # 2) 데모그룹이 존재하면 앱 메뉴 권한 부여
        for group_name, grants in DEMO_GROUP_GRANTS.items():
            group = conn.execute(
                text("SELECT id FROM permission_groups WHERE name = :name"),
                {"name": group_name},
            ).fetchone()
            if not group:
                continue

            for pkey, level in grants.items():
                conn.execute(
                    text(
                        """
                        INSERT INTO permission_group_grants
                            (permission_group_id, menu_item_id, access_level)
                        SELECT pg.id, mi.id, :level
                        FROM permission_groups pg, menu_items mi
                        WHERE pg.name = :group_name
                          AND mi.permission_key = :pkey
                          AND mi.app_id = 'v-channel-bridge'
                        ON CONFLICT (permission_group_id, menu_item_id)
                        DO UPDATE SET access_level = EXCLUDED.access_level
                        """
                    ),
                    {"group_name": group_name, "pkey": pkey, "level": level},
                )
            logger.info("a009: demo group grants for %s applied", group_name)

        conn.commit()
        logger.info("a009: v-channel-bridge app menu grants migration completed")
