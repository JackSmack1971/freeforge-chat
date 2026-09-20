#!/usr/bin/env python3
"""Safely render or apply a validated changelog plan."""
from __future__ import annotations

import argparse
import difflib
import importlib.util
import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

EXIT_USAGE = 2
EXIT_VALIDATION = 4
EXIT_IO = 5
EXIT_UNSAFE = 6
SECTIONS = ("Added", "Changed", "Deprecated", "Removed", "Fixed", "Security")
VERSION_RE = re.compile(r"^## \[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?[ \t]*$", re.MULTILINE)
LINK_RE = re.compile(r"^\[([^\]]+)\]:\s+(\S+)\s*$", re.MULTILINE)


def emit(payload: Dict[str, Any], *, stream: Any = sys.stdout) -> None:
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True), file=stream)


def fail(message: str, code: int, details: Optional[List[str]] = None) -> "NoReturn":
    emit(
        {
            "ok": False,
            "operation": "apply-changelog",
            "error": message,
            "details": details or [],
        },
        stream=sys.stderr,
    )
    raise SystemExit(code)


def load_validator() -> Any:
    path = Path(__file__).with_name("validate_plan.py")
    spec = importlib.util.spec_from_file_location("changelog_validate_plan", path)
    if spec is None or spec.loader is None:
        fail("unable to load plan validator", EXIT_IO)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_plan(path: Path) -> Dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        fail(f"unable to read plan: {path}", EXIT_IO, [str(exc)])
    except json.JSONDecodeError as exc:
        fail("plan is not valid JSON", EXIT_VALIDATION, [f"line {exc.lineno}: {exc.msg}"])
    if not isinstance(value, dict):
        fail("plan root must be an object", EXIT_VALIDATION)
    validator = load_validator()
    errors, warnings = validator.validate_plan(value)
    if errors:
        fail("plan validation failed", EXIT_VALIDATION, errors)
    value["_validation_warnings"] = warnings
    return value


def resolve_repo(repo_arg: str) -> Path:
    candidate = Path(repo_arg).expanduser().resolve()
    if not candidate.is_dir():
        fail(f"repository path is not a directory: {candidate}", EXIT_IO)
    return candidate


def resolve_target(repo: Path, target_value: str) -> Path:
    target = (repo / target_value).resolve()
    try:
        target.relative_to(repo)
    except ValueError:
        fail("target path escapes repository", EXIT_UNSAFE, [str(target)])
    return target


