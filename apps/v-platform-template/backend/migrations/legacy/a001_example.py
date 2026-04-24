"""Example app migration template.

이 파일은 앱 전용 마이그레이션 작성 예시입니다.
실제 사용 시 이 파일을 삭제하고 a001_*.py 부터 작성하세요.

규칙:
  - 파일명: a001_description.py, a002_description.py, ...
  - 함수: migrate(engine) 필수
  - 멱등성(idempotent) 보장: 여러 번 실행해도 안전하게
  - Docker에서 /app/migrations/ 경로로 자동 로드됨
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    """마이그레이션 실행 — 예시"""
    # with engine.connect() as conn:
    #     result = conn.execute(
    #         text(
    #             "SELECT table_name FROM information_schema.tables "
    #             "WHERE table_name='my_table'"
    #         )
    #     )
    #     if result.fetchone():
    #         logger.info("my_table already exists, skipping")
    #         return
    #
    #     conn.execute(text("""
    #         CREATE TABLE my_table (
    #             id SERIAL PRIMARY KEY,
    #             name VARCHAR(200) NOT NULL,
    #             created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    #         )
    #     """))
    #     conn.commit()
    #     logger.info("Migration a001: created my_table")
    pass
