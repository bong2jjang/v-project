"""
Migration: users 테이블에 start_page 컬럼 추가

로그인 시 시작 페이지를 사용자별로 설정할 수 있도록 합니다.
기본값은 "/" (대시보드).

Usage:
    docker exec vms-chatops-backend python migrations/020_user_start_page.py
"""

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migration():
    """users 테이블에 start_page 컬럼 추가"""
    from sqlalchemy import text

    from app.db.database import engine

    logger.info("Starting migration: add start_page to users")

    with engine.connect() as conn:
        # 컬럼 존재 여부 확인
        result = conn.execute(
            text(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'start_page'
            """
            )
        )
        if result.fetchone():
            logger.info("Column 'start_page' already exists — skipping")
            return

        # start_page 컬럼 추가 (기본값 "/")
        conn.execute(
            text(
                """
                ALTER TABLE users
                ADD COLUMN start_page VARCHAR(255) NOT NULL DEFAULT '/'
            """
            )
        )
        conn.commit()

        logger.info("Migration completed: start_page column added to users")


if __name__ == "__main__":
    run_migration()
