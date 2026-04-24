"""
Migration: users 테이블에 theme, color_preset 컬럼 추가

사용자별 테마 설정을 DB에 저장할 수 있도록 합니다.
- theme: "light" | "dark" | "system" (기본값: "system")
- color_preset: "blue" | "indigo" | "rose" (기본값: "blue")

Usage:
    docker exec vms-channel-bridge-backend python migrations/022_user_theme_settings.py
"""

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migration():
    """users 테이블에 theme, color_preset 컬럼 추가"""
    from sqlalchemy import text

    from v_platform.core.database import engine

    logger.info("Starting migration: add theme, color_preset to users")

    with engine.connect() as conn:
        # theme 컬럼
        result = conn.execute(
            text(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'theme'
            """
            )
        )
        if result.fetchone():
            logger.info("Column 'theme' already exists — skipping")
        else:
            conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN theme VARCHAR(20) NOT NULL DEFAULT 'system'
                """
                )
            )
            logger.info("Column 'theme' added")

        # color_preset 컬럼
        result = conn.execute(
            text(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'color_preset'
            """
            )
        )
        if result.fetchone():
            logger.info("Column 'color_preset' already exists — skipping")
        else:
            conn.execute(
                text(
                    """
                    ALTER TABLE users
                    ADD COLUMN color_preset VARCHAR(20) NOT NULL DEFAULT 'blue'
                """
                )
            )
            logger.info("Column 'color_preset' added")

        conn.commit()
        logger.info("Migration completed: theme, color_preset columns added to users")


if __name__ == "__main__":
    run_migration()
