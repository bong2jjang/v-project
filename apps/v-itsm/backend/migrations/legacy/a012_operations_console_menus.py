"""a012: v-itsm 운영 콘솔 메뉴 시드.

v0.5 에서 추가된 운영 콘솔 페이지들(SLA 정책/알림 정책/스케줄러/통합/알림 로그)과
사용자 개인 알림 설정 메뉴를 사이드바에 노출.

- 관리 메뉴 5건: section='basic' — 시스템관리자 그룹에 write grant
- 개인 설정 메뉴 1건: section='basic' — 권한그룹 grant 없이 전 사용자 접근(ProtectedRoute 기본)

멱등: WHERE NOT EXISTS / ON CONFLICT DO NOTHING.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

APP_ID = "v-itsm"
SYSTEM_ADMIN_GROUP_ID = 1

ADMIN_MENU_ROWS = [
    {
        "permission_key": "itsm_sla_policies",
        "label": "SLA 정책",
        "icon": "Timer",
        "path": "/admin/sla-policies",
        "section": "basic",
        "sort_order": 240,
    },
    {
        "permission_key": "itsm_sla_notification_policies",
        "label": "SLA 알림 정책",
        "icon": "BellRing",
        "path": "/admin/sla-notification-policies",
        "section": "basic",
        "sort_order": 245,
    },
    {
        "permission_key": "itsm_scheduler",
        "label": "스케줄러",
        "icon": "Clock",
        "path": "/admin/scheduler",
        "section": "basic",
        "sort_order": 510,
    },
    {
        "permission_key": "itsm_integrations",
        "label": "통합 설정",
        "icon": "Plug",
        "path": "/admin/integrations",
        "section": "basic",
        "sort_order": 520,
    },
    {
        "permission_key": "itsm_notification_logs",
        "label": "알림 로그",
        "icon": "ScrollText",
        "path": "/admin/notification-logs",
        "section": "basic",
        "sort_order": 530,
    },
]

SELF_MENU_ROWS = [
    {
        "permission_key": "itsm_my_notification_pref",
        "label": "내 알림 설정",
        "icon": "BellDot",
        "path": "/me/notification-pref",
        "section": "basic",
        "sort_order": 900,
    },
]


def migrate(engine):
    with engine.connect() as conn:
        for row in ADMIN_MENU_ROWS + SELF_MENU_ROWS:
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
                      'itsm_sla_policies', 'itsm_sla_notification_policies',
                      'itsm_scheduler', 'itsm_integrations', 'itsm_notification_logs'
                  )
                ON CONFLICT (permission_group_id, menu_item_id) DO NOTHING
                """
            ),
            {"app_id": APP_ID, "group_id": SYSTEM_ADMIN_GROUP_ID},
        )

        conn.commit()
        logger.info(
            "a012: v-itsm operations console menus (+ self notification pref) registered"
        )
