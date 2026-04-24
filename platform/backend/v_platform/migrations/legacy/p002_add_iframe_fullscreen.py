"""009: iframe_fullscreen 컬럼 추가

menu_items 테이블에 iframe_fullscreen BOOLEAN 컬럼 추가.
전체 화면 모드로 iframe을 표시할지 여부 (기본값: FALSE).
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine) -> bool:
    """마이그레이션 실행"""
    try:
        with engine.connect() as conn:
            # 컬럼 존재 여부 확인
            result = conn.execute(
                text(
                    """
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'menu_items'
                    AND column_name = 'iframe_fullscreen'
                    """
                )
            )
            if result.fetchone():
                logger.info("Column iframe_fullscreen already exists, skipping")
                return True

            conn.execute(
                text(
                    """
                    ALTER TABLE menu_items
                    ADD COLUMN iframe_fullscreen BOOLEAN DEFAULT FALSE
                    """
                )
            )
            conn.commit()
            logger.info("Added iframe_fullscreen column to menu_items")
            return True

    except Exception as e:
        logger.error(f"Migration 009 failed: {e}")
        return False
