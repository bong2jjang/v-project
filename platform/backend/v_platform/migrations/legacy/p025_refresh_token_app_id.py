"""Add app_id column to refresh_tokens for login source tracking.

디바이스 목록은 전역(per-user) 기준으로 유지하되, 각 refresh token이
어느 앱을 통해 발급됐는지 표시할 수 있도록 nullable 컬럼을 추가합니다.

필터링 용도가 아니라 UI 표시 용도입니다.
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        # 컬럼이 이미 존재하는지 확인 (idempotent)
        result = conn.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'refresh_tokens' AND column_name = 'app_id'
                """
            )
        ).fetchone()

        if result is None:
            conn.execute(
                text("ALTER TABLE refresh_tokens ADD COLUMN app_id VARCHAR(64)")
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_refresh_tokens_app_id "
                    "ON refresh_tokens (app_id)"
                )
            )
            conn.commit()
            logger.info("p025: refresh_tokens.app_id column added")
        else:
            logger.info("p025: refresh_tokens.app_id already exists, skipping")
