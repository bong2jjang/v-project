"""Fix unique constraints to allow same names in different apps.

menu_items.permission_key: unique per app (not globally)
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        # menu_items.permission_key: unique → unique per (permission_key, app_id)
        conn.execute(text(
            "DROP INDEX IF EXISTS ix_menu_items_permission_key"
        ))
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_items_key_app
            ON menu_items (permission_key, COALESCE(app_id, ''))
        """))
        logger.info("menu_items: unique(permission_key) → unique(permission_key, app_id)")

        conn.commit()
        logger.info("Migration p019 completed: unique constraints per app")
