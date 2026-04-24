"""a018: v-itsm 워크스페이스 선택/관리 메뉴 시드.

워크스페이스 목록·전환 페이지를 사이드바에 노출.

  - itsm_workspaces  "워크스페이스"  /workspaces  — 내 WS 목록 + 전환 (SYSTEM_ADMIN은 전체)

배치:
  - `itsm_group_personal` 하위. my_notification_pref(910) 위에 둠 (905).
  - section='basic'. SYSTEM_ADMIN 그룹 grant 선행; 일반 멤버 노출은
    permission_group 매핑 또는 ScopeGrant 정책으로 별도 처리.

멱등: IF NOT EXISTS / ON CONFLICT DO NOTHING / UPDATE upsert.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

APP_ID = "v-itsm"
SYSTEM_ADMIN_GROUP_ID = 1

MENU_ROWS = [
    {
        "permission_key": "itsm_workspaces",
        "label": "워크스페이스",
        "icon": "Layers",
        "path": "/workspaces",
        "parent_key": "itsm_group_personal",
        "section": "basic",
        "sort_order": 905,
    },
]


INSERT_MENU_SQL = """
INSERT INTO menu_items
    (permission_key, label, icon, path, sort_order,
     app_id, is_active, menu_type, section, parent_key,
     created_at, updated_at)
SELECT :pkey, :label, :icon, :path, :sort_order,
       :app_id, TRUE, 'built_in', :section, :parent_key,
       NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM menu_items
    WHERE app_id = :app_id AND permission_key = :pkey
)
"""

UPDATE_MENU_SQL = """
UPDATE menu_items
   SET label = :label,
       icon = :icon,
       path = :path,
       sort_order = :sort_order,
       parent_key = :parent_key,
       section = :section,
       menu_type = 'built_in',
       is_active = TRUE,
       updated_at = NOW()
 WHERE app_id = :app_id AND permission_key = :pkey
"""

GRANT_SQL = """
INSERT INTO permission_group_grants
    (permission_group_id, menu_item_id, access_level)
SELECT :group_id, mi.id, 'write'
FROM menu_items mi
WHERE mi.app_id = :app_id
  AND mi.permission_key = 'itsm_workspaces'
ON CONFLICT (permission_group_id, menu_item_id) DO NOTHING
"""


def migrate(engine):
    with engine.connect() as conn:
        for row in MENU_ROWS:
            params = {
                "app_id": APP_ID,
                "pkey": row["permission_key"],
                "label": row["label"],
                "icon": row["icon"],
                "path": row["path"],
                "parent_key": row["parent_key"],
                "section": row["section"],
                "sort_order": row["sort_order"],
            }
            conn.execute(text(INSERT_MENU_SQL), params)
            conn.execute(text(UPDATE_MENU_SQL), params)

        conn.execute(
            text(GRANT_SQL),
            {"app_id": APP_ID, "group_id": SYSTEM_ADMIN_GROUP_ID},
        )

        conn.commit()
        logger.info(
            "a018: v-itsm workspaces menu registered "
            "(itsm_workspaces) + system_admin grant"
        )
