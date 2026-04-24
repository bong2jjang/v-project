"""a002: ui_builder_snapshots 테이블 + projects.current_snapshot_id 컬럼.

- ui_builder_snapshots : 프로젝트 내 프리뷰 스냅샷 (슬러그 + AI 자동 타이틀)
- ui_builder_projects.current_snapshot_id : 명시적으로 '확정'된 스냅샷

멱등성 보장 — 테이블/컬럼 존재 시 스킵.
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def _table_exists(conn, name: str) -> bool:
    result = conn.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name = :name"
        ),
        {"name": name},
    )
    return result.fetchone() is not None


def _column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    )
    return result.fetchone() is not None


def migrate(engine):
    with engine.connect() as conn:
        if not _table_exists(conn, "ui_builder_snapshots"):
            conn.execute(text("""
                CREATE TABLE ui_builder_snapshots (
                    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    project_id  UUID NOT NULL REFERENCES ui_builder_projects(id) ON DELETE CASCADE,
                    slug        VARCHAR(32) NOT NULL,
                    title       VARCHAR(200) NOT NULL,
                    files       JSONB NOT NULL,
                    message_id  UUID REFERENCES ui_builder_messages(id) ON DELETE SET NULL,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE (project_id, slug)
                )
            """))
            conn.execute(text(
                "CREATE INDEX idx_ui_builder_snapshots_project "
                "ON ui_builder_snapshots(project_id, created_at DESC)"
            ))
            logger.info("a002: created ui_builder_snapshots")
        else:
            logger.info("a002: ui_builder_snapshots already exists, skipping")

        if not _column_exists(conn, "ui_builder_projects", "current_snapshot_id"):
            conn.execute(text("""
                ALTER TABLE ui_builder_projects
                ADD COLUMN current_snapshot_id UUID
                REFERENCES ui_builder_snapshots(id) ON DELETE SET NULL
            """))
            logger.info("a002: added ui_builder_projects.current_snapshot_id")
        else:
            logger.info(
                "a002: ui_builder_projects.current_snapshot_id already exists, skipping"
            )

        conn.commit()
