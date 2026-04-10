"""
Migration: TIMESTAMP → TIMESTAMP WITH TIME ZONE

모든 테이블의 DateTime 컬럼을 timezone-aware 타입(TIMESTAMPTZ)으로 변환합니다.
기존 naive UTC 값은 그대로 유지되며, PostgreSQL이 UTC 기준 TIMESTAMPTZ로 해석합니다.

Usage:
    docker exec vms-chatops-backend python migrations/018_datetime_to_timestamptz.py
"""

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 변환 대상 테이블·컬럼 목록
COLUMNS_TO_ALTER = [
    # messages / message_stats
    ("messages", "timestamp"),
    ("messages", "created_at"),
    ("messages", "delivered_at"),
    ("message_stats", "date"),
    ("message_stats", "updated_at"),
    # users
    ("users", "created_at"),
    ("users", "updated_at"),
    ("users", "last_login"),
    # accounts
    ("accounts", "created_at"),
    ("accounts", "updated_at"),
    # audit_logs
    ("audit_logs", "timestamp"),
    # companies
    ("companies", "created_at"),
    ("companies", "updated_at"),
    # departments
    ("departments", "created_at"),
    ("departments", "updated_at"),
    # refresh_tokens
    ("refresh_tokens", "expires_at"),
    ("refresh_tokens", "created_at"),
    ("refresh_tokens", "last_used_at"),
    # password_reset_tokens
    ("password_reset_tokens", "expires_at"),
    ("password_reset_tokens", "created_at"),
    ("password_reset_tokens", "used_at"),
    # accounts (OAuth timestamps)
    ("accounts", "ms_token_expires_at"),
    # user_oauth_tokens
    ("user_oauth_tokens", "token_expires_at"),
    ("user_oauth_tokens", "created_at"),
    ("user_oauth_tokens", "updated_at"),
    ("user_oauth_tokens", "last_used_at"),
    # menu_items
    ("menu_items", "created_at"),
    ("menu_items", "updated_at"),
    # user_permissions
    ("user_permissions", "created_at"),
    ("user_permissions", "updated_at"),
    # permission_groups
    ("permission_groups", "created_at"),
    ("permission_groups", "updated_at"),
    # user_group_memberships
    ("user_group_memberships", "created_at"),
]


def run_migration():
    """TIMESTAMP → TIMESTAMPTZ 마이그레이션 실행"""
    from sqlalchemy import text

    from v_platform.core.database import engine

    logger.info("Starting migration: TIMESTAMP → TIMESTAMPTZ")

    with engine.connect() as conn:
        try:
            trans = conn.begin()

            for table, column in COLUMNS_TO_ALTER:
                # 테이블 존재 여부 확인
                exists = conn.execute(
                    text(
                        """
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = :table AND column_name = :column
                    """
                    ),
                    {"table": table, "column": column},
                ).fetchone()

                if not exists:
                    logger.warning(f"Column {table}.{column} does not exist, skipping")
                    continue

                # 이미 TIMESTAMPTZ인지 확인
                dtype = conn.execute(
                    text(
                        """
                        SELECT data_type FROM information_schema.columns
                        WHERE table_name = :table AND column_name = :column
                    """
                    ),
                    {"table": table, "column": column},
                ).scalar()

                if dtype == "timestamp with time zone":
                    logger.info(f"{table}.{column} already TIMESTAMPTZ, skipping")
                    continue

                logger.info(f"Altering {table}.{column} → TIMESTAMPTZ ...")
                conn.execute(
                    text(
                        f"""
                        ALTER TABLE {table}
                        ALTER COLUMN {column}
                        TYPE TIMESTAMP WITH TIME ZONE
                        USING {column} AT TIME ZONE 'UTC'
                    """
                    )
                )

            trans.commit()
            logger.info("✅ Migration completed successfully")

        except Exception as e:
            logger.error(f"❌ Migration failed: {str(e)}")
            trans.rollback()
            raise


def rollback_migration():
    """TIMESTAMPTZ → TIMESTAMP 롤백"""
    from sqlalchemy import text

    from v_platform.core.database import engine

    logger.info("Starting rollback: TIMESTAMPTZ → TIMESTAMP")

    with engine.connect() as conn:
        try:
            trans = conn.begin()

            for table, column in COLUMNS_TO_ALTER:
                exists = conn.execute(
                    text(
                        """
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = :table AND column_name = :column
                    """
                    ),
                    {"table": table, "column": column},
                ).fetchone()

                if not exists:
                    continue

                logger.info(f"Reverting {table}.{column} → TIMESTAMP ...")
                conn.execute(
                    text(
                        f"""
                        ALTER TABLE {table}
                        ALTER COLUMN {column}
                        TYPE TIMESTAMP WITHOUT TIME ZONE
                    """
                    )
                )

            trans.commit()
            logger.info("✅ Rollback completed successfully")

        except Exception as e:
            logger.error(f"❌ Rollback failed: {str(e)}")
            trans.rollback()
            raise


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="TIMESTAMP → TIMESTAMPTZ migration")
    parser.add_argument(
        "--rollback", action="store_true", help="Rollback the migration"
    )

    args = parser.parse_args()

    if args.rollback:
        rollback_migration()
    else:
        run_migration()
