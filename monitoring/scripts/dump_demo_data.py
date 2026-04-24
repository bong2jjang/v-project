"""
Demo data dumper — snapshots current live DB business data into per-scope
idempotent SQL files.

Output layout:
  platform/backend/v_platform/migrations/baseline/platform_demo.sql
  apps/v-itsm/backend/migrations/baseline/app_demo.sql
  apps/v-ui-builder/backend/migrations/baseline/app_demo.sql
  apps/v-channel-bridge/backend/migrations/baseline/app_demo.sql

Each file is:
  - Wrapped in BEGIN / COMMIT
  - Uses INSERT ... ON CONFLICT (<pk>) DO NOTHING
  - Ends with setval() to keep sequences monotonic

Requirements:
  - Docker container `v-project-postgres` must be running
  - Executed from repo root:  python monitoring/scripts/dump_demo_data.py

Skipped tables (runtime state, secrets, BLOBs):
  audit_logs, refresh_tokens, password_reset_tokens, user_oauth_tokens,
  uploaded_files, itsm_integration_settings, message_stats
"""
from __future__ import annotations

import io
import re
import subprocess
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
POSTGRES_CONTAINER = "v-project-postgres"
PG_USER = "vmsuser"
PG_DB = "v_project"

# ── scope → (output path, tables, sequences, filter-per-table) ────────────
PLATFORM_DEMO_OUT = ROOT / "platform/backend/v_platform/migrations/baseline/platform_demo.sql"
ITSM_DEMO_OUT = ROOT / "apps/v-itsm/backend/migrations/baseline/app_demo.sql"
UI_BUILDER_DEMO_OUT = ROOT / "apps/v-ui-builder/backend/migrations/baseline/app_demo.sql"
BRIDGE_DEMO_OUT = ROOT / "apps/v-channel-bridge/backend/migrations/baseline/app_demo.sql"

# primary-key column(s) per table — used to compose ON CONFLICT clauses
PK: dict[str, str] = {
    # platform business
    "companies": "(id)",
    "departments": "(id)",
    "users": "(id)",
    "user_permissions": "(id)",
    "user_group_memberships": "(id)",
    "notifications": "(id)",
    "notification_reads": "(id)",
    # bridge
    "accounts": "(id)",
    "messages": "(id)",
    # itsm
    "itsm_workspaces": "(id)",
    "itsm_workspace_members": "(id)",
    "itsm_customer": "(id)",
    "itsm_customer_contact": "(id)",
    "itsm_product": "(id)",
    "itsm_contract": "(id)",
    "itsm_contract_product": "(contract_id, product_id)",
    "itsm_ticket": "(id)",
    "itsm_assignment": "(id)",
    "itsm_loop_transition": "(id)",
    "itsm_loop_transition_revision": "(id)",
    "itsm_sla_policy": "(id)",
    "itsm_sla_tier": "(id)",
    "itsm_sla_notification_policy": "(id)",
    "itsm_sla_timer": "(id)",
    "itsm_scheduler_override": "(job_id)",
    "itsm_scope_grant": "(id)",
    "itsm_feedback": "(id)",
    "itsm_ai_suggestion": "(id)",
    "itsm_kpi_snapshot": "(id)",
    "itsm_notification_log": "(id)",
    "itsm_user_notification_pref": "(id)",
    # ui-builder
    "ui_builder_projects": "(id)",
    "ui_builder_artifacts": "(id)",
    "ui_builder_snapshots": "(id)",
    "ui_builder_messages": "(id)",
    "ui_builder_dashboards": "(id)",
    "ui_builder_dashboard_widgets": "(id)",
}

# sequence reset targets — only tables with SERIAL / BIGSERIAL PK
SEQUENCES: dict[str, tuple[str, str]] = {
    # table: (sequence_name, pk_column)
    "companies": ("companies_id_seq", "id"),
    "departments": ("departments_id_seq", "id"),
    "users": ("users_id_seq", "id"),
    "user_permissions": ("user_permissions_id_seq", "id"),
    "user_group_memberships": ("user_group_memberships_id_seq", "id"),
    "notifications": ("notifications_id_seq", "id"),
    "notification_reads": ("notification_reads_id_seq", "id"),
    "accounts": ("accounts_id_seq", "id"),
    "messages": ("messages_id_seq", "id"),
}

