#!/usr/bin/env python3
"""Validate a Codex skill with only the Python standard library."""

import re
import sys
from pathlib import Path

ALLOWED = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}


def validate_skill(skill_path: str | Path) -> tuple[bool, str]:
    root = Path(skill_path)
    path = root / "SKILL.md"
    if not path.is_file():
        return False, "SKILL.md not found"
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        return False, "missing frontmatter"
    try:
        end = next(i for i, line in enumerate(lines[1:], 1) if line.strip() == "---")
    except StopIteration:
        return False, "missing frontmatter terminator"

    keys = set()
    for line in lines[1:end]:
        if not line.strip() or line.startswith((" ", "\t")):
            continue
        key = line.split(":", 1)[0].strip()
        keys.add(key)
    unexpected = keys - ALLOWED
    if unexpected:
        return False, f"unsupported frontmatter: {', '.join(sorted(unexpected))}"
    values = {line.split(":", 1)[0].strip(): line.split(":", 1)[1].strip().strip("\"'")
              for line in lines[1:end] if ":" in line and not line.startswith((" ", "\t"))}
    name = values.get("name", "")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name) or len(name) > 64:
        return False, "name must be lowercase kebab-case and <= 64 characters"
    if root.name != name:
        return False, "name must match the skill directory"
    description = values.get("description", "")
    if description in {">", "|", ">-", "|-"}:
        description = " ".join(line.strip() for line in lines[1:end]
                               if line.startswith(("  ", "\t")))
    if not description or len(description) > 1024 or "<" in description or ">" in description:
        return False, "description must be non-empty, <= 1024 characters, and contain no angle brackets"
    return True, "Skill is valid"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python quick_validate.py <skill-directory>")
    ok, message = validate_skill(sys.argv[1])
    print(message)
    raise SystemExit(0 if ok else 1)
