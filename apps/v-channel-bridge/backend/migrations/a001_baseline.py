"""
v-channel-bridge baseline migration — seeds app-scoped data:
  - menu_items where app_id='v-channel-bridge'
  - permission_group_grants for bridge menus
  - notification_app_overrides for this app

Idempotent. Regenerate via: python monitoring/scripts/split_seed_dump.py
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy.engine import Engine

from v_platform.migrations._baseline import run_sql_file

SQL_PATH = Path(__file__).resolve().parent / "baseline" / "app_seed.sql"


def migrate(engine: Engine) -> None:
    run_sql_file(engine, SQL_PATH, label="v-channel-bridge")
