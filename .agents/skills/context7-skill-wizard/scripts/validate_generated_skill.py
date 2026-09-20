#!/usr/bin/env python3
"""Validate a generated Open Agent skill using only the standard library."""

import re
import sys
from pathlib import Path

ALLOWED = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}


def _frontmatter(lines):
    if not lines or lines[0].strip() != "---":
        return {}, lines
    try:
        end = next(i for i, line in enumerate(lines[1:], 1) if line.strip() == "---")
    except StopIteration:
        return {}, lines
    values = {}
    for line in lines[1:end]:
        if line.strip() and not line.startswith((" ", "\t")) and ":" in line:
            key, value = line.split(":", 1)
            values[key.strip()] = value.strip().strip("\"'")
    return values, lines[end + 1:]


def validate(skill_dir):
    root = Path(skill_dir)
    path = root / "SKILL.md"
    if not path.is_file():
        return ["SKILL.md not found"]
    frontmatter, body = _frontmatter(path.read_text(encoding="utf-8").splitlines())
    errors = []
    name = frontmatter.get("name", "")
    if set(frontmatter) - ALLOWED:
        errors.append("unsupported frontmatter: " + ", ".join(sorted(set(frontmatter) - ALLOWED)))
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name or "") or len(name) > 64:
        errors.append("name must be lowercase kebab-case and <= 64 characters")
    if name != root.name:
        errors.append("name must match the skill directory")
    description = frontmatter.get("description", "")
    if not description or len(description) > 1024 or "<" in description or ">" in description:
        errors.append("description must be non-empty, <= 1024 characters, and contain no angle brackets")
    if len([line for line in body if line.strip()]) > 500:
        errors.append("body exceeds 500 non-empty lines")
    if any("references/" in line and re.search(r"references/[^/]+/", line) for line in body):
        errors.append("references must be one level deep")
    if (root / "README.md").exists():
        errors.append("README.md is not part of a skill package")
    return errors


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python validate_generated_skill.py <skill-directory>")
    failures = validate(sys.argv[1])
    for failure in failures:
        print(f"FAIL: {failure}")
    if failures:
        raise SystemExit(1)
    print("PASS: generated skill is valid")
