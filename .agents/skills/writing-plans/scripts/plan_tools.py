"""Small cross-platform helpers for the writing-plans skill."""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

FORBIDDEN = ("TBD", "TODO", "implement later", "fill in details", "Add appropriate error handling", "add validation", "handle edge cases")


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("date")
    validate = sub.add_parser("validate")
    validate.add_argument("--plan-path", required=True)
    save = sub.add_parser("save")
    save.add_argument("--path", required=True)
    save.add_argument("--content", required=True)
    args = parser.parse_args()

    if args.command == "date":
        print(f"DATE={dt.date.today():%Y-%m-%d}")
        return 0
    if args.command == "save":
        path = Path(args.path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(args.content, encoding="utf-8")
        if not path.is_file() or not path.stat().st_size:
            print(json.dumps({"error": f"File was not written or is empty: {path}"}))
            return 1
        print(f"STATUS: SAVED\nPATH: {path}")
        return 0

    path = Path(args.plan_path)
    if not path.is_file():
        print(json.dumps({"error": f"File not found: {path}"}))
        return 1
    lines = path.read_text(encoding="utf-8").splitlines()
    hits = [f"{i}:{line}" for i, line in enumerate(lines, 1) if any(p.lower() in line.lower() for p in FORBIDDEN)]
    result = {"plan_path": str(path), "task_count": sum(line.startswith("### Task ") for line in lines), "placeholder_hits": hits, "placeholder_hit_count": len(hits), "spec_gaps": [], "type_inconsistencies": [], "status": "FAIL" if hits else "PASS"}
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
