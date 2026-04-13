"""
Migration: Add channel name columns to messages table

Adds source/destination channel name columns for human-readable channel display
in message history filters and UI.

Fields added:
- source_channel_name: Display name of source channel (e.g. "general", "dev-team")
- destination_channel_name: Display name of destination channel

Usage:
    docker exec vms-channel-bridge-backend python migrations/004_add_channel_names.py
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))  # noqa: E402

from sqlalchemy import text  # noqa: E402
from app.db.database import engine  # noqa: E402
import logging  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def upgrade():
    """Add source_channel_name and destination_channel_name columns"""
    with engine.connect() as conn:
        # Check if columns already exist
        result = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'messages' AND column_name = 'source_channel_name'"
            )
        )
        if result.fetchone():
            logger.info("source_channel_name column already exists, skipping")
            return

        logger.info("Adding source_channel_name column...")
        conn.execute(
            text("ALTER TABLE messages ADD COLUMN source_channel_name VARCHAR(255)")
        )

        logger.info("Adding destination_channel_name column...")
        conn.execute(
            text(
                "ALTER TABLE messages ADD COLUMN destination_channel_name VARCHAR(255)"
            )
        )

        conn.commit()
        logger.info("Migration 004 completed successfully")


if __name__ == "__main__":
    upgrade()
