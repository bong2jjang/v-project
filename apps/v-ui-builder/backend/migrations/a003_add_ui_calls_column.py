"""a003: ui_builder_messages.ui_calls JSONB 컬럼 추가.

Generative UI (방안 C) — tool-call 결과를 메시지에 누적 보관하기 위한 슬롯.
값 구조 (예시):

    [
      {
        "call_id": "c_abc",
        "tool": "weather",
        "args": {"city": "Seoul"},
        "status": "ok",
        "props": {...},
        "created_at": "2026-04-19T12:00:00Z"
      }
    ]

멱등성 보장 — 컬럼 존재 시 스킵.
"""

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


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
        if _column_exists(conn, "ui_builder_messages", "ui_calls"):
            logger.info(
                "a003: ui_builder_messages.ui_calls already exists, skipping"
            )
            return

        conn.execute(text("""
            ALTER TABLE ui_builder_messages
            ADD COLUMN ui_calls JSONB NOT NULL DEFAULT '[]'::jsonb
        """))
        conn.commit()
        logger.info("a003: added ui_builder_messages.ui_calls JSONB")
