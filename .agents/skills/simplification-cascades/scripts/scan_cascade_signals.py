#!/usr/bin/env python3
"""Read-only heuristic scan for simplification-cascade signals."""

import argparse
import json
import re
from pathlib import Path

CODE_SUFFIXES = {".ts", ".js", ".py", ".go"}
CONFIG_SUFFIXES = {".json", ".yaml", ".yml", ".toml"}
BRANCH_RE = re.compile(r"^\s*(if|elif|else if|case|switch|catch|except)\b")
KEY_RE = re.compile(r"^\s*[A-Za-z_][A-Za-z0-9_]*\s*[:=]")


def files_under(target: Path, suffixes: set[str]) -> list[Path]:
    return sorted(
        path for path in target.rglob("*") if path.is_file() and path.suffix in suffixes
    )


def scan(target: Path, verify: bool) -> dict:
    code_files = files_under(target, CODE_SUFFIXES)
    config_files = files_under(target, CONFIG_SUFFIXES)
    line_counts = {path: len(path.read_text(encoding="utf-8", errors="replace").splitlines()) for path in code_files}

    duplicate_patterns = []
    seen_counts = []
    for path, count in line_counts.items():
        if any(abs(count - seen) < seen // 7 + 1 and count > 20 for seen in seen_counts):
            duplicate_patterns.append(str(path))
        seen_counts.append(count)

    special_case_hotspots = []
    for path in code_files:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        branches = sum(bool(BRANCH_RE.search(line)) for line in lines)
        if branches > len(lines) // 8 and branches > 4:
            special_case_hotspots.append(str(path))

    config_bloat_files = []
    for path in config_files:
        keys = sum(bool(KEY_RE.search(line)) for line in path.read_text(encoding="utf-8", errors="replace").splitlines())
        if keys > 50:
            config_bloat_files.append(str(path))

    counts = {
        "duplicate_pattern_files": len(duplicate_patterns),
        "special_case_hotspot_files": len(special_case_hotspots),
        "config_bloat_files": len(config_bloat_files),
    }
    score = min(100, counts["duplicate_pattern_files"] * 15 + counts["special_case_hotspot_files"] * 10 + counts["config_bloat_files"] * 8)
    return {
        "scan_target": str(target),
        "verify_mode": verify,
        "duplicate_patterns": duplicate_patterns,
        "special_case_hotspots": special_case_hotspots,
        "config_bloat_files": config_bloat_files,
        "post_cascade_score" if verify else "cascade_score": score,
        "signal_counts": counts,
        "status": "SIGNALS_FOUND" if score else "NO_SIGNALS",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", default=".")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    target = Path(args.path)
    if not target.is_dir():
        print(json.dumps({"error": f"Target path does not exist: {target}", "cascade_score": 0}))
        return 1
    print(json.dumps(scan(target, args.verify), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
