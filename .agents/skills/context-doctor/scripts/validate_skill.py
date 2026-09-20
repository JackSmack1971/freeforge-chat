#!/usr/bin/env python3
"""Validate the portable Context Doctor package."""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    ROOT / "SKILL.md",
    ROOT / "references" / "audit-playbook.md",
    ROOT / "references" / "official-sources.md",
    ROOT / "references" / "portability-security.md",
    ROOT / "references" / "report-contract.md",
    ROOT / "scripts" / "context_inventory.py",
    ROOT / "scripts" / "validate_skill.py",
    ROOT / "tests" / "evaluation-cases.md",
)
SUPPORTED_FRONTMATTER = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}


def frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}
    result = {}
    for line in text.splitlines()[1:]:
        if line == "---":
            return result
        if ":" in line and not line[:1].isspace():
            key, value = line.split(":", 1)
            result[key.strip()] = value.strip().strip("'\"")
    return {}


def main() -> int:
    errors = [f"missing required file: {p.relative_to(ROOT)}" for p in REQUIRED if not p.is_file()]
    skill = ROOT / "SKILL.md"
    fm = frontmatter(skill.read_text(encoding="utf-8")) if skill.is_file() else {}
    if fm.get("name") != ROOT.name:
        errors.append("frontmatter name must match the skill directory")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", fm.get("name", "")):
        errors.append("name must use lowercase letters, digits, and single hyphens")
    if not fm.get("description"):
        errors.append("description is required")
    unsupported = sorted(set(fm) - SUPPORTED_FRONTMATTER)
    if unsupported:
        errors.append(f"unsupported frontmatter keys: {', '.join(unsupported)}")
    if skill.is_file() and len(skill.read_text(encoding="utf-8").splitlines()) > 500:
        errors.append("SKILL.md exceeds 500 lines")
    for path in ROOT.rglob("*.py"):
        try:
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as exc:
            errors.append(f"syntax error in {path.relative_to(ROOT)}: {exc}")
    for path in ROOT.rglob("*"):
        if path.is_file() and path.suffix in {".md", ".py"}:
            text = path.read_text(encoding="utf-8", errors="replace")
            if re.search(r"characters\s*/\s*4|ceil\s*\(\s*len\([^)]*\)\s*/\s*4", text, re.I):
                errors.append(f"{path.relative_to(ROOT)} contains a token heuristic")
    print(json.dumps({"status": "ok" if not errors else "fail", "errors": errors}, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
