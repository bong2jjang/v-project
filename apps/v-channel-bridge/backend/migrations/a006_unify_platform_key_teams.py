"""006: Platform 키 통일 — 'msteams' → 'teams'

기존 DB에 'msteams'로 저장된 platform 값을 'teams'로 변경하고,
CheckConstraint도 업데이트합니다.
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine) -> bool:
    """마이그레이션 실행"""
    try:
        with engine.connect() as conn:
            # 1. platform 값 변경: 'msteams' → 'teams'
            result = conn.execute(
                text(
                    "UPDATE accounts SET platform = 'teams' "
                    "WHERE platform = 'msteams'"
                )
            )
            updated = result.rowcount
            logger.info(f"Updated {updated} accounts: platform 'msteams' → 'teams'")

            # 2. CheckConstraint 교체
            # 기존 constraint 삭제 (존재하는 경우)
            try:
                conn.execute(
                    text(
                        "ALTER TABLE accounts "
                        "DROP CONSTRAINT IF EXISTS account_platform_fields_check"
                    )
                )
            except Exception:
                logger.warning("Could not drop old constraint (may not exist)")

            # 새 constraint 추가
            conn.execute(
                text(
                    "ALTER TABLE accounts ADD CONSTRAINT account_platform_fields_check "
                    "CHECK ("
                    "(platform = 'slack' AND token IS NOT NULL) OR "
                    "(platform = 'teams' AND tenant_id IS NOT NULL AND app_id IS NOT NULL)"
                    ")"
                )
            )

            # 3. message_service 테스트 데이터도 업데이트
            result2 = conn.execute(
                text(
                    "UPDATE messages SET "
                    "source_account = REPLACE(source_account, 'msteams', 'teams'), "
                    "destination_account = REPLACE(destination_account, 'msteams', 'teams'), "
                    "gateway = REPLACE(gateway, 'msteams', 'teams'), "
                    "protocol = REPLACE(protocol, 'msteams', 'teams') "
                    "WHERE source_account LIKE '%msteams%' "
                    "OR destination_account LIKE '%msteams%' "
                    "OR gateway LIKE '%msteams%' "
                    "OR protocol LIKE '%msteams%'"
                )
            )
            msg_updated = result2.rowcount
            if msg_updated > 0:
                logger.info(f"Updated {msg_updated} messages: 'msteams' → 'teams'")

            conn.commit()
            logger.info("Migration 006 completed: platform key unified to 'teams'")
            return True

    except Exception as e:
        logger.error(f"Migration 006 failed: {e}", exc_info=True)
        return False
