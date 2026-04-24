"""a002: v-itsm 자체 dashboard / help 메뉴 등록.

플랫폼 p032 에서 공통(app_id=NULL) `dashboard`, `help` 메뉴가 제거되었다.
템플릿 앱은 "새 앱 시작" 기본 골격을 제공하므로 dashboard/help 를 그대로
사용하되 app_id 스코프 아래로 이관한다.

- permission_key 는 `dashboard`, `help` (앱 스코프 내에서만 고유)
- app_id = 'v-itsm'
- 과거 공통 grants 존재 시 신규 app-specific 행으로 복사.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

APP_ID = "v-itsm"

MENU_ROWS = [
    {
        "permission_key": "dashboard",
        "label": "대시보드",
        "icon": "LayoutDashboard",
        "path": "/",
        "section": "basic",
        "sort_order": 100,
    },
    {
        "permission_key": "help",
        "label": "도움말",
        "icon": "HelpCircle",
        "path": "/help",
        "section": "basic",
        "sort_order": 700,
    },
]


def migrate(engine):
    with engine.connect() as conn:
        for row in MENU_ROWS:
            conn.execute(
                text(
                    """
                    INSERT INTO menu_items
                        (permission_key, label, icon, path, sort_order,
                         app_id, is_active, menu_type, section,
                         created_at, updated_at)
                    SELECT :pkey, :label, :icon, :path, :sort_order,
                           :app_id, TRUE, 'built_in', :section,
                           NOW(), NOW()
                    WHERE NOT EXISTS (
                        SELECT 1 FROM menu_items
                        WHERE app_id = :app_id AND path = :path
                    )
                    """
                ),
                {
                    "pkey": row["permission_key"],
                    "label": row["label"],
                    "icon": row["icon"],
                    "path": row["path"],
                    "section": row["section"],
                    "sort_order": row["sort_order"],
                    "app_id": APP_ID,
                },
            )

        conn.execute(
            text(
                """
                INSERT INTO permission_group_grants
                    (permission_group_id, menu_item_id, access_level)
                SELECT g.permission_group_id, new_mi.id, g.access_level
                FROM permission_group_grants g
                JOIN menu_items shared
                  ON shared.id = g.menu_item_id
                 AND shared.app_id IS NULL
                 AND shared.permission_key IN ('dashboard', 'help')
                JOIN menu_items new_mi
                  ON new_mi.app_id = :app_id
                 AND new_mi.menu_type = 'built_in'
                 AND new_mi.permission_key = shared.permission_key
                ON CONFLICT (permission_group_id, menu_item_id) DO NOTHING
                """
            ),
            {"app_id": APP_ID},
        )

        conn.commit()
        logger.info("a002: v-itsm dashboard/help menus registered")
