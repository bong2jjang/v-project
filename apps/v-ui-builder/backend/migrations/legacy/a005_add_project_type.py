"""a005: ui_builder_projects.project_type — 프로젝트 종류 분리.

Sandpack 프로젝트(3-pane IDE)와 Generative UI 프로젝트(대시보드 캔버스)를
메뉴 수준에서 구분하기 위한 컬럼.

- project_type VARCHAR(32) NOT NULL DEFAULT 'sandpack'
  - 'sandpack' : 기존 Builder (Chat/Code/Preview + Snapshots + Artifacts)
  - 'genui'    : 새 Generative UI 빌더 (Dashboard 위젯 캔버스 + 전용 채팅)
- 기존 데이터는 모두 'sandpack' 으로 백필 (DEFAULT 로 자동 적용).

멱등성 보장.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


def _column_exists(conn, table: str, column: str) -> bool:
    row = conn.execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    ).fetchone()
    return row is not None


def _index_exists(conn, name: str) -> bool:
    row = conn.execute(
        text("SELECT indexname FROM pg_indexes WHERE indexname = :name"),
        {"name": name},
    ).fetchone()
    return row is not None


def migrate(engine):
    with engine.connect() as conn:
        if not _column_exists(conn, "ui_builder_projects", "project_type"):
            conn.execute(text("""
                ALTER TABLE ui_builder_projects
                  ADD COLUMN project_type VARCHAR(32) NOT NULL DEFAULT 'sandpack'
            """))
            logger.info("a005: added ui_builder_projects.project_type")

        if not _index_exists(conn, "idx_ui_builder_projects_user_type"):
            conn.execute(text("""
                CREATE INDEX idx_ui_builder_projects_user_type
                  ON ui_builder_projects(user_id, project_type, updated_at DESC)
            """))

        conn.commit()
        logger.info("a005: done")
