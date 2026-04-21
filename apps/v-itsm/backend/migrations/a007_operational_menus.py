"""a007: v-itsm 운영 화면 메뉴 시드.

티켓/Kanban/SLA 모니터/KPI 대시보드 4개 운영 화면을 사이드바에 노출.

permission_key 는 `itsm_*` 접두사(앱 전역 고유) — section='basic' 으로
앱 서비스 사용 관점의 기본 메뉴로 분류.

멱등: IF NOT EXISTS / ON CONFLICT DO NOTHING.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

APP_ID = "v-itsm"
SYSTEM_ADMIN_GROUP_ID = 1

MENU_ROWS = [
    {
        "permission_key": "itsm_tickets",
        "label": "티켓",
        "icon": "Ticket",
        "path": "/tickets",
        "section": "basic",
        "sort_order": 100,
    },
    {
        "permission_key": "itsm_kanban",
        "label": "칸반 보드",
        "icon": "Kanban",
        "path": "/kanban",
        "section": "basic",
        "sort_order": 110,
    },
    {
        "permission_key": "itsm_sla_monitor",
        "label": "SLA 모니터",
        "icon": "Timer",
        "path": "/sla",
        "section": "basic",
        "sort_order": 120,
    },
    {
        "permission_key": "itsm_kpi",
        "label": "KPI 대시보드",
        "icon": "BarChart3",
        "path": "/kpi",
        "section": "basic",
        "sort_order": 130,
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
                SELECT :group_id, mi.id, 'write'
                FROM menu_items mi
                WHERE mi.app_id = :app_id
                  AND mi.permission_key IN (
                      'itsm_tickets', 'itsm_kanban',
                      'itsm_sla_monitor', 'itsm_kpi'
                  )
                ON CONFLICT (permission_group_id, menu_item_id) DO NOTHING
                """
            ),
            {"app_id": APP_ID, "group_id": SYSTEM_ADMIN_GROUP_ID},
        )

        conn.commit()
        logger.info("a007: v-itsm operational menus + system_admin grants registered")
