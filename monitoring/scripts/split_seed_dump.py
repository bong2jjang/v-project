"""
Seed dump splitter — partitions a pg_dump --data-only output into
platform + per-app baseline SQL files with idempotent ON CONFLICT clauses.

Input : platform/backend/v_platform/migrations/baseline/_raw_seed_dump.sql
Output: platform/backend/v_platform/migrations/baseline/platform_seed.sql
        apps/{app}/backend/migrations/baseline/app_seed.sql  (x5)

Run from repo root:
    python monitoring/scripts/split_seed_dump.py
"""
from __future__ import annotations

import io
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "platform/backend/v_platform/migrations/baseline/_raw_seed_dump.sql"

APPS = [
    "v-channel-bridge",
    "v-platform-portal",
    "v-platform-template",
    "v-ui-builder",
    "v-itsm",
]

PLATFORM_OUT = ROOT / "platform/backend/v_platform/migrations/baseline/platform_seed.sql"
APP_OUT = {app: ROOT / f"apps/{app}/backend/migrations/baseline/app_seed.sql" for app in APPS}


# ── conflict key per table (columns used for ON CONFLICT) ─────────────────
CONFLICT = {
    "menu_items": "(id)",
    "permission_groups": "(id)",
    "permission_group_grants": "(id)",
    "notifications": "(id)",
    "notification_app_overrides": "(notification_id, app_id)",
    "portal_apps": "(id)",
    "system_settings": "(id)",
}

# ── notifications: is_system=true ids (discovered out of band) ────────────
SYSTEM_NOTIFICATION_IDS = {1, 2, 3, 4, 5, 6}


# ── sequence reset targets ────────────────────────────────────────────────
SEQUENCES = {
    "menu_items": "menu_items_id_seq",
    "permission_groups": "permission_groups_id_seq",
    "permission_group_grants": "permission_group_grants_id_seq",
    "notifications": "notifications_id_seq",
    "notification_app_overrides": "notification_app_overrides_id_seq",
    "portal_apps": "portal_apps_id_seq",
    "system_settings": "system_settings_id_seq",
}


def parse_insert(line: str) -> tuple[str, list[str]] | None:
    """Return (table, values_csv) for an INSERT line, or None."""
    m = re.match(r"INSERT INTO public\.(\w+)\s*\((.+?)\)\s*VALUES\s*\((.+)\);?\s*$", line)
    if not m:
        return None
    table = m.group(1)
    # We don't need the column list or values parsed further for routing.
    return table, []


def add_on_conflict(line: str, table: str) -> str:
    """Append ON CONFLICT DO NOTHING clause to an INSERT line."""
    key = CONFLICT.get(table)
    if not key:
        return line
    # Strip trailing semicolon + whitespace, append clause.
    stripped = line.rstrip().rstrip(";")
    return f"{stripped} ON CONFLICT {key} DO NOTHING;\n"


