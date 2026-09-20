#!/usr/bin/env python3
"""Validate improve plan markdown files.

Exit codes: 0 pass, 2 validation findings, 3 invocation/I/O failure.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REQUIRED = [
    "Status", "Outcome", "Evidence and current behavior", "Assumptions", "Scope",
    "Implementation constraints", "Steps", "Test plan", "Verification matrix",
    "Rollback or containment", "Done criteria", "STOP conditions", "Review focus", "Deferred work",
]
PLAN_NAME = re.compile(r"^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$")
SHA = re.compile(r"\*\*Planned at\*\*:\s*`?([0-9a-f]{40})`?", re.I)
PLACEHOLDER = re.compile(r"<[^>\n]+>|\bTBD\b|\bFIXME\b|\{\{[^}]+\}\}", re.I)


def targets(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    if path.is_dir():
        return sorted(p for p in path.glob("*.md") if p.name.lower() != "readme.md")
    raise FileNotFoundError(path)


def section(text: str, name: str) -> str:
    match = re.search(rf"(?ms)^## {re.escape(name)}\s*$\n(.*?)(?=^## |\Z)", text)
    return match.group(1).strip() if match else ""


def validate(path: Path, allow_todo: bool) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read: {exc}"], warnings
    if not PLAN_NAME.match(path.name):
        warnings.append("filename should match NNN-short-slug.md")
    if not re.search(r"(?m)^# Plan \d{3}: .+", text):
        errors.append("missing '# Plan NNN: <title>' heading")
    for name in REQUIRED:
        if not re.search(rf"(?m)^## {re.escape(name)}\s*$", text):
            errors.append(f"missing required section: {name}")
    if not SHA.search(text):
        errors.append("Status must include a full 40-character Planned at SHA")
    if not re.search(r"(?m)^- \*\*Finding ID\*\*: [A-Z]+-\d{3}\s*$", text):
        errors.append("Status must include a stable Finding ID")
    if not re.search(r"(?m)^- \*\*State\*\*: (TODO|IN_PROGRESS|DONE|BLOCKED|REJECTED|SUPERSEDED)\s*$", text):
        errors.append("Status has missing or invalid State")
    kind = re.search(r"(?m)^- \*\*Type\*\*: ([\w-]+)\s*$", text)
    if not kind or kind.group(1) not in {"corrective", "investigation", "direction-spike"}:
        errors.append("Status has missing or invalid Type")
    risk = re.search(r"(?m)^- \*\*Implementation risk\*\*: (LOW|MED|HIGH)\s*$", text)
    rollback = section(text, "Rollback or containment")
    if risk and risk.group(1) in {"MED", "HIGH"} and (not rollback or rollback.lower().startswith("not required")):
        errors.append("MED/HIGH-risk plan requires actionable rollback or containment")
    step_matches = list(re.finditer(r"(?ms)^### Step \d+: .+?(?=^### Step |^## |\Z)", section(text, "Steps")))
    if not step_matches:
        errors.append("Steps must contain at least one '### Step N:' subsection")
    for idx, match in enumerate(step_matches, 1):
        block = match.group(0)
        if "**Verify**:" not in block or "**Expected**:" not in block:
            errors.append(f"Step {idx} must include Verify and Expected gates")
    done = section(text, "Done criteria")
    if len(re.findall(r"(?m)^- \[ \] ", done)) < 3:
        errors.append("Done criteria must contain at least three unchecked checklist items")
    stop = section(text, "STOP conditions")
    if len(re.findall(r"(?m)^- ", stop)) < 3:
        errors.append("STOP conditions must contain at least three conditions")
    scope = section(text, "Scope")
    if "**In scope**" not in scope or not re.search(r"(?m)^- `[^`]+`", scope):
        errors.append("Scope must list at least one exact in-scope path")
    if PLACEHOLDER.search(text):
        errors.append("unresolved template placeholder detected")
    if not allow_todo and kind and kind.group(1) == "corrective" and re.search(r"(?m)^- \[TODO\]", section(text, "Assumptions")):
        errors.append("corrective plan contains unresolved TODO assumption")
    if len(text.splitlines()) > 350:
        warnings.append("plan exceeds 350 lines; remove nonessential copied context")
    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--allow-todo", action="store_true")
    args = parser.parse_args()
    try:
        paths = targets(args.path)
    except FileNotFoundError:
        print(json.dumps({"status": "error", "message": f"path not found: {args.path}"}), file=sys.stderr)
        return 3
    if not paths:
        print(json.dumps({"status": "error", "message": "no plan files found"}), file=sys.stderr)
        return 3
    reports = []
    failed = False
    for path in paths:
        errors, warnings = validate(path, args.allow_todo)
        reports.append({"path": str(path), "errors": errors, "warnings": warnings})
        failed = failed or bool(errors)
    result = {"status": "fail" if failed else "pass", "files": reports}
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        for report in reports:
            print(report["path"])
            for error in report["errors"]:
                print(f"  ERROR: {error}")
            for warning in report["warnings"]:
                print(f"  WARN: {warning}")
        print(result["status"].upper())
    return 2 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
