"""Replace localhost with 127.0.0.1 in existing data.

WSL 환경에서 localhost가 IPv6로 해석되어 연결 문제를 일으킬 수 있으므로
기존 데이터의 localhost 참조를 127.0.0.1로 변환합니다.
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        # system_settings: manual_url
        result = conn.execute(
            text(
                """
                UPDATE system_settings
                SET manual_url = REPLACE(manual_url, 'localhost', '127.0.0.1')
                WHERE manual_url LIKE '%localhost%'
                """
            )
        )
        logger.info(
            "p024: system_settings.manual_url updated (%d rows)", result.rowcount
        )

        # system_settings: support_url
        result = conn.execute(
            text(
                """
                UPDATE system_settings
                SET support_url = REPLACE(support_url, 'localhost', '127.0.0.1')
                WHERE support_url LIKE '%localhost%'
                """
            )
        )
        if result.rowcount:
            logger.info(
                "p024: system_settings.support_url updated (%d rows)", result.rowcount
            )

        # system_settings: app_logo_url
        result = conn.execute(
            text(
                """
                UPDATE system_settings
                SET app_logo_url = REPLACE(app_logo_url, 'localhost', '127.0.0.1')
                WHERE app_logo_url LIKE '%localhost%'
                """
            )
        )
        if result.rowcount:
            logger.info(
                "p024: system_settings.app_logo_url updated (%d rows)", result.rowcount
            )

        conn.commit()
        logger.info("p024: localhost → 127.0.0.1 migration completed")
