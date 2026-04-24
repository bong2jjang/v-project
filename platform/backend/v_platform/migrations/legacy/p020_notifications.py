"""Create notifications and notification_reads tables."""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        # notifications table
        result = conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_name='notifications' AND table_schema='public'"
            )
        )
        if not result.fetchone():
            conn.execute(
                text(
                    """
                CREATE TABLE notifications (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(200) NOT NULL,
                    message TEXT NOT NULL,
                    severity VARCHAR(20) NOT NULL DEFAULT 'info',
                    category VARCHAR(50) NOT NULL DEFAULT 'system',
                    scope VARCHAR(20) NOT NULL DEFAULT 'app',
                    app_id VARCHAR(50),
                    target_role VARCHAR(50),
                    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    source VARCHAR(100),
                    link VARCHAR(500),
                    metadata JSONB,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    expires_at TIMESTAMP WITH TIME ZONE,
                    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                )
            """
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX idx_notifications_scope_app ON notifications(scope, app_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX idx_notifications_active_created ON notifications(is_active, created_at DESC)"
                )
            )
            logger.info("Created notifications table")

        # notification_reads table
        result = conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_name='notification_reads' AND table_schema='public'"
            )
        )
        if not result.fetchone():
            conn.execute(
                text(
                    """
                CREATE TABLE notification_reads (
                    id SERIAL PRIMARY KEY,
                    notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                )
            """
                )
            )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX uq_notification_user_read ON notification_reads(notification_id, user_id)"
                )
            )
            logger.info("Created notification_reads table")

        conn.commit()
        logger.info("Migration p020 completed: notifications system")
