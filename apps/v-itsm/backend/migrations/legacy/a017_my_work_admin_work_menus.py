"""a017: v-itsm 크로스 워크스페이스 업무 메뉴 시드.

두 개의 워크스페이스 비의존 페이지를 사이드바에 노출:
  - itsm_my_work        "내 업무"       /my-work        — 전 WS 내게 할당된 티켓
  - itsm_admin_all_work "통합 업무 관리" /admin/all-work — 관리하는 제품/전 WS 티켓(팀/시스템관리자)

배치:
  - 둘 다 `itsm_group_operations` 하위. "내 업무"는 최상단(105), "통합 업무 관리"는 KPI 아래(145).
  - section='basic'. 접근 제어는 SYSTEM_ADMIN 그룹 grant + ScopeGrant 기반 ACL 로 처리.

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
        "permission_key": "itsm_my_work",
        "label": "내 업무",
        "icon": "Inbox",
        "path": "/my-work",
        "parent_key": "itsm_group_operations",
        "section": "basic",
        "sort_order": 105,
    },
    {
        "permission_key": "itsm_admin_all_work",
        "label": "통합 업무 관리",
        "icon": "ClipboardList",
        "path": "/admin/all-work",
        "parent_key": "itsm_group_operations",
        "section": "basic",
        "sort_order": 145,
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
  AND mi.permission_key IN ('itsm_my_work', 'itsm_admin_all_work')
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
            "a017: v-itsm cross-workspace work menus registered "
            "(itsm_my_work, itsm_admin_all_work) + system_admin grants"
        )
