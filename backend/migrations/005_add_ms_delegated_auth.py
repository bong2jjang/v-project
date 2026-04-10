"""005: Account 테이블에 Microsoft Delegated Auth 필드 추가

Teams Provider에서 OAuth2 Authorization Code Flow로 획득한
delegated token을 저장하기 위한 컬럼을 추가합니다.

- ms_refresh_token: 암호화된 Microsoft refresh token
- ms_token_expires_at: delegated access token 만료 시간
- ms_user_id: 연결된 Microsoft 사용자 ID (표시용)
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine) -> bool:
    """마이그레이션 실행"""
    try:
        with engine.connect() as conn:
            # ms_refresh_token 컬럼 추가
            result = conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'accounts' AND column_name = 'ms_refresh_token'"
                )
            )
            if not result.fetchone():
                conn.execute(
                    text("ALTER TABLE accounts ADD COLUMN ms_refresh_token TEXT")
                )
                logger.info("Added ms_refresh_token column to accounts table")

            # ms_token_expires_at 컬럼 추가
            result = conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'accounts' AND column_name = 'ms_token_expires_at'"
                )
            )
            if not result.fetchone():
                conn.execute(
                    text(
                        "ALTER TABLE accounts ADD COLUMN ms_token_expires_at TIMESTAMP"
                    )
                )
                logger.info("Added ms_token_expires_at column to accounts table")

            # ms_user_id 컬럼 추가
            result = conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'accounts' AND column_name = 'ms_user_id'"
                )
            )
            if not result.fetchone():
                conn.execute(
                    text("ALTER TABLE accounts ADD COLUMN ms_user_id VARCHAR(255)")
                )
                logger.info("Added ms_user_id column to accounts table")

            conn.commit()
            logger.info("Migration 005 completed successfully")
            return True

    except Exception as e:
        logger.error(f"Migration 005 failed: {e}")
        return False
