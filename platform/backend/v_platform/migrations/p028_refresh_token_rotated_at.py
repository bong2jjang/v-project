"""Add revoked_at column to refresh_tokens for token rotation grace period.

Refresh token 재사용 감지(verify_refresh_token)가 race condition(멀티탭 동시 refresh,
네트워크 재시도)로 인한 정상적 재사용까지 공격으로 오인하고 모든 세션을 무효화하는
문제를 해결하기 위해, 토큰이 rotate된 시각을 기록합니다.

검증 로직에서는 revoked_at이 최근(예: 10초 이내)이면 방금 rotate된 것으로 보고
revoke_all_tokens를 건너뛰고 "Token recently rotated" 에러만 반환합니다.

- nullable=True (기존 row는 NULL → 오래된 revoked로 간주, 유예 안 됨)
- index 없음 (WHERE 조건 아님, 단건 조회 시 비교만 수행)
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'refresh_tokens'
                  AND column_name = 'revoked_at'
                """
            )
        ).fetchone()

        if result is None:
            conn.execute(
                text(
                    "ALTER TABLE refresh_tokens "
                    "ADD COLUMN revoked_at TIMESTAMPTZ NULL"
                )
            )
            conn.commit()
            logger.info("p028: refresh_tokens.revoked_at column added")
        else:
            logger.info("p028: refresh_tokens.revoked_at already exists, skipping")
