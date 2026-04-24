"""
Shared baseline SQL executor.

Reads a .sql file alongside a p*/a* baseline migration and runs it via the
engine. Statements are idempotent (ON CONFLICT DO NOTHING on all inserts,
sequence resets via setval), so replaying is safe.

Used by:
  - platform/backend/v_platform/migrations/p001_baseline.py
  - apps/{app}/backend/migrations/a001_baseline.py
"""
from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def run_sql_file(engine: Engine, sql_path: Path, label: str) -> None:
    if not sql_path.is_file():
        logger.warning("baseline sql missing: %s", sql_path)
        return

    sql = sql_path.read_text(encoding="utf-8")
    # Drop psql meta-commands and empty statements the runner can't handle.
    # BEGIN / COMMIT are kept — SQLAlchemy's engine.begin() handles transactions,
    # but explicit BEGIN inside connection.execute() would be a nested tx on
    # autocommit-style engines. We strip them and wrap in our own transaction.
    cleaned = []
    for ln in sql.splitlines():
        stripped = ln.strip()
        if not stripped or stripped.startswith("--"):
            continue
        if stripped.upper() in ("BEGIN;", "COMMIT;"):
            continue
        if stripped.startswith("\\"):
            continue
        if stripped.startswith("SET "):
            continue
        cleaned.append(ln)
    body = "\n".join(cleaned)

    # Split on statement terminators, respecting single-quoted string literals
    # (so embedded `;` or `;\n` inside a quoted value does not prematurely split).
    # PostgreSQL uses `''` to escape a quote inside a string.
    statements: list[str] = []
    buf: list[str] = []
    in_str = False
    i = 0
    while i < len(body):
        ch = body[i]
        if in_str:
            if ch == "'":
                if i + 1 < len(body) and body[i + 1] == "'":
                    buf.append("''")
                    i += 2
                    continue
                in_str = False
            buf.append(ch)
            i += 1
            continue
        if ch == "'":
            in_str = True
            buf.append(ch)
            i += 1
            continue
        if ch == ";":
            stmt = "".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)

    ok = 0
    with engine.begin() as conn:
        for stmt in statements:
            # Ensure trailing semicolon stripped so text() doesn't choke.
            stmt_clean = stmt.rstrip(";").strip()
            if not stmt_clean:
                continue
            conn.execute(text(stmt_clean))
            ok += 1

    logger.info("baseline[%s]: applied %d statements from %s", label, ok, sql_path.name)