# scope → ordered tables (parent tables first for FK safety)
SCOPES: dict[str, list[str]] = {
    "platform": [
        "companies",
        "departments",
        "users",
        "user_permissions",
        "user_group_memberships",
        "notifications",
        "notification_reads",
    ],
    "itsm": [
        "itsm_workspaces",
        "itsm_workspace_members",
        "itsm_customer",
        "itsm_customer_contact",
        "itsm_product",
        "itsm_contract",
        "itsm_contract_product",
        "itsm_ticket",
        "itsm_assignment",
        "itsm_loop_transition",
        "itsm_loop_transition_revision",
        "itsm_sla_policy",
        "itsm_sla_tier",
        "itsm_sla_notification_policy",
        "itsm_sla_timer",
        "itsm_scheduler_override",
        "itsm_scope_grant",
        "itsm_feedback",
        "itsm_ai_suggestion",
        "itsm_kpi_snapshot",
        "itsm_notification_log",
        "itsm_user_notification_pref",
    ],
    "ui-builder": [
        "ui_builder_projects",
        "ui_builder_artifacts",
        "ui_builder_snapshots",
        "ui_builder_messages",
        "ui_builder_dashboards",
        "ui_builder_dashboard_widgets",
    ],
    "bridge": [
        "accounts",
        "messages",
    ],
}

SCOPE_OUT = {
    "platform": PLATFORM_DEMO_OUT,
    "itsm": ITSM_DEMO_OUT,
    "ui-builder": UI_BUILDER_DEMO_OUT,
    "bridge": BRIDGE_DEMO_OUT,
}

# notifications: only dump non-system rows (is_system notifications are in baseline)
ROW_FILTERS: dict[str, str] = {
    "notifications": "is_system = false",
}


