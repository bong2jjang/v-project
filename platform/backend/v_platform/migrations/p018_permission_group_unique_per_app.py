"""Change permission_groups unique constraint from (name) to (name, app_id).

Allows different apps to have groups with the same name.
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        # Drop old unique constraint on name only
        # PostgreSQL: find constraint name first
        result = conn.execute(text("""
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name = 'permission_groups'
              AND constraint_type = 'UNIQUE'
              AND constraint_name LIKE '%name%'
        """))
        for row in result.fetchall():
            constraint_name = row[0]
            conn.execute(text(
                f"ALTER TABLE permission_groups DROP CONSTRAINT IF EXISTS {constraint_name}"
            ))
            logger.info(f"Dropped unique constraint: {constraint_name}")

        # Also try the default naming pattern
        conn.execute(text(
            "ALTER TABLE permission_groups DROP CONSTRAINT IF EXISTS permission_groups_name_key"
        ))

        # Create new composite unique constraint (name + COALESCE(app_id, ''))
        # This allows same name in different apps, but not duplicate within same app
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_permission_groups_name_app
            ON permission_groups (name, COALESCE(app_id, ''))
        """))
        logger.info("Created composite unique index: uq_permission_groups_name_app")

        conn.commit()
        logger.info("Migration p018 completed: permission_groups unique per app")
