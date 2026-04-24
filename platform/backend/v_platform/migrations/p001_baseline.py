"""
Platform baseline migration — seeds framework-level data:
  - menu_items (app_id IS NULL, i.e. platform-owned menus)
  - permission_groups (all; shared across apps)
  - permission_group_grants for platform menus
  - notifications (is_system=true only)
  - system_settings

All statements are idempotent (ON CONFLICT DO NOTHING + setval).
Regenerate the SQL via: python monitoring/scripts/split_seed_dump.py
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy.engine import Engine

from v_platform.migrations._baseline import run_sql_file

SQL_PATH = Path(__file__).resolve().parent / "baseline" / "platform_seed.sql"


def migrate(engine: Engine) -> None:
    run_sql_file(engine, SQL_PATH, label="platform")
