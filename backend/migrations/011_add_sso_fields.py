"""
Migration 011: 사용자 SSO 연동 필드 추가

사용자 테이블에 SSO Provider 연동을 위한 필드를 추가합니다.
- sso_provider: SSO Provider 식별자 (e.g., "microsoft", "corporate_sso")
- sso_provider_id: SSO Provider 측 고유 사용자 ID
- auth_method: 인증 방식 ("local" | "sso" | "hybrid")
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine) -> bool:
    """마이그레이션 실행"""
    try:
        with engine.connect() as conn:
            for col, col_type, default in [
                ("sso_provider", "VARCHAR(50)", None),
                ("sso_provider_id", "VARCHAR(255)", None),
                ("auth_method", "VARCHAR(20)", "'local'"),
            ]:
                result = conn.execute(
                    text(
                        """
                        SELECT column_name FROM information_schema.columns
                        WHERE table_name = 'users' AND column_name = :col
                        """
                    ),
                    {"col": col},
                )
                if not result.fetchone():
                    default_clause = f" DEFAULT {default}" if default else ""
                    conn.execute(
                        text(
                            f"ALTER TABLE users ADD COLUMN {col} {col_type}{default_clause}"
                        )
                    )

            # 기존 사용자 모두 local로 설정
            conn.execute(
                text("UPDATE users SET auth_method = 'local' WHERE auth_method IS NULL")
            )

            conn.commit()
            logger.info("Migration 011 completed: SSO fields added to users")
            return True

    except Exception as e:
        logger.error(f"Migration 011 failed: {e}")
        return False
