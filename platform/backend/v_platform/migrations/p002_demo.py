"""
Platform demo data migration — env-gated.

Loads business data snapshots (companies, departments, users, user_permissions,
user_group_memberships, non-system notifications, notification_reads) captured
from the live development DB by `monitoring/scripts/dump_demo_data.py`.

Only applied when the environment variable `SEED_DEMO_DATA` is set to a truthy
value ("1", "true", "yes"). In production the variable should be absent so this
migration becomes a no-op.

Idempotent: ON CONFLICT (<pk>) DO NOTHING on every insert, plus sequence resets.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from sqlalchemy.engine import Engine

from v_platform.migrations._baseline import run_sql_file

SQL_PATH = Path(__file__).resolve().parent / "baseline" / "platform_demo.sql"
logger = logging.getLogger(__name__)


def _demo_enabled() -> bool:
    return os.getenv("SEED_DEMO_DATA", "").strip().lower() in ("1", "true", "yes", "on")


def migrate(engine: Engine) -> None:
    if not _demo_enabled():
        logger.info("demo[platform]: skipped (SEED_DEMO_DATA not set)")
        return
    run_sql_file(engine, SQL_PATH, label="platform-demo")
