"""Add app_id to permission_groups for per-app role management.

user_permissions and user_group_memberships don't need app_id because:
- user_permissions are tied to menu_items (already app-scoped)
- user_group_memberships are tied to permission_groups (now app-scoped)
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        # permission_groups.app_id
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='permission_groups' AND column_name='app_id'"
        ))
        if not result.fetchone():
            conn.execute(text(
                "ALTER TABLE permission_groups ADD COLUMN app_id VARCHAR(50)"
            ))
            conn.execute(text(
                "CREATE INDEX idx_permission_groups_app_id ON permission_groups(app_id)"
            ))
            logger.info("Added app_id to permission_groups")

        conn.commit()
        logger.info("Migration p017 completed: app_id on permission_groups")
