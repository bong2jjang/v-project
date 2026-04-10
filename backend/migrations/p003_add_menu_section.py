"""010: menu_items에 section 컬럼 추가

menu_items 테이블에 section VARCHAR(20) 컬럼 추가.
메뉴가 속하는 섹션(탭)을 지정: basic, admin, custom.
built_in 메뉴는 기존 parent_key('admin') 기반으로 자동 설정.
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
                    AND column_name = 'section'
                    """
                )
            )
            if result.fetchone():
                logger.info("Column section already exists, skipping")
                return True

            # section 컬럼 추가 (기본값: custom)
            conn.execute(
                text(
                    """
                    ALTER TABLE menu_items
                    ADD COLUMN section VARCHAR(20) DEFAULT 'custom'
                    """
                )
            )

            # built_in 메뉴의 section 값 설정
            # admin 그룹에 속하는 메뉴
            conn.execute(
                text(
                    """
                    UPDATE menu_items
                    SET section = 'admin'
                    WHERE menu_type = 'built_in'
                    AND permission_key IN (
                        'users', 'audit_logs', 'monitoring',
                        'menu_management', 'permission_management'
                    )
                    """
                )
            )

            # 기본 메뉴
            conn.execute(
                text(
                    """
                    UPDATE menu_items
                    SET section = 'basic'
                    WHERE menu_type = 'built_in'
                    AND permission_key NOT IN (
                        'users', 'audit_logs', 'monitoring',
                        'menu_management', 'permission_management'
                    )
                    """
                )
            )

            conn.commit()
            logger.info("Added section column to menu_items and set built_in values")
            return True

    except Exception as e:
        logger.error(f"Migration 010 failed: {e}")
        return False