def main() -> None:
    if not RAW.exists():
        print(f"missing: {RAW}", file=sys.stderr)
        sys.exit(1)

    lines = RAW.read_text(encoding="utf-8").splitlines(keepends=True)

    # 1st pass: extract menu_item_id → app_id mapping
    menu_app: dict[int, str | None] = {}
    menu_insert_re = re.compile(
        r"INSERT INTO public\.menu_items .*? VALUES \((\d+),.*?,\s*(NULL|'([^']+)')[^)]*\)"
    )
    for ln in lines:
        if not ln.startswith("INSERT INTO public.menu_items"):
            continue
        # app_id is the 13th column; easier to search near end for "'v-*'" or NULL before is_active.
        # Reuse the VALUES tuple; split on ", " is unsafe due to commas in strings.
        # Strategy: find the last occurrence of ", NULL, true/false, " before created_by, then app_id is just before.
        # Menu_items column order: id, ..., app_id (col 13), is_active (bool, col 14),
        #   created_by (int|NULL, col 15), updated_by (int|NULL, col 16), created_at (timestamp string).
        # Anchor on the (app_id, bool, int|NULL, int|NULL, 'YYYY-...') tail to avoid matching
        # earlier nullable-bool columns (iframe_fullscreen, open_in_new_tab).
        id_m = re.search(r"VALUES \((\d+),", ln)
        if not id_m:
            continue
        menu_id = int(id_m.group(1))
        tail_m = re.search(
            r"(NULL|'(v-[a-z\-]+)')\s*,\s*(?:true|false)\s*,\s*(?:NULL|\d+)\s*,\s*(?:NULL|\d+)\s*,\s*'\d{4}-\d{2}-\d{2}",
            ln,
        )
        if tail_m:
            menu_app[menu_id] = tail_m.group(2) if tail_m.group(2) else None

    print(f"[scan] parsed {len(menu_app)} menu_items: "
          f"platform={sum(1 for v in menu_app.values() if v is None)}, "
          f"apps={sum(1 for v in menu_app.values() if v is not None)}")

    # Buckets
    platform_lines: list[str] = []
    app_lines: dict[str, list[str]] = {app: [] for app in APPS}
    counts = {k: {"platform": 0, **{app: 0 for app in APPS}} for k in CONFLICT}

    def route_grant(line: str) -> str | None:
        """Return scope key (platform / v-app / None)."""
        m = re.search(r"VALUES \(\d+,\s*\d+,\s*(\d+)", line)
        if not m:
            return "platform"
        menu_id = int(m.group(1))
        app = menu_app.get(menu_id)
        return app if app else "platform"

    def route_menu(line: str) -> str | None:
        m = re.search(r"VALUES \((\d+)", line)
        if not m:
            return None
        menu_id = int(m.group(1))
        app = menu_app.get(menu_id)
        return app if app else "platform"

    def route_override(line: str) -> str | None:
        m = re.search(r"VALUES \(\d+,\s*\d+,\s*'(v-[a-z\-]+)'", line)
        return m.group(1) if m else None

    # 2nd pass: route every INSERT
    for ln in lines:
        if not ln.startswith("INSERT INTO public."):
            continue
        m = re.match(r"INSERT INTO public\.(\w+)", ln)
        if not m:
            continue
        table = m.group(1)
        out_line = add_on_conflict(ln, table)

        if table == "menu_items":
            scope = route_menu(ln)
        elif table == "permission_group_grants":
            scope = route_grant(ln)
        elif table == "notification_app_overrides":
            scope = route_override(ln)
        elif table == "portal_apps":
            scope = "v-platform-portal"
        elif table == "notifications":
            # Only is_system=true notifications belong in the production baseline.
            # Non-system rows are runtime-generated and treated as demo data.
            id_m = re.search(r"VALUES \((\d+),", ln)
            if not id_m:
                continue
            nid = int(id_m.group(1))
            if nid not in SYSTEM_NOTIFICATION_IDS:
                continue
            scope = "platform"
        elif table in ("permission_groups", "system_settings"):
            scope = "platform"
        else:
            continue  # ignore unknown tables

        if scope == "platform":
            platform_lines.append(out_line)
            counts.setdefault(table, {}).setdefault("platform", 0)
            counts[table]["platform"] += 1
        elif scope in APPS:
            app_lines[scope].append(out_line)
            counts[table][scope] += 1

    # ── compose platform_seed.sql ────────────────────────────────────────
    header_platform = """-- Generated by monitoring/scripts/split_seed_dump.py
-- Platform baseline seeds (menu_items WHERE app_id IS NULL, all permission_groups,
-- grants for platform menus, system_notifications, system_settings).
-- Idempotent: ON CONFLICT DO NOTHING on all inserts.

SET client_encoding = 'UTF8';

BEGIN;

"""
    seq_resets_platform = "\n".join(
        f"SELECT setval('public.{seq}', (SELECT COALESCE(MAX(id), 0) + 1 FROM public.{tbl}), false);"
        for tbl, seq in SEQUENCES.items()
        if tbl in ("menu_items", "permission_groups", "permission_group_grants", "notifications", "system_settings")
    )
    PLATFORM_OUT.parent.mkdir(parents=True, exist_ok=True)
    PLATFORM_OUT.write_text(
        header_platform + "".join(platform_lines) + f"\n{seq_resets_platform}\n\nCOMMIT;\n",
        encoding="utf-8",
    )

    # ── compose per-app app_seed.sql ─────────────────────────────────────
    for app in APPS:
        out_path = APP_OUT[app]
        out_path.parent.mkdir(parents=True, exist_ok=True)
        seq_resets = "\n".join(
            f"SELECT setval('public.{seq}', (SELECT COALESCE(MAX(id), 0) + 1 FROM public.{tbl}), false);"
            for tbl, seq in SEQUENCES.items()
            if tbl in ("menu_items", "permission_group_grants", "notification_app_overrides")
            or (tbl == "portal_apps" and app == "v-platform-portal")
        )
        hdr = f"""-- Generated by monitoring/scripts/split_seed_dump.py
-- {app} app baseline seeds (menu_items / grants / overrides scoped to this app).
-- Idempotent: ON CONFLICT DO NOTHING on all inserts.

SET client_encoding = 'UTF8';

BEGIN;

"""
        body = "".join(app_lines[app])
        if not body.strip():
            body = f"-- No rows for {app} in current DB.\n"
        out_path.write_text(
            hdr + body + f"\n{seq_resets}\n\nCOMMIT;\n",
            encoding="utf-8",
        )

    # ── report ───────────────────────────────────────────────────────────
    print("\n[output]")
    print(f"  {PLATFORM_OUT.relative_to(ROOT)} ({len(platform_lines)} rows)")
    for app in APPS:
        n = len(app_lines[app])
        print(f"  {APP_OUT[app].relative_to(ROOT)} ({n} rows)")

    print("\n[route counts per table]")
    for tbl, bucket in counts.items():
        parts = [f"{k}={v}" for k, v in bucket.items() if v]
        if parts:
            print(f"  {tbl}: {', '.join(parts)}")


if __name__ == "__main__":
    main()
