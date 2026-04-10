"""007: 사용자별 OAuth 토큰 테이블 추가

사용자가 자신의 플랫폼 계정(MS, Slack)을 독립적으로 연결할 수 있도록
user_oauth_tokens 테이블을 생성합니다.

기존 Account.ms_refresh_token 데이터가 있으면 user_oauth_tokens로 이전합니다.
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine) -> bool:
    """마이그레이션 실행"""
    try:
        with engine.connect() as conn:
            # 1. user_oauth_tokens 테이블 생성
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS user_oauth_tokens (
                        id            SERIAL PRIMARY KEY,
                        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        account_id    INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                        platform      VARCHAR(50) NOT NULL,

                        access_token  TEXT,
                        refresh_token TEXT NOT NULL,
                        token_expires_at TIMESTAMP,

                        platform_user_id   VARCHAR(255),
                        platform_user_name VARCHAR(255),
                        platform_email     VARCHAR(255),

                        scopes        TEXT,
                        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
                        last_used_at  TIMESTAMP,

                        UNIQUE(user_id, account_id)
                    )
                """
                )
            )
            logger.info("Created user_oauth_tokens table")

            # 2. 인덱스 생성
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_user_oauth_user "
                    "ON user_oauth_tokens(user_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_user_oauth_account "
                    "ON user_oauth_tokens(account_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_user_oauth_platform "
                    "ON user_oauth_tokens(platform)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_user_oauth_active "
                    "ON user_oauth_tokens(is_active)"
                )
            )
            logger.info("Created indexes on user_oauth_tokens")

            # 3. 기존 Account.ms_refresh_token 데이터 이전
            # Account.updated_by 사용자 기준으로 user_oauth_tokens에 복사
            result = conn.execute(
                text(
                    """
                    INSERT INTO user_oauth_tokens
                        (user_id, account_id, platform, refresh_token,
                         token_expires_at, platform_user_id, platform_email,
                         is_active, created_at, updated_at)
                    SELECT
                        a.updated_by,
                        a.id,
                        'teams',
                        a.ms_refresh_token,
                        a.ms_token_expires_at,
                        a.ms_user_id,
                        a.ms_user_id,
                        TRUE,
                        NOW(),
                        NOW()
                    FROM accounts a
                    WHERE a.ms_refresh_token IS NOT NULL
                      AND a.updated_by IS NOT NULL
                      AND NOT EXISTS (
                          SELECT 1 FROM user_oauth_tokens uot
                          WHERE uot.user_id = a.updated_by
                            AND uot.account_id = a.id
                      )
                """
                )
            )
            migrated = result.rowcount
            if migrated > 0:
                logger.info(
                    f"Migrated {migrated} existing Account.ms_refresh_token "
                    f"to user_oauth_tokens"
                )

            conn.commit()
            logger.info("Migration 007 completed: user_oauth_tokens table created")
            return True

    except Exception as e:
        logger.error(f"Migration 007 failed: {e}", exc_info=True)
        return False
