"""
v-channel-bridge demo data migration — env-gated.

Loads bridge business data snapshots (accounts, messages) captured from the
live development DB by `monitoring/scripts/dump_demo_data.py`.

Only applied when `SEED_DEMO_DATA` is truthy; otherwise a no-op.

Idempotent: ON CONFLICT DO NOTHING + sequence resets.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from sqlalchemy.engine import Engine

from v_platform.migrations._baseline import run_sql_file

SQL_PATH = Path(__file__).resolve().parent / "baseline" / "app_demo.sql"
logger = logging.getLogger(__name__)


def _demo_enabled() -> bool:
    return os.getenv("SEED_DEMO_DATA", "").strip().lower() in ("1", "true", "yes", "on")


def migrate(engine: Engine) -> None:
    if not _demo_enabled():
        logger.info("demo[v-channel-bridge]: skipped (SEED_DEMO_DATA not set)")
        return
    run_sql_file(engine, SQL_PATH, label="v-channel-bridge-demo")
