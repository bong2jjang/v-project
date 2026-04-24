"""Add delivery_type column to notifications table.

Values: toast (default), announcement, both
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='notifications' AND column_name='delivery_type'"
            )
        )
        if result.fetchone():
            logger.info("Column delivery_type already exists, skipping")
            conn.commit()
            return

        conn.execute(
            text(
                """
            ALTER TABLE notifications
            ADD COLUMN delivery_type VARCHAR(20) NOT NULL DEFAULT 'toast'
        """
            )
        )

        conn.commit()
        logger.info(
            "Migration p023 completed: delivery_type column added to notifications"
        )
