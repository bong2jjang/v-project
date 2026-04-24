"""a008: 대시보드 위젯 출처(source)/카테고리(category) 컬럼 추가.

배경
----
Generative UI 대시보드 위젯이 이제 세 가지 경로로 생성된다:
  1. `chat` — LLM 스트리밍 중 생성된 위젯 (기본값, 기존 행 전부)
  2. `pin-drag` — 채팅 렌더에서 드래그해 대시보드에 고정
  3. `manual`  — 팔레트에서 수동 추가 / Inspector 편집

추가로 팔레트 카탈로그(`BaseUiTool.category`) 와 동일한 분류를
행에도 저장해 목록 필터링·통계에 사용한다.

변경
----
- ui_builder_dashboard_widgets.source    VARCHAR(16) NOT NULL DEFAULT 'chat'
- ui_builder_dashboard_widgets.category  VARCHAR(32)           DEFAULT NULL

백필
----
- 기존 행 전부 source='chat' (DEFAULT 로 자동 채워짐)
- category 는 NULL 유지 — 런타임에서 tool→category 매핑으로 보완

멱등성 — 컬럼 존재 여부 점검.
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
        if not _column_exists(conn, "ui_builder_dashboard_widgets", "source"):
            conn.execute(text("""
                ALTER TABLE ui_builder_dashboard_widgets
                  ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'chat'
            """))
            logger.info("a008: added ui_builder_dashboard_widgets.source")
        else:
            logger.info("a008: source column already exists, skipping")

        if not _column_exists(conn, "ui_builder_dashboard_widgets", "category"):
            conn.execute(text("""
                ALTER TABLE ui_builder_dashboard_widgets
                  ADD COLUMN category VARCHAR(32)
            """))
            logger.info("a008: added ui_builder_dashboard_widgets.category")
        else:
            logger.info("a008: category column already exists, skipping")

        if not _index_exists(conn, "idx_ui_builder_widgets_source"):
            conn.execute(text("""
                CREATE INDEX idx_ui_builder_widgets_source
                  ON ui_builder_dashboard_widgets(dashboard_id, source)
            """))
            logger.info("a008: created idx_ui_builder_widgets_source")

        conn.commit()
        logger.info("a008: done")
