#!/usr/bin/env python3
"""Create a deterministic, read-only inventory of a Open Agent skill."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

EXCLUDED_DIRS = {".git", ".hg", ".svn", "node_modules", ".venv", "venv", "__pycache__"}
MARKDOWN_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")


def fail(message: str, code: int) -> "NoReturn":
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(code)


def parse_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    if end < 0:
        return {}
    lines = text[4:end].splitlines()
    result: dict[str, str] = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if ":" not in line or line.lstrip().startswith("#"):
            i += 1
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if value in {">", ">-", "|", "|-"}:
            block: list[str] = []
            i += 1
            while i < len(lines) and (lines[i].startswith(" ") or not lines[i].strip()):
                block.append(lines[i].strip())
                i += 1
            result[key] = " ".join(part for part in block if part)
            continue
        result[key] = value.strip('"\'')
        i += 1
    return result


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def iter_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for current, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED_DIRS)
        for name in sorted(names):
            files.append(Path(current) / name)
    return files


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", help="Skill directory or SKILL.md path")
    parser.add_argument("--output", help="Optional JSON output file")
    parser.add_argument("--max-bytes", type=int, default=2_000_000, help="Maximum bytes read per file")
    args = parser.parse_args()

    target = Path(args.target).expanduser().resolve()
    if not target.exists():
        fail(f"target does not exist: {target}", 3)
    root = target.parent if target.is_file() else target
    skill_md = target if target.is_file() else root / "SKILL.md"
    if skill_md.name != "SKILL.md" or not skill_md.is_file():
        fail(f"SKILL.md not found at expected location: {skill_md}", 3)

    records: list[dict[str, Any]] = []
    warnings: list[str] = []
    for path in iter_files(root):
        rel = path.relative_to(root).as_posix()
        stat = path.lstat()
        record: dict[str, Any] = {
            "path": rel,
            "size_bytes": stat.st_size,
            "is_symlink": path.is_symlink(),
        }
        if path.is_symlink():
            record["link_target"] = os.readlink(path)
            warnings.append(f"symlink not followed: {rel}")
        elif stat.st_size > args.max_bytes:
            record["read_status"] = "skipped_too_large"
            warnings.append(f"file exceeds --max-bytes and was not read: {rel}")
        else:
            try:
                data = path.read_bytes()
            except OSError as exc:
                record["read_status"] = "unreadable"
                record["error"] = str(exc)
                warnings.append(f"unreadable file: {rel}")
            else:
                record["sha256"] = sha256_bytes(data)
                record["read_status"] = "read"
                if b"\x00" in data:
                    record["kind"] = "binary_or_nul"
                else:
                    text = data.decode("utf-8", errors="replace")
                    record["kind"] = "text"
                    record["line_count"] = len(text.splitlines())
        records.append(record)

    try:
        skill_text = skill_md.read_text(encoding="utf-8")
    except OSError as exc:
        fail(f"cannot read SKILL.md: {exc}", 4)

    links = []
    for raw in MARKDOWN_LINK_RE.findall(skill_text):
        link = raw.strip().split("#", 1)[0]
        if not link or "://" in link or link.startswith("#"):
            continue
        links.append(link)

    metadata = parse_frontmatter(skill_text)
    payload = {
        "status": "ok",
        "target": str(root),
        "skill_md": skill_md.relative_to(root).as_posix(),
        "metadata": {
            "name": metadata.get("name"),
            "description": metadata.get("description"),
            "name_chars": len(metadata.get("name", "")),
            "description_chars": len(metadata.get("description", "")),
        },
        "direct_markdown_links": sorted(set(links)),
        "files": records,
        "metrics": {
            "file_count": len(records),
            "total_bytes": sum(item["size_bytes"] for item in records),
            "warning_count": len(warnings),
        },
        "warnings": warnings,
    }
    rendered = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    if args.output:
        try:
            output = Path(args.output).expanduser()
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(rendered, encoding="utf-8")
        except OSError as exc:
            fail(f"cannot write output: {exc}", 5)
    sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

