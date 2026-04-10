"""
Migration: system_settings에 default_start_page 컬럼 추가
          users.start_page 기본값을 "/" → "" 로 변경

시스템 레벨 기본 시작 페이지 설정 기능 지원.
사용자 start_page가 빈 문자열이면 시스템 기본값을 사용합니다.

우선순위: 사용자 설정 > 시스템 기본값 > "/"

Usage:
    docker exec vms-chatops-backend python migrations/021_system_default_start_page.py
"""

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migration():
    """system_settings에 default_start_page 추가, users.start_page 기본값 변경"""
    from sqlalchemy import text

    from v_platform.core.database import engine

    logger.info("Starting migration: system default_start_page")

    with engine.connect() as conn:
        # 1) system_settings에 default_start_page 컬럼 추가
        result = conn.execute(
            text(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'system_settings' AND column_name = 'default_start_page'
            """
            )
        )
        if result.fetchone():
            logger.info(
                "Column 'default_start_page' already exists in system_settings — skipping"
            )
        else:
            conn.execute(
                text(
                    """
                    ALTER TABLE system_settings
                    ADD COLUMN default_start_page VARCHAR(255) NOT NULL DEFAULT '/'
                """
                )
            )
            logger.info("Added default_start_page column to system_settings")

        # 2) users.start_page 기본값을 빈 문자열로 변경
        conn.execute(
            text(
                """
                ALTER TABLE users
                ALTER COLUMN start_page SET DEFAULT ''
            """
            )
        )
        logger.info("Changed users.start_page default to empty string")

        # 3) 기존 사용자 중 "/" (기본값)인 경우 빈 문자열로 변경
        #    → 시스템 기본값을 따르도록
        result = conn.execute(
            text(
                """
                UPDATE users SET start_page = '' WHERE start_page = '/'
            """
            )
        )
        logger.info(
            f"Updated {result.rowcount} users: start_page '/' → '' (use system default)"
        )

        conn.commit()
        logger.info("Migration completed: system default_start_page")


if __name__ == "__main__":
    run_migration()
