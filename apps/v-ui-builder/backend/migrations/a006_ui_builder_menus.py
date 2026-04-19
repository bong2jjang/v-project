"""a006: v-ui-builder 앱 전용 메뉴 등록 + 공통 대시보드 숨김.

v-ui-builder 사이드바에는 다음 2개 메뉴만 노출한다:
  - Sandpack 프로젝트     : permission_key='ui_builder_sandpack', path='/',      icon='Code2'
  - Generative UI 프로젝트 : permission_key='ui_builder_genui',    path='/genui', icon='Sparkles'

각 메뉴는 고유한 permission_key 를 가지므로(키 중복 없음) 관리자 화면에서
개별적으로 권한 부여가 가능하다. 더불어 플랫폼 공통 '대시보드' 메뉴
(permission_key='dashboard', app_id=NULL) 는 v-ui-builder 앱에서 필요
없으므로 `hide_shared` 마커 행을 하나 INSERT 하여 사이드바에서 숨긴다.

플랫폼의 `PermissionService._filter_shared_overridden` 가 두 가지 규칙으로
공통 메뉴를 숨긴다:
  1) 같은 permission_key 에 app-specific entry 가 있을 때
  2) `menu_type='hide_shared'` 마커 행 의 permission_key 와 일치할 때

본 마이그레이션은 위 (2) 규칙을 이용해 공통 dashboard 를 숨긴다.

이전 a006 이 permission_key='dashboard' 로 2행을 삽입했을 수 있으므로,
해당 행들을 선행 DELETE 하여 재실행 시 중복을 방지한다(grants/user_permissions
CASCADE 정리 포함).

멱등성: 선행 DELETE + ON CONFLICT / NOT EXISTS 가드.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

APP_ID = "v-ui-builder"

# 정식 메뉴 행 (사이드바에 노출)
MENU_ROWS = [
    {
        "permission_key": "ui_builder_sandpack",
        "label": "Sandpack 프로젝트",
        "icon": "Code2",
        "path": "/",
        "sort_order": 100,
    },
    {
        "permission_key": "ui_builder_genui",
        "label": "Generative UI 프로젝트",
        "icon": "Sparkles",
        "path": "/genui",
        "sort_order": 110,
    },
]

# 공통 'dashboard' 를 숨기기 위한 마커 행.
# path 는 NOT NULL 이므로 센티넬 경로 사용. is_active=FALSE 로 라우팅 대상 외.
HIDE_MARKER = {
    "permission_key": "dashboard",
    "label": "(hidden) 공통 대시보드 숨김 마커",
    "icon": "EyeOff",
    "path": "__hidden__/v-ui-builder/dashboard",
    "sort_order": 9999,
}


def migrate(engine):
    with engine.connect() as conn:
        # 0) 이전 a006(중복 키='dashboard') 행과 연관 권한 정리
        conn.execute(
            text(
                """
                DELETE FROM permission_group_grants
                WHERE menu_item_id IN (
                    SELECT id FROM menu_items
                    WHERE app_id = :app_id
                      AND permission_key = 'dashboard'
                      AND menu_type = 'built_in'
                )
                """
            ),
            {"app_id": APP_ID},
        )
        conn.execute(
            text(
                """
                DELETE FROM user_permissions
                WHERE menu_item_id IN (
                    SELECT id FROM menu_items
                    WHERE app_id = :app_id
                      AND permission_key = 'dashboard'
                      AND menu_type = 'built_in'
                )
                """
            ),
            {"app_id": APP_ID},
        )
        conn.execute(
            text(
                """
                DELETE FROM menu_items
                WHERE app_id = :app_id
                  AND permission_key = 'dashboard'
                  AND menu_type = 'built_in'
                """
            ),
            {"app_id": APP_ID},
        )

        # 1) v-ui-builder 앱 고유 메뉴 INSERT (app_id + path 조합으로 멱등)
        for row in MENU_ROWS:
            conn.execute(
                text(
                    """
                    INSERT INTO menu_items
                        (permission_key, label, icon, path, sort_order,
                         app_id, is_active, menu_type, section,
                         created_at, updated_at)
                    SELECT :pkey, :label, :icon, :path, :sort_order,
                           :app_id, TRUE, 'built_in', 'basic',
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
                    "sort_order": row["sort_order"],
                    "app_id": APP_ID,
                },
            )

        # 2) 공통 'dashboard' 숨김 마커 INSERT (is_active=FALSE, menu_type='hide_shared')
        conn.execute(
            text(
                """
                INSERT INTO menu_items
                    (permission_key, label, icon, path, sort_order,
                     app_id, is_active, menu_type, section,
                     created_at, updated_at)
                SELECT :pkey, :label, :icon, :path, :sort_order,
                       :app_id, FALSE, 'hide_shared', 'basic',
                       NOW(), NOW()
                WHERE NOT EXISTS (
                    SELECT 1 FROM menu_items
                    WHERE app_id = :app_id AND path = :path
                )
                """
            ),
            {
                "pkey": HIDE_MARKER["permission_key"],
                "label": HIDE_MARKER["label"],
                "icon": HIDE_MARKER["icon"],
                "path": HIDE_MARKER["path"],
                "sort_order": HIDE_MARKER["sort_order"],
                "app_id": APP_ID,
            },
        )

        # 3) 공통 dashboard 메뉴에 부여된 grants 를 새 app-specific entry 2행에 복사.
        #    (비 system_admin 사용자의 기존 권한 유지)
        conn.execute(
            text(
                """
                INSERT INTO permission_group_grants
                    (permission_group_id, menu_item_id, access_level)
                SELECT g.permission_group_id, new_mi.id, g.access_level
                FROM permission_group_grants g
                JOIN menu_items shared
                  ON shared.id = g.menu_item_id
                 AND shared.permission_key = 'dashboard'
                 AND shared.app_id IS NULL
                JOIN menu_items new_mi
                  ON new_mi.app_id = :app_id
                 AND new_mi.menu_type = 'built_in'
                 AND new_mi.permission_key IN ('ui_builder_sandpack', 'ui_builder_genui')
                ON CONFLICT (permission_group_id, menu_item_id) DO NOTHING
                """
            ),
            {"app_id": APP_ID},
        )

        conn.commit()
        logger.info(
            "a006: v-ui-builder menus (ui_builder_sandpack, ui_builder_genui) + "
            "hide_shared('dashboard') marker registered; grants copied from shared dashboard"
        )
