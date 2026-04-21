"""a008: v-itsm 기본 대시보드 메뉴 제거.

`/` 경로는 Loop 칸반으로 리다이렉트되도록 변경됨에 따라
중복된 `dashboard` 메뉴 항목을 제거한다.

멱등: 존재하지 않을 경우 silent no-op.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)

APP_ID = "v-itsm"


def migrate(engine):
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                DELETE FROM permission_group_grants
                WHERE menu_item_id IN (
                    SELECT id FROM menu_items
                    WHERE app_id = :app_id AND permission_key = 'dashboard'
                )
                """
            ),
            {"app_id": APP_ID},
        )

        result = conn.execute(
            text(
                """
                DELETE FROM menu_items
                WHERE app_id = :app_id AND permission_key = 'dashboard'
                """
            ),
            {"app_id": APP_ID},
        )

        conn.commit()
        logger.info(
            "a008: removed dashboard menu (%s row(s)) — / now redirects to /kanban",
            result.rowcount,
        )
