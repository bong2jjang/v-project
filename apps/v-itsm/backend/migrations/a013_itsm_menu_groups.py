"""a013: v-itsm 메뉴 그룹 정리.

기능 추가가 아닌 **데이터 재구성** — 기존 a002/a008/a012 가 등록한 16개 메뉴를
시나리오별 menu_group(parent_key) 으로 묶고, 통합 설정 한 건은 section 을 admin 으로 승격.

그룹 구성
---------
basic 섹션:
  itsm_group_operations  "업무"       (kanban / tickets / sla_monitor / kpi)
  itsm_group_masters     "마스터"     (customers / products / sla_tiers / contracts)
  itsm_group_policies    "정책"       (sla_policies / sla_notification_policies / scope_grants)
  itsm_group_system      "운영"       (scheduler / notification_logs)
  help                   (standalone)
  itsm_group_personal    "개인 설정"  (my_notification_pref)

admin 섹션:
  itsm_group_integrations "외부 연동" (integrations — 시크릿 보관, 관리자 전용)

멱등 보장
--------
  - 그룹 생성: WHERE NOT EXISTS (app_id, permission_key 기준)
  - 자식 재배치: UPDATE parent_key + sort_order (+ integrations 만 section='admin')
  - 재실행해도 안정.

참고: `menu_type='menu_group'` 은 `path` 가 NOT NULL 이므로 `#<key>` 형태의 더미값 사용.
        Sidebar.tsx 는 parent_key/menu_type 으로 자식을 nesting, 더미 path 는 클릭되지 않음.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

APP_ID = "v-itsm"


GROUP_ROWS: list[dict] = [
    {
        "permission_key": "itsm_group_operations",
        "label": "업무",
        "icon": "LayoutDashboard",
        "section": "basic",
        "sort_order": 100,
    },
    {
        "permission_key": "itsm_group_masters",
        "label": "마스터",
        "icon": "Database",
        "section": "basic",
        "sort_order": 200,
    },
    {
        "permission_key": "itsm_group_policies",
        "label": "정책",
        "icon": "ShieldCheck",
        "section": "basic",
        "sort_order": 300,
    },
    {
        "permission_key": "itsm_group_system",
        "label": "운영",
        "icon": "Wrench",
        "section": "basic",
        "sort_order": 400,
    },
    {
        "permission_key": "itsm_group_personal",
        "label": "개인 설정",
        "icon": "UserCog",
        "section": "basic",
        "sort_order": 900,
    },
    {
        "permission_key": "itsm_group_integrations",
        "label": "외부 연동",
        "icon": "Plug",
        "section": "admin",
        "sort_order": 800,
    },
]


# (permission_key, parent_key, section, sort_order)
CHILD_REASSIGN: list[tuple[str, str, str, int]] = [
    # operations
    ("itsm_kanban",                    "itsm_group_operations", "basic", 110),
    ("itsm_tickets",                   "itsm_group_operations", "basic", 120),
    ("itsm_sla_monitor",               "itsm_group_operations", "basic", 130),
    ("itsm_kpi",                       "itsm_group_operations", "basic", 140),

    # masters
    ("itsm_customers",                 "itsm_group_masters",    "basic", 210),
    ("itsm_products",                  "itsm_group_masters",    "basic", 220),
    ("itsm_sla_tiers",                 "itsm_group_masters",    "basic", 230),
    ("itsm_contracts",                 "itsm_group_masters",    "basic", 240),

    # policies
    ("itsm_sla_policies",              "itsm_group_policies",   "basic", 310),
    ("itsm_sla_notification_policies", "itsm_group_policies",   "basic", 320),
    ("itsm_scope_grants",              "itsm_group_policies",   "basic", 330),

    # system ops
    ("itsm_scheduler",                 "itsm_group_system",     "basic", 410),
    ("itsm_notification_logs",         "itsm_group_system",     "basic", 420),

    # admin-only: integrations moves to admin section
    ("itsm_integrations",              "itsm_group_integrations", "admin", 810),

    # personal
    ("itsm_my_notification_pref",      "itsm_group_personal",   "basic", 910),
]


# help 은 독립 메뉴로 유지. sort_order 만 개인 설정 바로 위로 당김.
STANDALONE_SORT: list[tuple[str, int]] = [
    ("help", 850),
]


INSERT_GROUP_SQL = """
INSERT INTO menu_items
    (permission_key, label, icon, path, sort_order,
     app_id, is_active, menu_type, section, parent_key,
     created_at, updated_at)
SELECT :pkey, :label, :icon, :path, :sort_order,
       :app_id, TRUE, 'menu_group', :section, NULL,
       NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM menu_items
    WHERE app_id = :app_id AND permission_key = :pkey
)
"""

UPDATE_GROUP_META_SQL = """
UPDATE menu_items
   SET label = :label,
       icon = :icon,
       section = :section,
       sort_order = :sort_order,
       menu_type = 'menu_group',
       parent_key = NULL,
       updated_at = NOW()
 WHERE app_id = :app_id AND permission_key = :pkey
"""

UPDATE_CHILD_SQL = """
UPDATE menu_items
   SET parent_key = :parent_key,
       section = :section,
       sort_order = :sort_order,
       updated_at = NOW()
 WHERE app_id = :app_id AND permission_key = :pkey
"""

UPDATE_STANDALONE_SORT_SQL = """
UPDATE menu_items
   SET sort_order = :sort_order,
       parent_key = NULL,
       updated_at = NOW()
 WHERE app_id = :app_id AND permission_key = :pkey
"""


def migrate(engine):
    with engine.connect() as conn:
        # 1) 그룹 행 멱등 upsert
        for g in GROUP_ROWS:
            params = {
                "app_id": APP_ID,
                "pkey": g["permission_key"],
                "label": g["label"],
                "icon": g["icon"],
                "path": f"#{g['permission_key']}",  # NOT NULL 제약용 더미
                "section": g["section"],
                "sort_order": g["sort_order"],
            }
            conn.execute(text(INSERT_GROUP_SQL), params)
            conn.execute(text(UPDATE_GROUP_META_SQL), params)

        # 2) 자식 메뉴 parent_key / section / sort_order 재배치
        for pkey, parent_key, section, sort_order in CHILD_REASSIGN:
            conn.execute(
                text(UPDATE_CHILD_SQL),
                {
                    "app_id": APP_ID,
                    "pkey": pkey,
                    "parent_key": parent_key,
                    "section": section,
                    "sort_order": sort_order,
                },
            )

        # 3) 독립 메뉴 정렬만 조정
        for pkey, sort_order in STANDALONE_SORT:
            conn.execute(
                text(UPDATE_STANDALONE_SORT_SQL),
                {"app_id": APP_ID, "pkey": pkey, "sort_order": sort_order},
            )

        conn.commit()

    logger.info(
        "a013: v-itsm menu groups reorganized "
        "(6 groups: operations/masters/policies/system/personal/integrations, "
        "integrations promoted to admin section)"
    )
