#!/usr/bin/env python3
"""Validate and deterministically rank improve-skill findings.

Exit codes:
  0: success
  2: input validation failed
  3: invocation or I/O failure
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

IMPACT = {"critical": 16.0, "high": 8.0, "medium": 4.0, "low": 2.0, "minor": 1.0}
CONFIDENCE = {"HIGH": 1.0, "MED": 0.7, "LOW": 0.4}
RISK = {"LOW": 1.0, "MED": 0.8, "HIGH": 0.5}
EFFORT = {"S": 1.0, "M": 2.0, "L": 4.0}
CATEGORIES = {"correctness", "security", "performance", "tests", "architecture", "dependencies", "dx", "docs", "direction"}
KINDS = {"corrective", "investigation", "direction"}
MAX_RAW = 16.0 * 1.0 * 1.0 * 1.25 / 1.0


def fail(message: str, code: int = 3) -> int:
    print(json.dumps({"status": "error", "message": message}), file=sys.stderr)
    return code


def load(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ValueError(f"file not found: {path}")
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}")


def validate_finding(item: Any, index: int, seen: set[str]) -> list[str]:
    errors: list[str] = []
    prefix = f"findings[{index}]"
    if not isinstance(item, dict):
        return [f"{prefix} must be an object"]
    required = ["id", "title", "category", "kind", "evidence", "impact", "impact_level", "effort", "fix_risk", "confidence", "prerequisite", "fix_sketch", "open_questions"]
    for field in required:
        if field not in item:
            errors.append(f"{prefix}.{field} is required")
    if errors:
        return errors
    fid = item["id"]
    if not isinstance(fid, str) or not fid.strip():
        errors.append(f"{prefix}.id must be non-empty")
    elif fid in seen:
        errors.append(f"duplicate finding id: {fid}")
    else:
        seen.add(fid)
    if item["category"] not in CATEGORIES:
        errors.append(f"{prefix}.category invalid: {item['category']!r}")
    if item["kind"] not in KINDS:
        errors.append(f"{prefix}.kind invalid: {item['kind']!r}")
    if item["impact_level"] not in IMPACT:
        errors.append(f"{prefix}.impact_level invalid: {item['impact_level']!r}")
    if item["effort"] not in EFFORT:
        errors.append(f"{prefix}.effort invalid: {item['effort']!r}")
    if item["fix_risk"] not in RISK:
        errors.append(f"{prefix}.fix_risk invalid: {item['fix_risk']!r}")
    if item["confidence"] not in CONFIDENCE:
        errors.append(f"{prefix}.confidence invalid: {item['confidence']!r}")
    if not isinstance(item["prerequisite"], bool):
        errors.append(f"{prefix}.prerequisite must be boolean")
    if item["confidence"] == "LOW" and item["kind"] == "corrective":
        errors.append(f"{prefix}: LOW-confidence item must be investigation or direction")
    evidence = item["evidence"]
    if not isinstance(evidence, list) or not 1 <= len(evidence) <= 5:
        errors.append(f"{prefix}.evidence must contain 1-5 entries")
    else:
        for eidx, ev in enumerate(evidence):
            ep = f"{prefix}.evidence[{eidx}]"
            if not isinstance(ev, dict):
                errors.append(f"{ep} must be an object")
                continue
            for field in ("path", "line_start", "line_end", "symbol", "observation"):
                if field not in ev:
                    errors.append(f"{ep}.{field} is required")
            path = ev.get("path")
            if isinstance(path, str) and (path.startswith("/") or "\\" in path or ".." in Path(path).parts):
                errors.append(f"{ep}.path must be a safe repository-relative Unix path")
            start, end = ev.get("line_start"), ev.get("line_end")
            if not isinstance(start, int) or not isinstance(end, int) or start < 1 or end < start:
                errors.append(f"{ep} has invalid line range")
    for field in ("title", "impact", "fix_sketch"):
        if not isinstance(item[field], str) or not item[field].strip():
            errors.append(f"{prefix}.{field} must be non-empty text")
    if not isinstance(item["open_questions"], list):
        errors.append(f"{prefix}.open_questions must be an array")
    return errors


def score(item: dict[str, Any]) -> float:
    raw = IMPACT[item["impact_level"]] * CONFIDENCE[item["confidence"]] * RISK[item["fix_risk"]]
    raw *= 1.25 if item["prerequisite"] else 1.0
    raw /= EFFORT[item["effort"]]
    return round(100.0 * raw / MAX_RAW, 1)


def markdown(items: list[dict[str, Any]], direction: list[dict[str, Any]]) -> str:
    lines = ["| ID | Finding | Category | Impact | Effort | Risk | Confidence | Leverage |", "|---|---|---|---|---|---|---|---:|"]
    for item in items:
        lines.append(f"| {item['id']} | {item['title']} | {item['category']} | {item['impact_level']} | {item['effort']} | {item['fix_risk']} | {item['confidence']} | {item['leverage']} |")
    if direction:
        lines.extend(["", "## Direction options", "", "| ID | Option | Impact | Effort | Confidence |", "|---|---|---|---|---|"])
        for item in direction:
            lines.append(f"| {item['id']} | {item['title']} | {item['impact_level']} | {item['effort']} | {item['confidence']} |")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--format", choices=("json", "markdown", "both"), default="json")
    args = parser.parse_args()
    try:
        data = load(args.input)
    except ValueError as exc:
        return fail(str(exc))
    findings = data.get("findings") if isinstance(data, dict) else data
    if not isinstance(findings, list):
        return fail("input must be a findings array or an object with a findings array", 2)
    errors: list[str] = []
    seen: set[str] = set()
    for idx, item in enumerate(findings):
        errors.extend(validate_finding(item, idx, seen))
    if errors:
        print(json.dumps({"status": "fail", "errors": errors}, indent=2), file=sys.stderr)
        return 2
    corrective, direction = [], []
    for item in findings:
        out = dict(item)
        if item["category"] == "direction" or item["kind"] == "direction":
            direction.append(out)
        else:
            out["leverage"] = score(item)
            corrective.append(out)
    corrective.sort(key=lambda x: (-x["leverage"], x["id"]))
    direction.sort(key=lambda x: (-(IMPACT[x["impact_level"]] * CONFIDENCE[x["confidence"]] / EFFORT[x["effort"]]), x["id"]))
    payload = {"status": "pass", "corrective": corrective, "direction": direction}
    if args.format in ("json", "both"):
        print(json.dumps(payload, indent=2))
    if args.format in ("markdown", "both"):
        if args.format == "both":
            print("---MARKDOWN---")
        print(markdown(corrective, direction))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
