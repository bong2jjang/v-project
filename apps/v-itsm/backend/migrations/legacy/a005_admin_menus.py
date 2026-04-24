"""a005: v-itsm v0.2 앱 메뉴 시드.

a004 에서 추가된 5개 마스터 리소스(customer/product/sla-tier/contract/scope-grant)
를 사이드바에 노출하기 위한 `menu_items` 시드 + 시스템관리자 그룹 grant.

permission_key 는 `itsm_*` 접두사(앱 전역 고유) — section='basic' 으로
앱 서비스 사용 관점의 기본 메뉴로 분류 (플랫폼 관리 메뉴와 구분).

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
        "permission_key": "itsm_customers",
        "label": "고객 관리",
        "icon": "Building2",
        "path": "/admin/customers",
        "section": "basic",
        "sort_order": 200,
    },
    {
        "permission_key": "itsm_products",
        "label": "제품 관리",
        "icon": "Package",
        "path": "/admin/products",
        "section": "basic",
        "sort_order": 210,
    },
    {
        "permission_key": "itsm_sla_tiers",
        "label": "SLA 티어",
        "icon": "Gauge",
        "path": "/admin/sla-tiers",
        "section": "basic",
        "sort_order": 220,
    },
    {
        "permission_key": "itsm_contracts",
        "label": "계약 관리",
        "icon": "FileSignature",
        "path": "/admin/contracts",
        "section": "basic",
        "sort_order": 230,
    },
    {
        "permission_key": "itsm_scope_grants",
        "label": "접근 범위",
        "icon": "ShieldCheck",
        "path": "/admin/scope-grants",
        "section": "basic",
        "sort_order": 500,
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
                      'itsm_customers', 'itsm_products', 'itsm_sla_tiers',
                      'itsm_contracts', 'itsm_scope_grants'
                  )
                ON CONFLICT (permission_group_id, menu_item_id) DO NOTHING
                """
            ),
            {"app_id": APP_ID, "group_id": SYSTEM_ADMIN_GROUP_ID},
        )

        conn.commit()
        logger.info("a005: v-itsm v0.2 admin menus + system_admin grants registered")
