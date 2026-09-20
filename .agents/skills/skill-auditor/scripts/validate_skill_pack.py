#!/usr/bin/env python3
"""Validate a Open Agent skill directory with machine-readable output."""

from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from pathlib import Path
from typing import Any

MARKDOWN_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
KEBAB_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end < 0:
        return {}, text
    raw = text[4:end].splitlines()
    result: dict[str, str] = {}
    i = 0
    while i < len(raw):
        line = raw[i]
        if ":" not in line or line.lstrip().startswith("#"):
            i += 1
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if value in {">", ">-", "|", "|-"}:
            block: list[str] = []
            i += 1
            while i < len(raw) and (raw[i].startswith(" ") or not raw[i].strip()):
                block.append(raw[i].strip())
                i += 1
            result[key] = " ".join(part for part in block if part)
            continue
        result[key] = value.strip('"\'')
        i += 1
    return result, text[end + 4 :].lstrip("\n")


def relative_links(text: str) -> list[str]:
    output: list[str] = []
    for raw in MARKDOWN_LINK_RE.findall(text):
        value = raw.strip().split("#", 1)[0]
        if not value or value.startswith("#") or "://" in value or value.startswith("mailto:"):
            continue
        output.append(value)
    return output


def add(items: list[dict[str, str]], code: str, message: str, path: str = "SKILL.md") -> None:
    items.append({"code": code, "message": message, "path": path})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", help="Skill directory")
    parser.add_argument("--strict", action="store_true", help="Treat warnings as validation failures")
    parser.add_argument("--json-out", help="Optional path for the JSON report")
    args = parser.parse_args()

    root = Path(args.target).expanduser().resolve()
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    if not root.is_dir():
        add(errors, "TARGET_NOT_DIRECTORY", f"target is not a directory: {root}", str(root))
    skill_md = root / "SKILL.md"
    if not skill_md.is_file():
        add(errors, "SKILL_MD_MISSING", "SKILL.md is missing")
        text = ""
        body = ""
        metadata: dict[str, str] = {}
    else:
        try:
            text = skill_md.read_text(encoding="utf-8")
        except OSError as exc:
            add(errors, "SKILL_MD_UNREADABLE", str(exc))
            text = ""
        metadata, body = parse_frontmatter(text)

    name = metadata.get("name", "").strip()
    description = metadata.get("description", "").strip()
    if not name:
        add(errors, "NAME_MISSING", "frontmatter name is required")
    elif len(name) > 64:
        add(errors, "NAME_TOO_LONG", f"name has {len(name)} characters; maximum is 64")
    elif not KEBAB_RE.fullmatch(name):
        add(warnings, "NAME_NOT_KEBAB_CASE", "kebab-case is recommended for portable folder identifiers")

    if not description:
        add(errors, "DESCRIPTION_MISSING", "frontmatter description is required")
    elif len(description) > 1024:
        add(errors, "DESCRIPTION_TOO_LONG", f"description has {len(description)} characters; maximum is 1024")
    if re.search(r"\bI can\b|\bI will\b|\bYou can\b|\bYou should\b", description, flags=re.I):
        add(errors, "DESCRIPTION_NOT_THIRD_PERSON", "description should be written in the third person")

    body_lines = len(body.splitlines())
    if body_lines > 500:
        add(warnings, "BODY_OVER_500_LINES", f"SKILL.md body has {body_lines} lines")
    if body_lines > 100 and not re.search(r"^## (Contents|Table of Contents)\s*$", body, flags=re.M):
        add(warnings, "LONG_SKILL_WITHOUT_TOC", "SKILL.md exceeds 100 lines and has no Contents section")
    if "\\" in text:
        add(warnings, "WINDOWS_PATH_SEPARATOR", "backslash found; use forward-slash paths where possible")

    skill_links = relative_links(text)
    for link in sorted(set(skill_links)):
        candidate = (root / link).resolve()
        try:
            candidate.relative_to(root)
        except ValueError:
            add(errors, "LINK_ESCAPES_ROOT", f"relative link escapes the skill root: {link}")
            continue
        if not candidate.exists():
            add(errors, "BROKEN_LINK", f"linked file does not exist: {link}")

    markdown_files = sorted(root.rglob("*.md")) if root.is_dir() else []
    for md in markdown_files:
        if md == skill_md:
            continue
        try:
            md_text = md.read_text(encoding="utf-8")
        except OSError as exc:
            add(errors, "MARKDOWN_UNREADABLE", str(exc), md.relative_to(root).as_posix())
            continue
        nested = [link for link in relative_links(md_text) if link.lower().endswith(".md")]
        for link in nested:
            add(errors, "NESTED_MARKDOWN_REFERENCE", f"resource links to another markdown resource: {link}", md.relative_to(root).as_posix())
        lines = len(md_text.splitlines())
        if lines > 100 and not re.search(r"^## (Contents|Table of Contents)\s*$", md_text, flags=re.M):
            add(warnings, "LONG_RESOURCE_WITHOUT_TOC", f"resource has {lines} lines and no Contents section", md.relative_to(root).as_posix())

    python_files = sorted(root.rglob("*.py")) if root.is_dir() else []
    for py in python_files:
        rel = py.relative_to(root).as_posix()
        try:
            source = py.read_text(encoding="utf-8")
            ast.parse(source, filename=rel)
        except (OSError, SyntaxError) as exc:
            add(errors, "PYTHON_INVALID", str(exc), rel)

    json_files = sorted(root.rglob("*.json")) if root.is_dir() else []
    for jf in json_files:
        rel = jf.relative_to(root).as_posix()
        try:
            json.loads(jf.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            add(errors, "JSON_INVALID", str(exc), rel)

    todo_count = text.count("[TODO:")
    if todo_count:
        add(warnings, "UNRESOLVED_TODO", f"SKILL.md contains {todo_count} unresolved TODO marker(s)")

    status = "fail" if errors or (args.strict and warnings) else "pass"
    payload: dict[str, Any] = {
        "status": status,
        "target": str(root),
        "errors": errors,
        "warnings": warnings,
        "metrics": {
            "name_chars": len(name),
            "description_chars": len(description),
            "skill_body_lines": body_lines,
            "markdown_files": len(markdown_files),
            "python_files": len(python_files),
            "direct_links": len(set(skill_links)),
        },
    }
    rendered = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    sys.stdout.write(rendered)
    if args.json_out:
        try:
            output = Path(args.json_out).expanduser()
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(rendered, encoding="utf-8")
        except OSError as exc:
            print(f"ERROR: cannot write JSON report: {exc}", file=sys.stderr)
            return 3
    if status == "fail":
        print(f"VALIDATION FAILED: {len(errors)} error(s), {len(warnings)} warning(s)", file=sys.stderr)
        return 1
    print(f"VALIDATION PASSED: {len(warnings)} warning(s)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

