#!/usr/bin/env python3
"""Deterministic structural checks for the skill package."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "SKILL.md"


def main() -> int:
    failures: list[str] = []
    text = SKILL.read_text(encoding="utf-8")
    lines = text.splitlines()

    if not lines or lines[0] != "---":
        failures.append("SKILL.md must begin with exact YAML delimiter")
    try:
        close = lines.index("---", 1)
    except ValueError:
        failures.append("SKILL.md frontmatter is unclosed")
        close = 0

    frontmatter = lines[1:close]
    metadata: dict[str, str] = {}
    for line in frontmatter:
        if ":" in line:
            key, value = line.split(":", 1)
            metadata[key.strip()] = value.strip()

    name = metadata.get("name", "")
    description = metadata.get("description", "")
    if not name or len(name) > 64:
        failures.append(f"name must be 1-64 characters; found {len(name)}")
    if not description or len(description) > 1024:
        failures.append(f"description must be 1-1024 characters; found {len(description)}")
    if re.search(r"\b(?:I|you|your)\b", description, re.IGNORECASE):
        failures.append("description should be third-person and avoid first/second-person pronouns")
    for trigger in ("DESIGN.md", "design-system", "typography", "spacing", "component"):
        if trigger.casefold() not in description.casefold():
            failures.append(f"description missing discovery term: {trigger}")

    if len(lines) > 500:
        failures.append(f"SKILL.md exceeds 500 lines: {len(lines)}")

    referenced = re.findall(r"`((?:resources|scripts)/[^`]+)`", text)
    for relative in referenced:
        # Strip CLI suffixes accidentally captured after a path.
        clean = relative.split()[0]
        target = ROOT / clean
        if not target.exists():
            failures.append(f"referenced file does not exist: {clean}")
        if clean.startswith("resources/") and clean.count("/") != 1:
            failures.append(f"reference is deeper than one level: {clean}")

    required = [
        "resources/design-md-spec.md",
        "resources/questionnaire.md",
        "resources/output-contract.md",
        "resources/evaluations.md",
        "resources/portability.md",
        "scripts/validate_design_md.py",
    ]
    for relative in required:
        if not (ROOT / relative).is_file():
            failures.append(f"missing required pack file: {relative}")

    payload = {
        "status": "fail" if failures else "pass",
        "checks": {
            "name_chars": len(name),
            "description_chars": len(description),
            "skill_lines": len(lines),
            "referenced_paths": len(referenced),
        },
        "failures": failures,
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
