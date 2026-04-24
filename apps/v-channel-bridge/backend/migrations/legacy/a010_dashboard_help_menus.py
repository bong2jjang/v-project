"""a010: v-channel-bridge 자체 dashboard / help 메뉴 등록.

플랫폼 p032 에서 공통(app_id=NULL) `dashboard`, `help` 메뉴가 제거되었다.
이 앱은 채널 브리지 컨텍스트에 맞는 대시보드/도움말을 자체적으로 소유한다.

- permission_key 는 기존 프론트엔드(App.tsx) 와 호환되도록 `dashboard`, `help` 유지
  (이제는 app_id='v-channel-bridge' 스코프 내에서만 고유)
- 공통 dashboard/help 행이 살아 있다면(이전 버전 유지 중인 환경) 해당
  grants 를 새 app-specific 행으로 복사해 기존 권한을 보존한다.

멱등성: app_id + path NOT EXISTS 가드, grants 는 ON CONFLICT DO NOTHING.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

APP_ID = "v-channel-bridge"

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

        # 과거 공통(app_id IS NULL) dashboard/help 행이 아직 살아 있으면 grants 복사.
        # (p032 가 먼저 실행되면 shared 행이 이미 없어 SELECT 가 0건 → no-op)
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
        logger.info("a010: v-channel-bridge dashboard/help menus registered (+grants copied if shared rows existed)")
