"""Add avatar_url column to users table.

사용자별 프로필 아바타 이미지 URL을 저장합니다.
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'avatar_url'
                """
            )
        ).fetchone()

        if result is None:
            conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)"))
            conn.commit()
            logger.info("p027: users.avatar_url column added")
        else:
            logger.info("p027: users.avatar_url already exists, skipping")
