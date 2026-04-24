"""p031: menu_items unique 인덱스에 path 포함.

기존 p019 는 unique(permission_key, COALESCE(app_id, '')) 였으나, 동일 앱에서
하나의 permission_key 를 다수의 경로(예: 대시보드 2종) 에 공유하려는
override-pattern 시나리오를 지원하기 위해 path 를 포함한 복합 unique 로 확장.

변경 후:
    uq_menu_items_key_app_path = unique(permission_key, COALESCE(app_id, ''), path)

기존 데이터는 모두 이 새 제약의 부분집합 → 마이그레이션 호환.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        conn.execute(text("DROP INDEX IF EXISTS uq_menu_items_key_app"))
        # 모델 Column(unique=True) 로부터 생성된 레거시 인덱스 — app-specific
        # entry 와 공통 entry 의 permission_key 공유를 막으므로 반드시 제거.
        conn.execute(text("DROP INDEX IF EXISTS uq_menu_items_permission_key"))
        conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_items_key_app_path
                ON menu_items (permission_key, COALESCE(app_id, ''), path)
                """
            )
        )
        conn.commit()
        logger.info(
            "p031: dropped legacy uq_menu_items_permission_key; "
            "menu_items unique(permission_key, app_id) → "
            "unique(permission_key, app_id, path)"
        )
