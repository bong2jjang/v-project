"""
Migration: messages.message_id UNIQUE 제약 제거

동일 source 메시지가 여러 target 채널로 라우팅될 때
각각 별도 레코드로 저장되어야 합니다.
UNIQUE 제약을 일반 INDEX로 변경합니다.

Usage:
    docker exec vms-channel-bridge-backend python migrations/019_message_id_drop_unique.py
"""

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migration():
    """message_id UNIQUE 제약 제거 → 일반 INDEX"""
    from sqlalchemy import text

    from app.db.database import engine

    logger.info("Starting migration: drop UNIQUE on messages.message_id")

    with engine.connect() as conn:
        try:
            trans = conn.begin()

            # 기존 unique constraint/index 확인 및 제거
            # PostgreSQL에서 unique=True 컬럼은 자동으로 unique index가 생성됨
            constraints = conn.execute(
                text(
                    """
                    SELECT conname FROM pg_constraint
                    WHERE conrelid = 'messages'::regclass
                    AND contype = 'u'
                    AND array_to_string(conkey, ',') = (
                        SELECT attnum::text FROM pg_attribute
                        WHERE attrelid = 'messages'::regclass
                        AND attname = 'message_id'
                    )
                """
                )
            ).fetchall()

            for (conname,) in constraints:
                logger.info(f"Dropping unique constraint: {conname}")
                conn.execute(text(f"ALTER TABLE messages DROP CONSTRAINT {conname}"))

            # unique index도 확인하여 제거
            indexes = conn.execute(
                text(
                    """
                    SELECT indexname FROM pg_indexes
                    WHERE tablename = 'messages'
                    AND indexdef LIKE '%UNIQUE%'
                    AND indexdef LIKE '%message_id%'
                """
                )
            ).fetchall()

            for (indexname,) in indexes:
                logger.info(f"Dropping unique index: {indexname}")
                conn.execute(text(f"DROP INDEX IF EXISTS {indexname}"))

            # 일반 인덱스 생성 (조회 성능 유지)
            conn.execute(
                text(
                    """
                    CREATE INDEX IF NOT EXISTS ix_messages_message_id
                    ON messages (message_id)
                """
                )
            )

            trans.commit()
            logger.info("Migration completed successfully")

        except Exception as e:
            logger.error(f"Migration failed: {str(e)}")
            trans.rollback()
            raise


def rollback_migration():
    """롤백: message_id UNIQUE 제약 복원"""
    from sqlalchemy import text

    from app.db.database import engine

    logger.info("Starting rollback: restore UNIQUE on messages.message_id")

    with engine.connect() as conn:
        try:
            trans = conn.begin()

            # 중복 데이터가 있으면 롤백 불가하므로 확인
            dupes = conn.execute(
                text(
                    """
                    SELECT message_id, COUNT(*) FROM messages
                    WHERE message_id IS NOT NULL
                    GROUP BY message_id HAVING COUNT(*) > 1
                """
                )
            ).fetchall()

            if dupes:
                logger.error(
                    f"Cannot rollback: {len(dupes)} duplicate message_ids exist"
                )
                raise ValueError("Duplicate message_ids prevent UNIQUE restore")

            conn.execute(text("DROP INDEX IF EXISTS ix_messages_message_id"))
            conn.execute(
                text(
                    """
                    ALTER TABLE messages
                    ADD CONSTRAINT uq_messages_message_id UNIQUE (message_id)
                """
                )
            )

            trans.commit()
            logger.info("Rollback completed successfully")

        except Exception as e:
            logger.error(f"Rollback failed: {str(e)}")
            trans.rollback()
            raise


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Drop UNIQUE constraint on messages.message_id"
    )
    parser.add_argument(
        "--rollback", action="store_true", help="Rollback the migration"
    )

    args = parser.parse_args()

    if args.rollback:
        rollback_migration()
    else:
        run_migration()
