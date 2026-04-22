"""p033: monitoring 메뉴를 플랫폼 공통(app_id=NULL)으로 재분류.

배경
----
v-channel-bridge 가 자신의 `app_menu_keys` 에 `"monitoring"` 을 넣어두어,
PlatformApp._classify_app_menus() 가 `menu_items.app_id` 를 `v-channel-bridge`
로 설정해두었다. 그러나 모니터링 백엔드/프런트엔드가 플랫폼으로 이관되면서
모든 앱(`/api/monitoring/*`)에서 동일 엔드포인트를 제공한다. 따라서 메뉴도
앱 경계를 벗어나 공통(`app_id=NULL`) 으로 되돌려 모든 앱 사이드바에 노출
되어야 한다.

본 마이그레이션은 `permission_key='monitoring'` 이면서 `app_id='v-channel-bridge'`
로 분류된 menu_items 행의 `app_id` 를 NULL 로 리셋한다.

멱등성: UPDATE … WHERE — 이미 NULL 이면 no-op.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                UPDATE menu_items
                SET app_id = NULL
                WHERE permission_key = 'monitoring'
                  AND app_id = 'v-channel-bridge'
                """
            )
        )
        conn.commit()
        logger.info(
            "p033: monitoring menu reclassified to common (rows=%d)",
            result.rowcount or 0,
        )
