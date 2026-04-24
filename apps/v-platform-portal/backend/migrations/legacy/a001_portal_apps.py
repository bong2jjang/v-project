"""Create portal_apps table for DB-backed app registry."""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_name='portal_apps'"
            )
        )
        if result.fetchone():
            logger.info("portal_apps table already exists, skipping")
            return

        conn.execute(
            text("""
                CREATE TABLE portal_apps (
                    id SERIAL PRIMARY KEY,
                    app_id VARCHAR(50) NOT NULL UNIQUE,
                    display_name VARCHAR(200) NOT NULL,
                    description TEXT DEFAULT '',
                    icon VARCHAR(50) DEFAULT 'Box',
                    frontend_url VARCHAR(500) NOT NULL,
                    api_url VARCHAR(500) NOT NULL,
                    health_endpoint VARCHAR(200) DEFAULT '/api/health',
                    sort_order INTEGER DEFAULT 0,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_by INTEGER,
                    updated_by INTEGER,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
        )
        conn.execute(
            text("CREATE INDEX idx_portal_apps_app_id ON portal_apps(app_id)")
        )
        conn.execute(
            text(
                "CREATE INDEX idx_portal_apps_is_active ON portal_apps(is_active)"
            )
        )
        conn.commit()
        logger.info("Migration a001: created portal_apps table")
