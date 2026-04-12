"""Seed runner — base/demo 레벨에 따라 시드 데이터를 로드한다.

base: fresh install 최소 데이터 (관리자 계정, 기본 회사, 권한그룹-사용자 매핑)
demo: base + 테스트 사용자, 부서, 커스텀 권한그룹, 샘플 데이터
"""

import logging

from sqlalchemy import text

from v_platform.core.database import engine

logger = logging.getLogger(__name__)


def run_seeds(level: str = "base", reset: bool = False) -> bool:
    """시드 데이터를 DB에 삽입한다.

    Args:
        level: "base" (최소) or "demo" (테스트 데이터 포함)
        reset: True면 기존 시드 데이터를 삭제 후 재삽입 (demo 전용)
    """
    from v_platform.seeds.base import seed_base
    from v_platform.seeds.demo import seed_demo

    try:
        with engine.connect() as conn:
            if reset and level == "demo":
                _reset_demo_data(conn)
                conn.commit()
                logger.info("Demo data reset complete")

            # base는 항상 실행 (idempotent)
            seed_base(conn)
            conn.commit()
            logger.info("Base seed completed")

            if level == "demo":
                seed_demo(conn)
                conn.commit()
                logger.info("Demo seed completed")

            # 검증
            _verify(conn)
            return True

    except Exception as e:
        logger.error(f"Seed failed: {e}")
        return False


def _reset_demo_data(conn):
    """demo 레벨 데이터만 삭제 (base 데이터는 유지)."""
    logger.info("Resetting demo data...")

    # demo 사용자 삭제 (email이 @test.com 또는 demo 태그)
    conn.execute(
        text(
            "DELETE FROM users WHERE email LIKE '%@test.com' OR email LIKE '%@demo.local'"
        )
    )

    # demo 부서 삭제 (is_seed_demo 마커 — 회사에 속한 부서 중 시드가 아닌 것)
    # 커스텀 권한그룹 삭제 (is_default=FALSE이면서 migration이 아닌 것)
    conn.execute(
        text(
            "DELETE FROM permission_groups WHERE is_default = FALSE AND name LIKE '데모%'"
        )
    )

    logger.info("Demo data cleaned")


def _verify(conn):
    """시드 결과 검증 로그."""
    tables = [
        "companies",
        "departments",
        "users",
        "permission_groups",
        "user_group_memberships",
    ]
    for table in tables:
        row = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
        logger.info(f"  {table}: {row} rows")