def pg_dump_table(table: str) -> str:
    """Run pg_dump --data-only --column-inserts for a single table and return stdout."""
    cmd = [
        "docker", "exec", POSTGRES_CONTAINER,
        "pg_dump",
        "-U", PG_USER,
        "-d", PG_DB,
        "--data-only",
        "--column-inserts",
        "--no-owner",
        "--no-privileges",
        "-t", f"public.{table}",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if proc.returncode != 0:
        print(f"[error] pg_dump failed for {table}: {proc.stderr}", file=sys.stderr)
        return ""
    return proc.stdout


def extract_inserts(dump: str, table: str) -> list[str]:
    """Extract INSERT INTO public.<table> statements from a pg_dump output.

    Uses a quote-aware scanner so multi-line string values (messages with
    embedded newlines, code containing `;` terminators, etc.) don't prematurely
    end a statement. Only `);` outside of quotes terminates.
    """
    prefix = f"INSERT INTO public.{table} "
    statements: list[str] = []
    i = 0
    n = len(dump)
    while i < n:
        # Find next INSERT for this table
        idx = dump.find(prefix, i)
        if idx == -1:
            break
        # Scan forward, tracking quoted state, until we hit ');' at top level
        j = idx
        in_str = False
        while j < n:
            ch = dump[j]
            if in_str:
                if ch == "'":
                    # doubled '' is an escaped quote, stay in string
                    if j + 1 < n and dump[j + 1] == "'":
                        j += 2
                        continue
                    in_str = False
                j += 1
                continue
            if ch == "'":
                in_str = True
                j += 1
                continue
            if ch == ")" and j + 1 < n and dump[j + 1] == ";":
                # Terminator
                statements.append(dump[idx : j + 2] + "\n")
                i = j + 2
                break
            j += 1
        else:
            # Hit EOF without terminator — malformed, bail
            break
    return statements


def add_on_conflict(insert_line: str, table: str) -> str:
    """Append ON CONFLICT (<pk>) DO NOTHING to an INSERT (keep trailing newline)."""
    pk = PK.get(table)
    if not pk:
        return insert_line
    # Strip trailing newline + semicolon, append clause, restore terminator.
    stripped = insert_line.rstrip()
    if stripped.endswith(";"):
        stripped = stripped[:-1]
    return f"{stripped} ON CONFLICT {pk} DO NOTHING;\n"


def filter_row(insert_line: str, filter_clause: str, table: str) -> bool:
    """Return True if row passes the filter. Only supports 'col = true/false' form."""
    m = re.match(r"(\w+)\s*=\s*(true|false)", filter_clause)
    if not m:
        return True
    col = m.group(1)
    want = m.group(2)
    # Find column position via the pg_dump column list in the INSERT itself.
    col_list_m = re.search(r"INSERT INTO public\.\w+ \(([^)]+)\) VALUES", insert_line)
    if not col_list_m:
        return True
    cols = [c.strip() for c in col_list_m.group(1).split(",")]
    if col not in cols:
        return True
    idx = cols.index(col)
    # Now split values — naive but safe for simple bools (no commas inside bools).
    # Walk the VALUES tuple respecting parentheses and quoted strings.
    values_start = insert_line.index("VALUES (") + len("VALUES (")
    # Collect up to matching close paren
    depth = 1
    in_str = False
    buf: list[str] = []
    i = values_start
    while i < len(insert_line) and depth > 0:
        ch = insert_line[i]
        if in_str:
            if ch == "'" and (i + 1 >= len(insert_line) or insert_line[i + 1] != "'"):
                in_str = False
            elif ch == "'" and insert_line[i + 1] == "'":
                buf.append("''")
                i += 2
                continue
            buf.append(ch)
        else:
            if ch == "'":
                in_str = True
                buf.append(ch)
            elif ch == "(":
                depth += 1
                buf.append(ch)
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    break
                buf.append(ch)
            else:
                buf.append(ch)
        i += 1
    values_str = "".join(buf)
    # Split on top-level commas
    parts: list[str] = []
    depth = 0
    in_str = False
    cur: list[str] = []
    i = 0
    while i < len(values_str):
        ch = values_str[i]
        if in_str:
            if ch == "'" and (i + 1 >= len(values_str) or values_str[i + 1] != "'"):
                in_str = False
                cur.append(ch)
            elif ch == "'" and values_str[i + 1] == "'":
                cur.append("''")
                i += 2
                continue
            else:
                cur.append(ch)
        else:
            if ch == "'":
                in_str = True
                cur.append(ch)
            elif ch == "(":
                depth += 1
                cur.append(ch)
            elif ch == ")":
                depth -= 1
                cur.append(ch)
            elif ch == "," and depth == 0:
                parts.append("".join(cur).strip())
                cur = []
            else:
                cur.append(ch)
        i += 1
    if cur:
        parts.append("".join(cur).strip())
    if idx >= len(parts):
        return True
    actual = parts[idx].lower()
    return actual == want


def compose_scope(scope: str, tables: list[str]) -> tuple[str, dict[str, int]]:
    """Build full scope SQL body + per-table counts."""
    body_parts: list[str] = []
    counts: dict[str, int] = {}
    for tbl in tables:
        dump = pg_dump_table(tbl)
        inserts = extract_inserts(dump, tbl)
        if tbl in ROW_FILTERS:
            inserts = [ln for ln in inserts if filter_row(ln, ROW_FILTERS[tbl], tbl)]
        if not inserts:
            counts[tbl] = 0
            continue
        body_parts.append(f"-- ── {tbl} ({len(inserts)} rows) ─────────────────────────\n")
        for ln in inserts:
            body_parts.append(add_on_conflict(ln, tbl))
        body_parts.append("\n")
        counts[tbl] = len(inserts)

    # sequence resets
    seq_lines: list[str] = []
    for tbl in tables:
        if tbl not in SEQUENCES:
            continue
        seq_name, pk_col = SEQUENCES[tbl]
        seq_lines.append(
            f"SELECT setval('public.{seq_name}', "
            f"(SELECT COALESCE(MAX({pk_col}), 0) + 1 FROM public.{tbl}), false);"
        )
    if seq_lines:
        body_parts.append("-- ── sequence resets ──────────────────────────────────\n")
        body_parts.extend(s + "\n" for s in seq_lines)

    return "".join(body_parts), counts


def main() -> None:
    header_tmpl = """-- Generated by monitoring/scripts/dump_demo_data.py
-- {scope} demo seed — snapshot of live DB business data.
-- Env-gated: only applied when SEED_DEMO_DATA=1 at migration time.
-- Idempotent: ON CONFLICT DO NOTHING on all inserts.
-- FK safety: tables are emitted in parent→child order so ON CONFLICT skips
-- are safe even when partial imports are re-run.

SET client_encoding = 'UTF8';

BEGIN;

"""
    footer = "\nCOMMIT;\n"

    print("[dump] starting demo data extraction …")
    for scope, tables in SCOPES.items():
        print(f"[scope] {scope} ({len(tables)} tables)")
        body, counts = compose_scope(scope, tables)
        out_path = SCOPE_OUT[scope]
        out_path.parent.mkdir(parents=True, exist_ok=True)
        total = sum(counts.values())
        if total == 0:
            body_final = f"-- No demo rows present for {scope} at snapshot time.\n"
        else:
            body_final = body
        out_path.write_text(
            header_tmpl.format(scope=scope) + body_final + footer,
            encoding="utf-8",
        )
        rel = out_path.relative_to(ROOT)
        print(f"  → {rel} ({total} rows)")
        for tbl, n in counts.items():
            if n:
                print(f"      {tbl}: {n}")


if __name__ == "__main__":
    main()
