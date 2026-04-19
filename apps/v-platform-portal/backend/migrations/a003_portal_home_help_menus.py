"""a003: v-platform-portal 자체 메뉴 등록 (포털 런처 + 포털 도움말).

플랫폼 p032 에서 공통(app_id=NULL) `dashboard`, `help` 메뉴가 제거되었다.
v-platform-portal 은 "대시보드" 가 아닌 **앱 런처(홈)** 성격이므로 포털 고유
키(`portal_home`, `portal_help`) 를 사용한다 (기존 `app_management` 처럼
포털 스코프에 맞는 네이밍).

- permission_key: `portal_home` (경로 `/` 런처), `portal_help` (경로 `/help`)
- app_id = 'v-platform-portal'
- 과거 공통 dashboard/help 행의 grants 가 남아 있다면 포털 신규 키로 복사해
  기존 권한을 유지한다.

멱등성: app_id + path NOT EXISTS 가드, grants 는 ON CONFLICT DO NOTHING.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

APP_ID = "v-platform-portal"

# (permission_key, label, icon, path, section, sort_order, shared_src_key)
# shared_src_key: 과거 공통 메뉴 중 이 신규 키로 grants 를 복사할 원본 permission_key
MENU_ROWS = [
    {
        "permission_key": "portal_home",
        "label": "포털 홈",
        "icon": "LayoutDashboard",
        "path": "/",
        "section": "basic",
        "sort_order": 100,
        "shared_src_key": "dashboard",
    },
    {
        "permission_key": "portal_help",
        "label": "도움말",
        "icon": "HelpCircle",
        "path": "/help",
        "section": "basic",
        "sort_order": 700,
        "shared_src_key": "help",
    },
]


def migrate(engine):
    with engine.connect() as conn:
        # 1) 포털 자체 메뉴 INSERT
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

        # 2) 과거 공통 dashboard/help grants → 포털 신규 키로 복사 (존재할 때만)
        for row in MENU_ROWS:
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
                     AND shared.permission_key = :src_key
                    JOIN menu_items new_mi
                      ON new_mi.app_id = :app_id
                     AND new_mi.menu_type = 'built_in'
                     AND new_mi.permission_key = :new_key
                    ON CONFLICT (permission_group_id, menu_item_id) DO NOTHING
                    """
                ),
                {
                    "app_id": APP_ID,
                    "src_key": row["shared_src_key"],
                    "new_key": row["permission_key"],
                },
            )

        conn.commit()
        logger.info(
            "a003: v-platform-portal portal_home/portal_help registered (+grants copied if shared rows existed)"
        )
