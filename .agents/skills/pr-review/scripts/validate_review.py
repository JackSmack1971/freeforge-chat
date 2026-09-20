#!/usr/bin/env python3
"""Validate pr-review Markdown output before user handoff or GitHub submission."""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

REQUIRED_SECTIONS = [
    "# PR Review Decision",
    "## Summary",
    "## Merge gate",
    "## Findings",
    "## Review comments",
    "## Verification performed",
    "## Residual risk",
]
VALID_DECISIONS = {"APPROVE", "COMMENT", "REQUEST_CHANGES"}
VALID_CONFIDENCE = {"high", "medium", "low"}
PLACEHOLDER_PATTERNS = [
    r"\bTODO\b",
    r"\bTBD\b",
    r"\bFIXME\b",
    r"<[^>]+>",
    r"\[insert[^\]]*\]",
    r"lorem ipsum",
]


def fail(errors: list[str], warnings: list[str]) -> int:
    print(json.dumps({"ok": False, "errors": errors, "warnings": warnings}, indent=2))
    return 1


def parse_count(label: str, text: str, errors: list[str]) -> int:
    match = re.search(rf"^{re.escape(label)}:\s*(\d+)\s*$", text, re.MULTILINE)
    if not match:
        errors.append(f"Missing `{label}: <number>` line.")
        return -1
    return int(match.group(1))


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a PR review draft.")
    parser.add_argument("review_file")
    args = parser.parse_args()

    path = pathlib.Path(args.review_file)
    errors: list[str] = []
    warnings: list[str] = []
    if not path.is_file():
        return fail([f"Review file not found: {path}"], warnings)

    text = path.read_text(encoding="utf-8", errors="replace")
    for section in REQUIRED_SECTIONS:
        if section not in text:
            errors.append(f"Missing required section: {section}")

    decisions = re.findall(r"^Decision:\s*([A-Z_]+)\s*$", text, re.MULTILINE)
    if len(decisions) != 1:
        errors.append("Review must contain exactly one `Decision:` line.")
        decision = None
    else:
        decision = decisions[0]
        if decision not in VALID_DECISIONS:
            errors.append(f"Invalid decision `{decision}`. Expected one of {sorted(VALID_DECISIONS)}.")

    confidence_match = re.search(r"^Confidence:\s*(\w+)\s*$", text, re.MULTILINE)
    if not confidence_match:
        errors.append("Missing `Confidence: high|medium|low` line.")
    elif confidence_match.group(1) not in VALID_CONFIDENCE:
        errors.append(f"Invalid confidence `{confidence_match.group(1)}`.")

    blocking_declared = parse_count("Blocking findings", text, errors)
    nonblocking_declared = parse_count("Non-blocking findings", text, errors)

    finding_ids = re.findall(r"^###\s+(PRR-\d{3}):", text, re.MULTILINE)
    if len(finding_ids) != len(set(finding_ids)):
        errors.append("Finding IDs must be unique.")

    blocking_actual = len(re.findall(r"^- Blocking:\s*yes\s*$", text, re.MULTILINE))
    nonblocking_actual = len(re.findall(r"^- Blocking:\s*no\s*$", text, re.MULTILINE))

    if blocking_declared >= 0 and blocking_declared != blocking_actual:
        errors.append(f"Blocking findings count mismatch: declared {blocking_declared}, found {blocking_actual}.")
    if nonblocking_declared >= 0 and nonblocking_declared != nonblocking_actual:
        errors.append(f"Non-blocking findings count mismatch: declared {nonblocking_declared}, found {nonblocking_actual}.")

    if decision == "APPROVE" and blocking_actual != 0:
        errors.append("APPROVE requires zero blocking findings.")
    if decision == "REQUEST_CHANGES" and blocking_actual == 0:
        errors.append("REQUEST_CHANGES requires at least one blocking finding.")

    if "No findings." in text and finding_ids:
        errors.append("`No findings.` cannot appear when finding blocks exist.")
    if "No findings." not in text and not finding_ids:
        warnings.append("No finding blocks found. This is valid only for clean APPROVE or COMMENT reviews.")

    for pattern in PLACEHOLDER_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE):
            errors.append(f"Placeholder or unfinished token detected by pattern: {pattern}")

    # Finding field validation for each block.
    blocks = re.split(r"^###\s+PRR-\d{3}:.*$", text, flags=re.MULTILINE)[1:]
    required_fields = ["- Severity:", "- Blocking:", "- Confidence:", "- Evidence:", "- Impact:", "- Required action:", "- Verification:"]
    for index, block in enumerate(blocks, start=1):
        for field in required_fields:
            if field not in block:
                errors.append(f"Finding PRR-{index:03d} missing field `{field}`.")

    if errors:
        return fail(errors, warnings)

    print(json.dumps({
        "ok": True,
        "review_file": str(path),
        "decision": decision,
        "blocking_findings": blocking_actual,
        "nonblocking_findings": nonblocking_actual,
        "warnings": warnings,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