def normalize_entry(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[`*_.,;:!?]", "", text).strip().lower())


def entry_text(entry: Dict[str, Any]) -> str:
    text = str(entry["text"]).strip()
    if entry.get("breaking") and not text.lower().startswith("**breaking:**"):
        text = f"**Breaking:** {text}"
    return text


def default_prefix(plan: Dict[str, Any]) -> str:
    title = str(plan.get("title", "Changelog")).strip()
    preamble = str(plan.get("preamble", "")).strip()
    result = f"# {title}\n"
    if preamble:
        result += f"\n{preamble}\n"
    return result.rstrip() + "\n\n"


def parse_blocks(text: str) -> Tuple[str, List[Dict[str, Any]]]:
    matches = list(VERSION_RE.finditer(text))
    if not matches:
        return text, []
    prefix = text[: matches[0].start()]
    blocks: List[Dict[str, Any]] = []
    for index, match in enumerate(matches):
        body_start = match.end()
        body_end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        body = text[body_start:body_end]
        blocks.append(
            {
                "version": match.group(1),
                "date": match.group(2),
                "heading_raw": match.group(0),
                "body": body,
                "modified": False,
            }
        )
    return prefix, blocks


def render_block(version: str, date: Optional[str], body: str) -> str:
    heading = f"## [{version}]"
    if date:
        heading += f" - {date}"
    clean_body = body.strip("\n")
    if clean_body:
        return f"{heading}\n\n{clean_body}\n\n"
    return f"{heading}\n\n"


def render_sections(sections: Dict[str, Any]) -> str:
    chunks: List[str] = []
    for section in SECTIONS:
        entries = sections.get(section, [])
        if not entries:
            continue
        bullets = [f"- {entry_text(entry)}" for entry in entries]
        chunks.append(f"### {section}\n\n" + "\n".join(bullets))
    return "\n\n".join(chunks)


def existing_bullets(lines: Sequence[str]) -> set[str]:
    values: set[str] = set()
    for line in lines:
        match = re.match(r"^\s*[-*+]\s+(.+?)\s*$", line)
        if match:
            values.add(normalize_entry(match.group(1)))
    return values


def find_heading(lines: Sequence[str], section: str) -> Optional[int]:
    target = f"### {section}".lower()
    for index, line in enumerate(lines):
        if line.strip().lower() == target:
            return index
    return None


def next_section_heading(lines: Sequence[str], start: int) -> int:
    for index in range(start + 1, len(lines)):
        if lines[index].startswith("### "):
            return index
    return len(lines)


def insertion_index_for_missing(lines: Sequence[str], section: str) -> int:
    desired = SECTIONS.index(section)
    for later in SECTIONS[desired + 1 :]:
        index = find_heading(lines, later)
        if index is not None:
            return index
    return len(lines)


def ensure_blank_boundary(lines: List[str], index: int) -> None:
    if index > 0 and lines[index - 1].strip():
        lines.insert(index, "")


def inject_sections(body: str, sections: Dict[str, Any]) -> Tuple[str, int]:
    lines = body.strip("\n").splitlines() if body.strip("\n") else []
    known = existing_bullets(lines)
    added_count = 0

    for section in SECTIONS:
        fresh: List[str] = []
        for entry in sections.get(section, []):
            text = entry_text(entry)
            normalized = normalize_entry(text)
            if normalized not in known:
                fresh.append(f"- {text}")
                known.add(normalized)
        if not fresh:
            continue

        heading_index = find_heading(lines, section)
        if heading_index is not None:
            end = next_section_heading(lines, heading_index)
            insert_at = end
            while insert_at > heading_index + 1 and not lines[insert_at - 1].strip():
                insert_at -= 1
            if insert_at == heading_index + 1:
                lines.insert(insert_at, "")
                insert_at += 1
            lines[insert_at:insert_at] = fresh
        else:
            insert_at = insertion_index_for_missing(lines, section)
            block = [f"### {section}", "", *fresh, ""]
            if insert_at == len(lines):
                if lines and lines[-1].strip():
                    lines.append("")
                lines.extend(block)
            else:
                ensure_blank_boundary(lines, insert_at)
                # ensure_blank_boundary may shift the insertion point by one
                insert_at = insertion_index_for_missing(lines, section)
                lines[insert_at:insert_at] = block
        added_count += len(fresh)

    result = "\n".join(lines).strip("\n")
    return (f"\n{result}\n" if result else "\n"), added_count


def update_links(text: str, links: Dict[str, str]) -> str:
    if not links:
        return text
    updated = text
    for label, url in links.items():
        pattern = re.compile(rf"^\[{re.escape(label)}\]:\s+\S+\s*$", re.MULTILINE)
        replacement = f"[{label}]: {url}"
        if pattern.search(updated):
            updated = pattern.sub(replacement, updated, count=1)
        else:
            updated = updated.rstrip() + f"\n\n{replacement}\n"
    return updated


def render_reconstruction(plan: Dict[str, Any]) -> str:
    output = default_prefix(plan)
    for release in plan["releases"]:
        body = render_sections(release.get("sections", {}))
        output += render_block(release["version"], release.get("date"), body)
    output = update_links(output.rstrip() + "\n", plan.get("links", {}))
    return output.rstrip() + "\n"


def apply_incremental(existing: str, plan: Dict[str, Any]) -> Tuple[str, int]:
    if existing and not re.search(r"^#\s+.+$", existing, re.MULTILINE):
        fail("existing changelog has no level-one title", EXIT_UNSAFE)

    prefix, blocks = parse_blocks(existing)
    if not existing:
        prefix = default_prefix(plan)
    elif not blocks:
        fail(
            "existing changelog has no version headings; use a reconstruction plan or repair it first",
            EXIT_UNSAFE,
        )

    unreleased_index = next(
        (index for index, block in enumerate(blocks) if block["version"].lower() == "unreleased"),
        None,
    )
    if unreleased_index is None:
        blocks.insert(
            0,
            {
                "version": "Unreleased",
                "date": None,
                "heading_raw": None,
                "body": "\n",
                "modified": True,
            },
        )
        unreleased_index = 0

    release = plan["releases"][0]
    enriched_body, added_count = inject_sections(blocks[unreleased_index]["body"], release.get("sections", {}))

    if plan["action"] == "update_unreleased":
        blocks[unreleased_index]["body"] = enriched_body
        blocks[unreleased_index]["modified"] = True
    elif plan["action"] == "release":
        target_version = release["version"]
        if any(block["version"].lower() == target_version.lower() for block in blocks):
            fail(f"release already exists: {target_version}", EXIT_UNSAFE)
        blocks[unreleased_index]["body"] = "\n"
        blocks[unreleased_index]["modified"] = True
        blocks.insert(
            unreleased_index + 1,
            {
                "version": target_version,
                "date": release["date"],
                "heading_raw": None,
                "body": enriched_body,
                "modified": True,
            },
        )
    else:
        fail(f"unsupported incremental action: {plan['action']}", EXIT_UNSAFE)

    output = prefix
    for block in blocks:
        if block.get("modified"):
            output += render_block(block["version"], block.get("date"), block.get("body", ""))
        else:
            output += str(block.get("heading_raw") or "") + str(block.get("body", ""))
    if not output.endswith("\n"):
        output += "\n"
    output = update_links(output, plan.get("links", {}))
    if not output.endswith("\n"):
        output += "\n"
    return output, added_count


def unified_diff(old: str, new: str, target: Path) -> str:
    return "".join(
        difflib.unified_diff(
            old.splitlines(keepends=True),
            new.splitlines(keepends=True),
            fromfile=f"a/{target.name}",
            tofile=f"b/{target.name}",
        )
    )


def atomic_write(target: Path, content: str, *, backup: bool) -> Optional[Path]:
    target.parent.mkdir(parents=True, exist_ok=True)
    backup_path: Optional[Path] = None
    if target.exists() and backup:
        backup_path = target.with_name(target.name + ".bak")
        try:
            shutil.copy2(target, backup_path)
        except OSError as exc:
            fail("unable to create backup", EXIT_IO, [str(exc)])
    temp = target.with_name(f".{target.name}.tmp-{os.getpid()}")
    try:
        temp.write_text(content, encoding="utf-8")
        os.replace(temp, target)
    except OSError as exc:
        try:
            temp.unlink(missing_ok=True)
        except OSError:
            pass
        fail("unable to write changelog", EXIT_IO, [str(exc)])
    return backup_path


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".")
    parser.add_argument("--plan", required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--write", action="store_true")
    parser.add_argument("--allow-replace", action="store_true")
    parser.add_argument("--no-backup", action="store_true")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    repo = resolve_repo(args.repo)
    plan_path = Path(args.plan).expanduser()
    if not plan_path.is_absolute():
        plan_path = repo / plan_path
    plan = load_plan(plan_path.resolve())
    target = resolve_target(repo, plan["target_file"])

    try:
        existing = target.read_text(encoding="utf-8") if target.exists() else ""
    except OSError as exc:
        fail("unable to read existing changelog", EXIT_IO, [str(exc)])

    if plan["action"] == "reconstruct":
        if args.write and not args.allow_replace:
            fail("reconstruction write requires --allow-replace", EXIT_UNSAFE)
        new_content = render_reconstruction(plan)
        added_count = sum(
            len(entries)
            for release in plan["releases"]
            for entries in release.get("sections", {}).values()
        )
    else:
        new_content, added_count = apply_incremental(existing, plan)

    diff = unified_diff(existing, new_content, target)
    if args.dry_run:
        emit(
            {
                "ok": True,
                "operation": "apply-changelog",
                "mode": "dry-run",
                "action": plan["action"],
                "target": str(target),
                "changed": existing != new_content,
                "entries_added": added_count,
                "diff": diff,
                "warnings": plan.get("_validation_warnings", []),
            }
        )
        return 0

    if existing == new_content:
        emit(
            {
                "ok": True,
                "operation": "apply-changelog",
                "mode": "write",
                "action": plan["action"],
                "target": str(target),
                "changed": False,
                "entries_added": 0,
                "backup": None,
                "warnings": plan.get("_validation_warnings", []),
            }
        )
        return 0

    backup_path = atomic_write(target, new_content, backup=not args.no_backup)
    emit(
        {
            "ok": True,
            "operation": "apply-changelog",
            "mode": "write",
            "action": plan["action"],
            "target": str(target),
            "changed": True,
            "entries_added": added_count,
            "backup": str(backup_path) if backup_path else None,
            "warnings": plan.get("_validation_warnings", []),
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
