"""p034: 플랫폼 공통 관리자 메뉴 그룹 정리.

기능 추가가 아닌 **데이터 재구성** — p001/p007 이 등록해둔 관리자 메뉴 7개를
시나리오별 menu_group 으로 묶는다.

그룹 구성 (모두 section='admin')
---------------------------------
platform_group_admin        "관리자 콘솔"   (organizations / users / permission_groups /
                                             permission_management / menu_management)
platform_group_observability "감사 & 모니터링" (audit_logs / monitoring)

`settings` 는 Sidebar 하단 톱니 아이콘으로 별도 렌더되므로 그룹화 대상 아님.
`integrations` (v-channel-bridge 전용) 는 bridge 앱 스코프이므로 플랫폼 공통 그룹에 포함하지 않음.

레거시 청소
-----------
p001 단계에서 `users/audit_logs/monitoring/menu_management/permission_management` 가
`parent_key='admin'` 문자열을 들고 있었다 (p003 이후 `section` 컬럼으로 승격되었지만
parent_key 값은 정리되지 않음). Sidebar 의 그룹 nesting 은 menu_type='menu_group' 인
로우만 parent 로 인식하므로 실제 렌더에는 영향이 없으나, 본 마이그레이션에서
올바른 group key 로 재할당하여 잔재를 제거한다.

멱등 보장
---------
  - 그룹 생성: WHERE NOT EXISTS (permission_key + app_id IS NULL 기준)
  - 자식 재배치: UPDATE parent_key + section='admin' + sort_order
  - 재실행해도 안정.

참고: `menu_type='menu_group'` 은 `path` 가 NOT NULL 이므로 `#<key>` 형태의 더미값 사용.
        Sidebar.tsx 는 parent_key/menu_type 으로 자식을 nesting, 더미 path 는 클릭되지 않음.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


GROUP_ROWS: list[dict] = [
    {
        "permission_key": "platform_group_admin",
        "label": "관리자 콘솔",
        "icon": "ShieldCheck",
        "section": "admin",
        "sort_order": 700,
    },
    {
        "permission_key": "platform_group_observability",
        "label": "감사 & 모니터링",
        "icon": "Activity",
        "section": "admin",
        "sort_order": 1150,
    },
]


# (permission_key, parent_key, sort_order)
# 모두 section='admin' 으로 통일 (그룹이 admin 섹션에 있으므로 자식 표시 위치는 그룹 규칙 따름).
CHILD_REASSIGN: list[tuple[str, str, int]] = [
    # 관리자 콘솔
    ("organizations",          "platform_group_admin", 710),
    ("users",                  "platform_group_admin", 720),
    ("permission_groups",      "platform_group_admin", 730),
    ("permission_management",  "platform_group_admin", 740),
    ("menu_management",        "platform_group_admin", 750),

    # 감사 & 모니터링
    ("audit_logs",             "platform_group_observability", 1160),
    ("monitoring",             "platform_group_observability", 1170),
]


INSERT_GROUP_SQL = """
INSERT INTO menu_items
    (permission_key, label, icon, path, sort_order,
     app_id, is_active, menu_type, section, parent_key,
     created_at, updated_at)
SELECT :pkey, :label, :icon, :path, :sort_order,
       NULL, TRUE, 'menu_group', :section, NULL,
       NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM menu_items
    WHERE permission_key = :pkey AND app_id IS NULL
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
 WHERE permission_key = :pkey AND app_id IS NULL
"""

UPDATE_CHILD_SQL = """
UPDATE menu_items
   SET parent_key = :parent_key,
       section = 'admin',
       sort_order = :sort_order,
       updated_at = NOW()
 WHERE permission_key = :pkey AND app_id IS NULL
"""


def migrate(engine):
    with engine.connect() as conn:
        # 1) 그룹 행 멱등 upsert
        for g in GROUP_ROWS:
            params = {
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
        for pkey, parent_key, sort_order in CHILD_REASSIGN:
            conn.execute(
                text(UPDATE_CHILD_SQL),
                {
                    "pkey": pkey,
                    "parent_key": parent_key,
                    "sort_order": sort_order,
                },
            )

        conn.commit()

    logger.info(
        "p034: platform admin menus grouped "
        "(platform_group_admin: 5 items, platform_group_observability: 2 items)"
    )
