"""Multi-app data isolation: add app_id to menu_items, audit_logs, system_settings"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        # menu_items.app_id
        result = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='menu_items' AND column_name='app_id'"
            )
        )
        if not result.fetchone():
            conn.execute(text("ALTER TABLE menu_items ADD COLUMN app_id VARCHAR(50)"))
            conn.execute(
                text("CREATE INDEX idx_menu_items_app_id ON menu_items(app_id)")
            )
            logger.info("Added app_id column to menu_items")

        # Always classify app menus (idempotent — safe to re-run)
        # This fixes the race condition where create_all() creates the column
        # before migration runs, causing the UPDATE to be skipped.
        conn.execute(
            text(
                """
                UPDATE menu_items SET app_id = 'v-channel-bridge'
                WHERE permission_key IN (
                    'channels', 'messages', 'statistics', 'integrations', 'monitoring',
                    'menu_group_mgtmonitor', 'menu_group01'
                ) AND app_id IS NULL
            """
            )
        )
        logger.info("Classified v-channel-bridge menus")

        # audit_logs.app_id
        result = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='audit_logs' AND column_name='app_id'"
            )
        )
        if not result.fetchone():
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN app_id VARCHAR(50)"))
            conn.execute(
                text("CREATE INDEX idx_audit_logs_app_id ON audit_logs(app_id)")
            )
            logger.info("Added app_id to audit_logs")

        # system_settings.app_id
        result = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='system_settings' AND column_name='app_id'"
            )
        )
        if not result.fetchone():
            conn.execute(
                text("ALTER TABLE system_settings ADD COLUMN app_id VARCHAR(50)")
            )
            logger.info("Added app_id to system_settings")

        conn.commit()
        logger.info("Migration p015 completed: multi-app data isolation")
