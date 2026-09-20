#!/usr/bin/env python3
"""Validate a changelog mutation plan."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path, PurePosixPath
from typing import Any, Dict, List, Optional, Sequence, Set

EXIT_USAGE = 2
EXIT_VALIDATION = 4
EXIT_IO = 5
ALLOWED_ACTIONS = {"update_unreleased", "release", "reconstruct"}
SECTIONS = ("Added", "Changed", "Deprecated", "Removed", "Fixed", "Security")
PLACEHOLDER_RE = re.compile(r"\b(TODO|TBD|FIXME|CHANGEME|INSERT HERE)\b|\[(?:TODO|TBD)[^\]]*\]|<(?:TODO|TBD|FIXME|CHANGEME|INSERT[^>]*)>", re.I)
COMMIT_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def is_iso_date(value: Any) -> bool:
    if not isinstance(value, str) or not DATE_RE.match(value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def emit(payload: Dict[str, Any], *, stream: Any = sys.stdout) -> None:
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True), file=stream)


def normalize_entry(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[`*_.,;:!?]", "", text).strip().lower())


def load_plan(path: Path) -> Dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        emit(
            {"ok": False, "operation": "validate-plan", "error": str(exc), "details": []},
            stream=sys.stderr,
        )
        raise SystemExit(EXIT_IO)
    except json.JSONDecodeError as exc:
        emit(
            {
                "ok": False,
                "operation": "validate-plan",
                "error": "invalid JSON",
                "details": [f"line {exc.lineno}, column {exc.colno}: {exc.msg}"],
            },
            stream=sys.stderr,
        )
        raise SystemExit(EXIT_VALIDATION)
    if not isinstance(value, dict):
        emit(
            {
                "ok": False,
                "operation": "validate-plan",
                "error": "plan root must be an object",
                "details": [],
            },
            stream=sys.stderr,
        )
        raise SystemExit(EXIT_VALIDATION)
    return value


def validate_target(target: Any, errors: List[str]) -> None:
    if not isinstance(target, str) or not target.strip():
        errors.append("target_file must be a non-empty relative path")
        return
    if "\\" in target:
        errors.append("target_file must use forward slashes")
    pure = PurePosixPath(target)
    if pure.is_absolute() or ".." in pure.parts or pure.parts[0] in {"", "."}:
        errors.append("target_file must remain inside the repository")
    if pure.name.lower() not in {"changelog.md", "changes.md", "history.md"}:
        errors.append("target_file must be a recognized changelog markdown filename")


def validate_plan(plan: Dict[str, Any]) -> tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []

    if plan.get("schema_version") != 1:
        errors.append("schema_version must equal 1")

    action = plan.get("action")
    if action not in ALLOWED_ACTIONS:
        errors.append(f"action must be one of: {', '.join(sorted(ALLOWED_ACTIONS))}")

    validate_target(plan.get("target_file"), errors)

    title = plan.get("title", "Changelog")
    if not isinstance(title, str) or not title.strip() or "\n" in title:
        errors.append("title must be a non-empty single line")

    preamble = plan.get("preamble", "")
    if not isinstance(preamble, str):
        errors.append("preamble must be a string")
    elif PLACEHOLDER_RE.search(preamble):
        errors.append("preamble contains an unresolved placeholder")

    source = plan.get("source")
    if not isinstance(source, dict):
        errors.append("source must be an object")
    else:
        for field in ("mode", "range", "generated_date"):
            if not isinstance(source.get(field), str) or not source[field].strip():
                errors.append(f"source.{field} must be a non-empty string")
        generated_date = source.get("generated_date")
        if isinstance(generated_date, str) and not is_iso_date(generated_date):
            errors.append("source.generated_date must be a valid YYYY-MM-DD date")
        target_version = source.get("target_version")
        if target_version is not None and (not isinstance(target_version, str) or not target_version.strip()):
            errors.append("source.target_version must be null or a non-empty string")
        assumptions = source.get("assumptions", [])
        if not isinstance(assumptions, list) or not all(isinstance(item, str) for item in assumptions):
            errors.append("source.assumptions must be an array of strings")

    releases = plan.get("releases")
    if not isinstance(releases, list) or not releases:
        errors.append("releases must be a non-empty array")
        releases = []

    if action in {"update_unreleased", "release"} and len(releases) != 1:
        errors.append(f"{action} requires exactly one release object")

    versions: Set[str] = set()
    all_entries: Set[str] = set()
    total_entries = 0
    for release_index, release in enumerate(releases):
        prefix = f"releases[{release_index}]"
        if not isinstance(release, dict):
            errors.append(f"{prefix} must be an object")
            continue
        version = release.get("version")
        if not isinstance(version, str) or not version.strip() or "\n" in version:
            errors.append(f"{prefix}.version must be a non-empty single line")
            version = ""
        elif version in versions:
            errors.append(f"duplicate release version: {version}")
        else:
            versions.add(version)
        if version.startswith("[") or version.endswith("]"):
            errors.append(f"{prefix}.version must not include brackets")

        date = release.get("date")
        if version.lower() == "unreleased":
            if date is not None:
                errors.append(f"{prefix}.date must be null for Unreleased")
        else:
            if not is_iso_date(date):
                errors.append(f"{prefix}.date must be a valid YYYY-MM-DD date for released versions")

        sections = release.get("sections")
        if not isinstance(sections, dict):
            errors.append(f"{prefix}.sections must be an object")
            continue
        unknown = sorted(set(sections) - set(SECTIONS))
        if unknown:
            errors.append(f"{prefix}.sections contains unsupported categories: {', '.join(unknown)}")

        release_entries = 0
        for section_name in SECTIONS:
            entries = sections.get(section_name, [])
            if not isinstance(entries, list):
                errors.append(f"{prefix}.sections.{section_name} must be an array")
                continue
            for entry_index, entry in enumerate(entries):
                entry_prefix = f"{prefix}.sections.{section_name}[{entry_index}]"
                if not isinstance(entry, dict):
                    errors.append(f"{entry_prefix} must be an object")
                    continue
                text = entry.get("text")
                if not isinstance(text, str) or not text.strip():
                    errors.append(f"{entry_prefix}.text must be non-empty")
                    continue
                if "\n" in text or "\r" in text:
                    errors.append(f"{entry_prefix}.text must be one line")
                if text.lstrip().startswith(("- ", "* ", "+ ")):
                    errors.append(f"{entry_prefix}.text must not include a bullet marker")
                if PLACEHOLDER_RE.search(text):
                    errors.append(f"{entry_prefix}.text contains an unresolved placeholder")
                normalized = normalize_entry(text)
                if normalized in all_entries:
                    errors.append(f"duplicate entry text: {text}")
                else:
                    all_entries.add(normalized)

                commits = entry.get("commits", [])
                if not isinstance(commits, list) or not all(isinstance(item, str) for item in commits):
                    errors.append(f"{entry_prefix}.commits must be an array of strings")
                else:
                    if not commits:
                        warnings.append(f"{entry_prefix}.commits is empty; traceability is reduced")
                    for commit in commits:
                        if not COMMIT_RE.match(commit):
                            errors.append(f"{entry_prefix}.commits contains invalid commit id: {commit}")
                breaking = entry.get("breaking", False)
                if not isinstance(breaking, bool):
                    errors.append(f"{entry_prefix}.breaking must be boolean")
                elif breaking and section_name not in {"Changed", "Removed"}:
                    errors.append(f"{entry_prefix}.breaking is only valid under Changed or Removed")
                release_entries += 1
                total_entries += 1

        if release_entries == 0:
            warnings.append(f"{prefix} has no changelog entries")

    if action == "update_unreleased" and releases:
        if str(releases[0].get("version", "")).lower() != "unreleased":
            errors.append("update_unreleased requires release version Unreleased")
        if isinstance(source, dict) and source.get("target_version") is not None:
            errors.append("update_unreleased requires source.target_version to be null")
    if action == "release" and releases:
        release_version = str(releases[0].get("version", ""))
        if release_version.lower() == "unreleased":
            errors.append("release requires a concrete target version")
        if isinstance(source, dict) and source.get("target_version") != release_version:
            errors.append("release requires source.target_version to match the release version")
    if action == "reconstruct" and releases:
        unreleased_positions = [
            index
            for index, release in enumerate(releases)
            if isinstance(release, dict) and str(release.get("version", "")).lower() == "unreleased"
        ]
        if unreleased_positions and unreleased_positions != [0]:
            errors.append("Unreleased must appear at most once and first during reconstruction")

    omitted = plan.get("omitted", [])
    if not isinstance(omitted, list):
        errors.append("omitted must be an array")
    else:
        for index, item in enumerate(omitted):
            prefix = f"omitted[{index}]"
            if not isinstance(item, dict):
                errors.append(f"{prefix} must be an object")
                continue
            commit = item.get("commit")
            commits = item.get("commits")
            if commit is None and commits is None:
                errors.append(f"{prefix} requires commit or commits")
            if commit is not None and commits is not None:
                errors.append(f"{prefix} must use commit or commits, not both")
            if commit is not None and (not isinstance(commit, str) or not COMMIT_RE.match(commit)):
                errors.append(f"{prefix}.commit is invalid")
            if commits is not None and (
                not isinstance(commits, list)
                or not commits
                or not all(isinstance(value, str) and COMMIT_RE.match(value) for value in commits)
            ):
                errors.append(f"{prefix}.commits must be a non-empty array of commit ids")
            reason = item.get("reason")
            if not isinstance(reason, str) or not reason.strip() or "\n" in reason:
                errors.append(f"{prefix}.reason must be a non-empty single line")

    links = plan.get("links", {})
    if not isinstance(links, dict):
        errors.append("links must be an object")
    else:
        for label, url in links.items():
            if not isinstance(label, str) or not label.strip() or "\n" in label:
                errors.append("link labels must be non-empty single-line strings")
            if not isinstance(url, str) or not re.match(r"^https?://\S+$", url):
                errors.append(f"link for {label!r} must be an absolute http(s) URL")

    if total_entries > 5000:
        warnings.append("plan contains more than 5000 entries; verify that changes were synthesized")

    return errors, warnings


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", help="Path to plan JSON")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    plan_path = Path(args.plan).expanduser().resolve()
    plan = load_plan(plan_path)
    errors, warnings = validate_plan(plan)
    if errors:
        emit(
            {
                "ok": False,
                "operation": "validate-plan",
                "error": "plan validation failed",
                "details": errors,
                "warnings": warnings,
            },
            stream=sys.stderr,
        )
        return EXIT_VALIDATION
    entry_count = sum(
        len(entries)
        for release in plan.get("releases", [])
        for entries in release.get("sections", {}).values()
        if isinstance(entries, list)
    )
    emit(
        {
            "ok": True,
            "operation": "validate-plan",
            "plan": str(plan_path),
            "action": plan.get("action"),
            "releases": len(plan.get("releases", [])),
            "entries": entry_count,
            "warnings": warnings,
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
