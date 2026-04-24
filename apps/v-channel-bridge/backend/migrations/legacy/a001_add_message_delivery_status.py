"""
Migration: Add delivery status tracking to messages table

This migration adds status, error_message, retry_count, and delivered_at
columns to the messages table for tracking message delivery status.

Usage:
    docker exec vms-channel-bridge-backend python migrations/001_add_message_delivery_status.py
"""

import logging
import sys
from pathlib import Path

# Add parent directory to path so app imports work when run as a script
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migration():
    """Run the migration to add delivery status columns"""
    from sqlalchemy import text

    from app.db.database import engine

    logger.info("Starting migration: Add delivery status tracking")

    with engine.connect() as conn:
        try:
            # Start transaction
            trans = conn.begin()

            # Check if columns already exist
            logger.info("Checking if columns already exist...")
            check_sql = text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'messages'
                AND column_name IN ('status', 'error_message', 'retry_count', 'delivered_at')
            """
            )
            existing_columns = [row[0] for row in conn.execute(check_sql)]

            if existing_columns:
                logger.warning(f"Columns already exist: {existing_columns}")
                logger.info("Skipping migration - columns already present")
                trans.rollback()
                return

            # Add status column
            logger.info("Adding 'status' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages
                ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'
            """
                )
            )

            # Add error_message column
            logger.info("Adding 'error_message' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages
                ADD COLUMN error_message TEXT
            """
                )
            )

            # Add retry_count column
            logger.info("Adding 'retry_count' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages
                ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0
            """
                )
            )

            # Add delivered_at column
            logger.info("Adding 'delivered_at' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages
                ADD COLUMN delivered_at TIMESTAMP
            """
                )
            )

            # Update existing messages to 'sent' status (assume they were successfully delivered)
            logger.info("Updating existing messages status to 'sent'...")
            conn.execute(
                text(
                    """
                UPDATE messages
                SET status = 'sent',
                    delivered_at = created_at
                WHERE status = 'pending'
            """
                )
            )

            # Create index on status column
            logger.info("Creating index on 'status' column...")
            conn.execute(
                text(
                    """
                CREATE INDEX idx_status ON messages(status)
            """
                )
            )

            # Commit transaction
            trans.commit()

            logger.info("✅ Migration completed successfully")
            logger.info("Summary:")
            logger.info("  - Added 'status' column (VARCHAR(20), default='pending')")
            logger.info("  - Added 'error_message' column (TEXT)")
            logger.info("  - Added 'retry_count' column (INTEGER, default=0)")
            logger.info("  - Added 'delivered_at' column (TIMESTAMP)")
            logger.info("  - Created index 'idx_status' on status column")
            logger.info("  - Updated existing messages to status='sent'")

        except Exception as e:
            logger.error(f"❌ Migration failed: {str(e)}")
            trans.rollback()
            raise


def rollback_migration():
    """Rollback the migration (remove columns)"""
    from sqlalchemy import text

    from app.db.database import engine

    logger.info("Starting migration rollback: Remove delivery status tracking")

    with engine.connect() as conn:
        try:
            trans = conn.begin()

            # Drop index
            logger.info("Dropping index 'idx_status'...")
            conn.execute(
                text(
                    """
                DROP INDEX IF EXISTS idx_status
            """
                )
            )

            # Drop columns
            logger.info("Dropping 'delivered_at' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages DROP COLUMN IF EXISTS delivered_at
            """
                )
            )

            logger.info("Dropping 'retry_count' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages DROP COLUMN IF EXISTS retry_count
            """
                )
            )

            logger.info("Dropping 'error_message' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages DROP COLUMN IF EXISTS error_message
            """
                )
            )

            logger.info("Dropping 'status' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages DROP COLUMN IF EXISTS status
            """
                )
            )

            trans.commit()

            logger.info("✅ Migration rollback completed successfully")

        except Exception as e:
            logger.error(f"❌ Migration rollback failed: {str(e)}")
            trans.rollback()
            raise


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Message delivery status migration")
    parser.add_argument(
        "--rollback", action="store_true", help="Rollback the migration"
    )

    args = parser.parse_args()

    if args.rollback:
        rollback_migration()
    else:
        run_migration()
