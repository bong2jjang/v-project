"""a004: Dashboard Canvas (Phase 3) — dashboards + dashboard_widgets + messages scope.

새 테이블:
  - ui_builder_dashboards          : 프로젝트당 1 개(UNIQUE project_id)
  - ui_builder_dashboard_widgets   : 대시보드에 고정된 위젯(그리드 좌표 포함)

기존 테이블 확장:
  - ui_builder_messages.scope         VARCHAR(16) NOT NULL DEFAULT 'project'
  - ui_builder_messages.dashboard_id  UUID NULL REFERENCES ui_builder_dashboards(id)

백필:
  - 기존 프로젝트 전체에 기본 대시보드('Dashboard') 1 건씩 보장.

멱등성 보장 — 객체 존재 여부를 매번 점검.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


def _table_exists(conn, name: str) -> bool:
    row = conn.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_name = :name"
        ),
        {"name": name},
    ).fetchone()
    return row is not None


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
        # 1) ui_builder_dashboards
        if not _table_exists(conn, "ui_builder_dashboards"):
            conn.execute(text("""
                CREATE TABLE ui_builder_dashboards (
                    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    project_id  UUID NOT NULL
                                REFERENCES ui_builder_projects(id) ON DELETE CASCADE,
                    name        VARCHAR(200) NOT NULL DEFAULT 'Dashboard',
                    description TEXT,
                    layout_cols INTEGER NOT NULL DEFAULT 12,
                    row_height  INTEGER NOT NULL DEFAULT 64,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_ui_builder_dashboards_project UNIQUE (project_id)
                )
            """))
            logger.info("a004: created ui_builder_dashboards")
        else:
            logger.info("a004: ui_builder_dashboards exists, skipping create")

        # 2) ui_builder_dashboard_widgets
        if not _table_exists(conn, "ui_builder_dashboard_widgets"):
            conn.execute(text("""
                CREATE TABLE ui_builder_dashboard_widgets (
                    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    dashboard_id      UUID NOT NULL
                                      REFERENCES ui_builder_dashboards(id) ON DELETE CASCADE,
                    call_id           VARCHAR(64) NOT NULL,
                    tool              VARCHAR(100) NOT NULL,
                    component         VARCHAR(100) NOT NULL,
                    props             JSONB NOT NULL DEFAULT '{}'::jsonb,
                    source_message_id UUID
                                      REFERENCES ui_builder_messages(id) ON DELETE SET NULL,
                    source_call_id    VARCHAR(64),
                    grid_x            INTEGER NOT NULL DEFAULT 0,
                    grid_y            INTEGER NOT NULL DEFAULT 0,
                    grid_w            INTEGER NOT NULL DEFAULT 6,
                    grid_h            INTEGER NOT NULL DEFAULT 4,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_ui_builder_widget_call_id UNIQUE (dashboard_id, call_id)
                )
            """))
            logger.info("a004: created ui_builder_dashboard_widgets")
        else:
            logger.info("a004: ui_builder_dashboard_widgets exists, skipping create")

        if not _index_exists(conn, "idx_ui_builder_widgets_dashboard"):
            conn.execute(text("""
                CREATE INDEX idx_ui_builder_widgets_dashboard
                  ON ui_builder_dashboard_widgets(dashboard_id, created_at)
            """))

        # 3) ui_builder_messages.scope + dashboard_id
        if not _column_exists(conn, "ui_builder_messages", "scope"):
            conn.execute(text("""
                ALTER TABLE ui_builder_messages
                  ADD COLUMN scope VARCHAR(16) NOT NULL DEFAULT 'project'
            """))
            logger.info("a004: added ui_builder_messages.scope")

        if not _column_exists(conn, "ui_builder_messages", "dashboard_id"):
            conn.execute(text("""
                ALTER TABLE ui_builder_messages
                  ADD COLUMN dashboard_id UUID
                  REFERENCES ui_builder_dashboards(id) ON DELETE CASCADE
            """))
            logger.info("a004: added ui_builder_messages.dashboard_id")

        if not _index_exists(conn, "idx_ui_builder_messages_dashboard"):
            conn.execute(text("""
                CREATE INDEX idx_ui_builder_messages_dashboard
                  ON ui_builder_messages(dashboard_id, created_at)
                  WHERE dashboard_id IS NOT NULL
            """))

        # 4) Backfill: 기존 프로젝트에 기본 대시보드 1 건 보장
        result = conn.execute(text("""
            INSERT INTO ui_builder_dashboards (project_id, name)
            SELECT p.id, 'Dashboard'
              FROM ui_builder_projects p
              LEFT JOIN ui_builder_dashboards d ON d.project_id = p.id
             WHERE d.id IS NULL
        """))
        backfilled = result.rowcount or 0
        if backfilled:
            logger.info("a004: backfilled %d default dashboards", backfilled)

        conn.commit()
        logger.info("a004: done")
