"""
Migration: Add enabled_features column to accounts table

This migration adds the enabled_features column for per-account feature selection.
NULL = all features active (backward compatible).

Usage:
    docker exec vms-chatops-backend python migrations/003_add_account_enabled_features.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text  # noqa: E402
from app.db.database import engine  # noqa: E402
import logging  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migration():
    """Run the migration to add enabled_features column to accounts"""

    logger.info("Starting migration: Add enabled_features to accounts")

    with engine.connect() as conn:
        try:
            trans = conn.begin()

            # Check if column already exists
            check_sql = text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'accounts'
                AND column_name = 'enabled_features'
            """
            )
            existing = [row[0] for row in conn.execute(check_sql)]

            if existing:
                logger.info("Column 'enabled_features' already exists — skipping")
                trans.rollback()
                return

            logger.info("Adding 'enabled_features' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE accounts
                ADD COLUMN enabled_features TEXT NULL
            """
                )
            )

            trans.commit()

            logger.info("✅ Migration completed successfully")
            logger.info("  - Added 'enabled_features' column (TEXT, nullable)")
            logger.info("  - NULL = all features active (backward compatible)")

        except Exception as e:
            trans.rollback()
            logger.error(f"❌ Migration failed: {e}")
            raise


if __name__ == "__main__":
    run_migration()
