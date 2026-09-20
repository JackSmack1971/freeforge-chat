#!/usr/bin/env python3
"""Verify structural Keep a Changelog conventions."""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

EXIT_VALIDATION = 4
EXIT_IO = 5
SECTIONS = ("Added", "Changed", "Deprecated", "Removed", "Fixed", "Security")
VERSION_RE = re.compile(r"^## \[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?[ \t]*$", re.MULTILINE)
PLACEHOLDER_RE = re.compile(r"\b(TODO|TBD|FIXME|CHANGEME|INSERT HERE)\b|\[(?:TODO|TBD)[^\]]*\]|<(?:TODO|TBD|FIXME|CHANGEME|INSERT[^>]*)>", re.I)


def emit(payload: Dict[str, Any], *, stream: Any = sys.stdout) -> None:
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True), file=stream)


def normalize_entry(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[`*_.,;:!?]", "", text).strip().lower())


def parse_blocks(text: str) -> List[Tuple[str, Optional[str], str]]:
    matches = list(VERSION_RE.finditer(text))
    blocks: List[Tuple[str, Optional[str], str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        blocks.append((match.group(1), match.group(2), text[match.end() : end]))
    return blocks


def validate(path: Path, text: str) -> Tuple[List[str], List[str], Dict[str, int]]:
    errors: List[str] = []
    warnings: List[str] = []
    metrics = {"releases": 0, "entries": 0, "sections": 0}

    if not text.endswith("\n"):
        errors.append("file must end with a newline")
    h1 = re.findall(r"^#\s+.+$", text, re.MULTILINE)
    if len(h1) != 1:
        errors.append(f"expected exactly one level-one title, found {len(h1)}")
    if PLACEHOLDER_RE.search(text):
        errors.append("file contains an unresolved placeholder")

    blocks = parse_blocks(text)
    metrics["releases"] = len(blocks)
    if not blocks:
        errors.append("no version headings found")
        return errors, warnings, metrics

    if blocks[0][0].lower() != "unreleased":
        errors.append("Unreleased must be the first version heading")

    seen_versions: set[str] = set()
    global_entries: Dict[str, List[str]] = {}
    released_dates: List[date] = []

    for version, date_value, body in blocks:
        key = version.lower()
        if key in seen_versions:
            errors.append(f"duplicate version heading: {version}")
        seen_versions.add(key)

        if key == "unreleased":
            if date_value is not None:
                errors.append("Unreleased must not have a date")
        else:
            if date_value is None:
                errors.append(f"released version {version} is missing a date")
            else:
                try:
                    released_dates.append(date.fromisoformat(date_value))
                except ValueError:
                    errors.append(f"released version {version} has invalid ISO date: {date_value}")

        headings = list(re.finditer(r"^###\s+(.+?)\s*$", body, re.MULTILINE))
        names = [match.group(1) for match in headings]
        metrics["sections"] += len(names)
        unknown = [name for name in names if name not in SECTIONS]
        if unknown:
            errors.append(f"version {version} has unsupported sections: {', '.join(unknown)}")
        known_positions = [SECTIONS.index(name) for name in names if name in SECTIONS]
        if known_positions != sorted(known_positions):
            errors.append(f"version {version} sections are not in Keep a Changelog order")
        if len(names) != len(set(names)):
            errors.append(f"version {version} contains duplicate section headings")

        release_entries: set[str] = set()
        for line_number, line in enumerate(body.splitlines(), start=1):
            bullet = re.match(r"^\s*[-*+]\s+(.+?)\s*$", line)
            if not bullet:
                continue
            text_value = bullet.group(1)
            metrics["entries"] += 1
            normalized = normalize_entry(text_value)
            if normalized in release_entries:
                errors.append(f"version {version} contains duplicate entry: {text_value}")
            release_entries.add(normalized)
            global_entries.setdefault(normalized, []).append(version)
            if PLACEHOLDER_RE.search(text_value):
                errors.append(f"version {version} entry contains placeholder: {text_value}")

        for match_index, match in enumerate(headings):
            section_end = headings[match_index + 1].start() if match_index + 1 < len(headings) else len(body)
            section_body = body[match.end() : section_end]
            if not re.search(r"^\s*[-*+]\s+\S", section_body, re.MULTILINE):
                warnings.append(f"version {version} section {match.group(1)} is empty")

    if released_dates != sorted(released_dates, reverse=True):
        warnings.append("release dates are not in newest-first order")

    for normalized, versions in global_entries.items():
        unique_versions = sorted(set(versions))
        if len(unique_versions) > 1:
            warnings.append(
                f"similar entry appears across multiple releases ({', '.join(unique_versions)}): {normalized}"
            )

    return errors, warnings, metrics


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("changelog")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    path = Path(args.changelog).expanduser().resolve()
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        emit(
            {
                "ok": False,
                "operation": "verify-changelog",
                "error": f"unable to read {path}",
                "details": [str(exc)],
            },
            stream=sys.stderr,
        )
        return EXIT_IO

    errors, warnings, metrics = validate(path, text)
    if errors:
        emit(
            {
                "ok": False,
                "operation": "verify-changelog",
                "error": "changelog verification failed",
                "details": errors,
                "warnings": warnings,
                **metrics,
            },
            stream=sys.stderr,
        )
        return EXIT_VALIDATION

    emit(
        {
            "ok": True,
            "operation": "verify-changelog",
            "path": str(path),
            "warnings": warnings,
            **metrics,
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
