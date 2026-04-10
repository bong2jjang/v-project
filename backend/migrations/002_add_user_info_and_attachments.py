"""
Migration: Add user info and attachment details to messages table

This migration adds sender information and attachment tracking columns
for better chat experience and message history.

Fields added:
- source_user_name: Username of the sender
- source_user_display_name: Display name of the sender
- attachment_details: JSON field for attachment metadata
- message_format: Message format type (text, markdown, code, etc.)

Usage:
    docker exec vms-chatops-backend python migrations/002_add_user_info_and_attachments.py
"""

import logging
import sys
from pathlib import Path

# Add parent directory to path so app imports work when run as a script
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migration():
    """Run the migration to add user info and attachment fields"""
    from sqlalchemy import text

    from app.db.database import engine

    logger.info("Starting migration: Add user info and attachment details")

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
                AND column_name IN ('source_user_name', 'source_user_display_name',
                                     'attachment_details', 'message_format')
            """
            )
            existing_columns = [row[0] for row in conn.execute(check_sql)]

            if existing_columns:
                logger.warning(f"Columns already exist: {existing_columns}")
                logger.info("Skipping migration - columns already present")
                trans.rollback()
                return

            # Add source_user_name column
            logger.info("Adding 'source_user_name' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages
                ADD COLUMN source_user_name VARCHAR(255)
            """
                )
            )

            # Add source_user_display_name column
            logger.info("Adding 'source_user_display_name' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages
                ADD COLUMN source_user_display_name VARCHAR(255)
            """
                )
            )

            # Add attachment_details column
            logger.info("Adding 'attachment_details' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages
                ADD COLUMN attachment_details JSON
            """
                )
            )

            # Add message_format column
            logger.info("Adding 'message_format' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages
                ADD COLUMN message_format VARCHAR(50) DEFAULT 'text'
            """
                )
            )

            # Update existing messages to have default message_format
            logger.info("Setting default 'message_format' for existing messages...")
            conn.execute(
                text(
                    """
                UPDATE messages
                SET message_format = 'text'
                WHERE message_format IS NULL
            """
                )
            )

            # Create indexes
            logger.info("Creating index on 'source_user_name' column...")
            conn.execute(
                text(
                    """
                CREATE INDEX idx_source_user_name ON messages(source_user_name)
            """
                )
            )

            logger.info("Creating index on 'source_user_display_name' column...")
            conn.execute(
                text(
                    """
                CREATE INDEX idx_source_user_display_name ON messages(source_user_display_name)
            """
                )
            )

            # Commit transaction
            trans.commit()

            logger.info("✅ Migration completed successfully")
            logger.info("Summary:")
            logger.info("  - Added 'source_user_name' column (VARCHAR(255))")
            logger.info("  - Added 'source_user_display_name' column (VARCHAR(255))")
            logger.info("  - Added 'attachment_details' column (JSON)")
            logger.info(
                "  - Added 'message_format' column (VARCHAR(50), default='text')"
            )
            logger.info("  - Created index 'idx_source_user_name'")
            logger.info("  - Created index 'idx_source_user_display_name'")
            logger.info("  - Updated existing messages with default format")

        except Exception as e:
            logger.error(f"❌ Migration failed: {str(e)}")
            trans.rollback()
            raise


def rollback_migration():
    """Rollback the migration (remove columns and indexes)"""
    from sqlalchemy import text

    from app.db.database import engine

    logger.info("Starting migration rollback: Remove user info and attachment details")

    with engine.connect() as conn:
        try:
            trans = conn.begin()

            # Drop indexes
            logger.info("Dropping index 'idx_source_user_display_name'...")
            conn.execute(
                text(
                    """
                DROP INDEX IF EXISTS idx_source_user_display_name
            """
                )
            )

            logger.info("Dropping index 'idx_source_user_name'...")
            conn.execute(
                text(
                    """
                DROP INDEX IF EXISTS idx_source_user_name
            """
                )
            )

            # Drop columns
            logger.info("Dropping 'message_format' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages DROP COLUMN IF EXISTS message_format
            """
                )
            )

            logger.info("Dropping 'attachment_details' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages DROP COLUMN IF EXISTS attachment_details
            """
                )
            )

            logger.info("Dropping 'source_user_display_name' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages DROP COLUMN IF EXISTS source_user_display_name
            """
                )
            )

            logger.info("Dropping 'source_user_name' column...")
            conn.execute(
                text(
                    """
                ALTER TABLE messages DROP COLUMN IF EXISTS source_user_name
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

    parser = argparse.ArgumentParser(description="User info and attachments migration")
    parser.add_argument(
        "--rollback", action="store_true", help="Rollback the migration"
    )

    args = parser.parse_args()

    if args.rollback:
        rollback_migration()
    else:
        run_migration()
