#!/usr/bin/env python3
"""
Uganda National Roads — fold G: Drive field captures into the app data bundle.

server/index.js's write-back endpoints (POST /api/admin/:table,
PATCH /api/admin/:table/:id) persist every field submission as an
append-only JSONL file at:

    <DRIVE_DATA_DIR>/<table>.jsonl

with one line per write, each shaped { _op: "insert"|"update", _at: <ISO
timestamp>, <idColumn>: <id>, ...fields } (see persistDrive() in
server/index.js). That JSONL history is the canonical log, but the deployed
React app doesn't read JSONL logs at runtime — it fetches static JSON files
from public/data/ (DOCUMENTATION.md: "App data bundle | uganda-roads/public/
data/ (44+ files) | What the deployed site reads").

This script is the missing link the docs already assumed existed
(SystemDocumentation.tsx / DOCUMENTATION.md reference "drive_sync.py" by
name, but it had never actually been written — see BUGS.md / repo history).
It replays each table's JSONL history into current-state records (an
"update" line merges onto the row from a prior "insert"/"update" with the
same id) and writes the result to public/data/captures_<table>.json, so the
next `vite build` bundles field-captured data into the deployed site.

NOTE on scope: docs also mention folding into "app_data/" — that directory
doesn't exist in this repo, and the one place an "app_data/..." path is used
today (BridgeWorksSection.tsx's "Source: app_data/bridge_works_2026.json"
comment) refers to a hand-curated one-off file, not a per-table sync target.
DOCUMENTATION.md's own "Data flow" table names only public/data/ as what the
deployed site actually reads, so that's the sole output of this script.

Usage:
    python drive_sync.py                 # uses DRIVE_DATA_DIR from
                                          # server/.env, or its G: Drive
                                          # default if unset
    python drive_sync.py --drive-dir /path/to/captures
    python drive_sync.py --out-dir public/data
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# Mirrors WRITABLE_TABLES in server/index.js. Keep in sync with that object —
# this list only affects which captures/*.jsonl files we know to look for and
# what their id column is called; an unlisted table's JSONL (if one somehow
# exists) is skipped with a warning rather than guessed at.
WRITABLE_TABLES = {
    "road_link_condition":         "id",
    "structure_condition_history": "id",
    "inspections":                 "id",
    "work_orders":                 "id",
    "bridge_documents":            "id",
    "maintenance_programme":       "id",
    "road_reserve_records":        "id",
    "road_reserve_encroachments":  "id",
    "road_reserve_gazette":        "id",
    "road_reserve_applicants":     "id",
    "road_reserve_applications":   "id",
    "project_tracker":             "id",
}

DEFAULT_DRIVE_DIR = "G:/My Drive/MOWT/Uganda National Road Network Repository/captures"


def _server_env_drive_dir() -> str | None:
    """Read DRIVE_DATA_DIR out of server/.env, the same override
    server/index.js itself uses, so this script folds the same captures the
    server actually wrote (not necessarily the Windows-mapped-drive default)."""
    env_path = HERE / "server" / ".env"
    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("DRIVE_DATA_DIR="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return None


def fold_table(jsonl_path: Path, id_column: str) -> list[dict]:
    """Replay one table's append-only JSONL into current-state rows.

    Each line is {_op, _at, <id_column>, ...fields}. "insert" adds/replaces
    the row for that id outright; "update" shallow-merges its fields onto
    the existing row for that id (falling back to insert if the id was never
    seen — e.g. the insert line predates DRIVE_DATA_DIR being pointed here).
    _op/_at are bookkeeping only and are not included in the folded output.
    """
    rows: dict[str, dict] = {}
    order: list[str] = []
    with jsonl_path.open("r", encoding="utf-8") as fh:
        for lineno, raw in enumerate(fh, start=1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                rec = json.loads(raw)
            except json.JSONDecodeError as e:
                print(f"   [warn] {jsonl_path.name}:{lineno} skipped (bad JSON: {e})")
                continue
            rid = rec.get(id_column)
            if rid is None:
                print(f"   [warn] {jsonl_path.name}:{lineno} skipped (no '{id_column}')")
                continue
            rid = str(rid)
            fields = {k: v for k, v in rec.items() if k not in ("_op", "_at")}
            if rid in rows:
                rows[rid].update(fields)
            else:
                rows[rid] = fields
                order.append(rid)
    return [rows[rid] for rid in order]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--drive-dir", help="Directory containing <table>.jsonl capture files "
                                          "(default: server/.env's DRIVE_DATA_DIR, else the G: Drive default)")
    ap.add_argument("--out-dir", default=str(HERE / "public" / "data"),
                     help="Where to write captures_<table>.json (default: public/data)")
    args = ap.parse_args()

    drive_dir = Path(args.drive_dir or _server_env_drive_dir() or DEFAULT_DRIVE_DIR)
    out_dir = Path(args.out_dir)

    print(f"\nUganda National Roads — drive_sync\n{'=' * 52}")
    print(f"captures dir : {drive_dir}")
    print(f"output dir   : {out_dir}\n")

    if not drive_dir.exists():
        print(f"[error] captures directory not found: {drive_dir}")
        print("        (nothing to fold — this is expected if no field data has been")
        print("        captured yet, or DRIVE_DATA_DIR/--drive-dir points elsewhere)")
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)

    # Fold every *.jsonl file present, using the known id column when we
    # recognize the table, and "id" as a reasonable default otherwise (with a
    # warning) rather than silently skipping data the server actually wrote.
    found_any = False
    for jsonl_path in sorted(drive_dir.glob("*.jsonl")):
        table = jsonl_path.stem
        found_any = True
        if table not in WRITABLE_TABLES:
            print(f"   [warn] {jsonl_path.name}: table not in WRITABLE_TABLES — "
                  f"folding with id column 'id' as a best guess")
        id_column = WRITABLE_TABLES.get(table, "id")
        rows = fold_table(jsonl_path, id_column)
        out_path = out_dir / f"captures_{table}.json"
        out_path.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"   OK   {table:<28} {len(rows):>5} record(s)  -> {out_path.relative_to(HERE) if out_path.is_relative_to(HERE) else out_path}")

    if not found_any:
        print("   (no *.jsonl files found — nothing captured yet)")

    print(f"\n{'=' * 52}\nDone. Rebuild + redeploy to publish captured data.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
