#!/usr/bin/env python3
"""Smoke tests for validate_design_md.py using only the standard library."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "validate_design_md.py"
FIXTURES = ROOT / "tests" / "fixtures"


def run(name: str, profile: str) -> tuple[int, dict]:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), str(FIXTURES / name), "--profile", profile, "--format", "json"],
        check=False,
        capture_output=True,
        text=True,
    )
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(f"Validator did not return JSON. stdout={proc.stdout!r} stderr={proc.stderr!r}") from exc
    return proc.returncode, payload


def main() -> int:
    cases = [
        ("valid-strict.md", "strict", 0, "pass"),
        ("invalid-strict.md", "strict", 1, "fail"),
        ("valid-spec-minimal.md", "spec", 0, "pass"),
        ("valid-spec-minimal.md", "strict", 1, "fail"),
    ]
    failures: list[str] = []
    for name, profile, expected_code, expected_status in cases:
        code, payload = run(name, profile)
        if code != expected_code or payload.get("status") != expected_status:
            failures.append(
                f"{name}/{profile}: expected code={expected_code}, status={expected_status}; "
                f"got code={code}, status={payload.get('status')}"
            )
    if failures:
        print(json.dumps({"status": "fail", "failures": failures}, indent=2))
        return 1
    print(json.dumps({"status": "pass", "cases": len(cases)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
