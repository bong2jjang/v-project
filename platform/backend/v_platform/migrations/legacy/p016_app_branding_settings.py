"""Add app branding columns to system_settings: app_title, app_description, app_logo_url"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        for col, col_type in [
            ("app_title", "VARCHAR(200)"),
            ("app_description", "VARCHAR(500)"),
            ("app_logo_url", "VARCHAR(500)"),
        ]:
            result = conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    f"WHERE table_name='system_settings' AND column_name='{col}'"
                )
            )
            if not result.fetchone():
                conn.execute(
                    text(f"ALTER TABLE system_settings ADD COLUMN {col} {col_type}")
                )
                logger.info(f"Added {col} to system_settings")

        conn.commit()
        logger.info("Migration p016 completed: app branding settings")
