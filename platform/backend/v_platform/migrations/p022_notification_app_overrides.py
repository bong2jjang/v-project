"""Create notification_app_overrides table for per-app system notification toggle."""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_name='notification_app_overrides'"
            )
        )
        if result.fetchone():
            logger.info("Table notification_app_overrides already exists, skipping")
            conn.commit()
            return

        conn.execute(
            text(
                """
            CREATE TABLE notification_app_overrides (
                id SERIAL PRIMARY KEY,
                notification_id INTEGER NOT NULL
                    REFERENCES notifications(id) ON DELETE CASCADE,
                app_id VARCHAR(50) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """
            )
        )

        conn.execute(
            text(
                """
            CREATE UNIQUE INDEX uq_notification_app_override
            ON notification_app_overrides (notification_id, app_id)
        """
            )
        )

        conn.commit()
        logger.info(
            "Migration p022 completed: notification_app_overrides table created"
        )
