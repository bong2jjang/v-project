"""a007: v-ui-builder 도움말 메뉴 등록 + a006 hide_shared 마커 정리.

배경
----
플랫폼 p032 에서 공통(app_id=NULL) `dashboard`, `help` 메뉴가 제거되었다.
따라서 a006 에서 공통 dashboard 를 숨기려고 생성했던 hide_shared 마커
행은 더 이상 필요 없다(p032 가 이미 삭제했을 가능성이 크지만 이중 안전망).

- 새 메뉴: `ui_builder_help` (path `/help`) — ui-builder 전용 도움말
- 정리 대상: a006 이 삽입했던 `menu_type='hide_shared'` / `permission_key='dashboard'`
  마커 행 (app_id='v-ui-builder')
- 과거 공통 help grants 가 존재했다면 ui_builder_help 로 복사 (권한 보존)
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

APP_ID = "v-ui-builder"

HELP_ROW = {
    "permission_key": "ui_builder_help",
    "label": "도움말",
    "icon": "HelpCircle",
    "path": "/help",
    "section": "basic",
    "sort_order": 700,
}


def migrate(engine):
    with engine.connect() as conn:
        # 1) a006 hide_shared 마커 행 제거 (p032 가 이미 지웠다면 no-op)
        conn.execute(
            text(
                """
                DELETE FROM menu_items
                WHERE app_id = :app_id
                  AND menu_type = 'hide_shared'
                """
            ),
            {"app_id": APP_ID},
        )

        # 2) ui_builder_help INSERT
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
                "pkey": HELP_ROW["permission_key"],
                "label": HELP_ROW["label"],
                "icon": HELP_ROW["icon"],
                "path": HELP_ROW["path"],
                "section": HELP_ROW["section"],
                "sort_order": HELP_ROW["sort_order"],
                "app_id": APP_ID,
            },
        )

        # 3) 공통 help grants → ui_builder_help 복사 (공통 행이 남아 있을 때만)
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
                 AND shared.permission_key = 'help'
                JOIN menu_items new_mi
                  ON new_mi.app_id = :app_id
                 AND new_mi.menu_type = 'built_in'
                 AND new_mi.permission_key = 'ui_builder_help'
                ON CONFLICT (permission_group_id, menu_item_id) DO NOTHING
                """
            ),
            {"app_id": APP_ID},
        )

        conn.commit()
        logger.info(
            "a007: ui_builder_help registered; a006 hide_shared marker cleaned"
        )
