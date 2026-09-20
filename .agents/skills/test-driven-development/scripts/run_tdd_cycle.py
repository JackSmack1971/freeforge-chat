"""Run one bounded TDD verification stage with an existing local runner."""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


def run(command: list[str], test_path: str | None = None) -> tuple[int, str]:
    args = command + ([test_path] if test_path else [])
    try:
        proc = subprocess.run(args, capture_output=True, text=True, check=False)
    except OSError as exc:
        return -1, str(exc)
    return proc.returncode, (proc.stdout + proc.stderr)[-6000:]


def runner() -> list[str] | None:
    root = Path.cwd()
    if (root / "pyproject.toml").exists() or (root / "pytest.ini").exists() or (root / "tox.ini").exists():
        return ["pytest", "-q"]
    package = root / "package.json"
    if package.exists():
        data = package.read_text(encoding="utf-8", errors="replace").lower()
        if "vitest" in data:
            return ["npx", "vitest", "run"]
        if "jest" in data:
            return ["npx", "jest"]
        if '"test"' in data:
            return ["npm", "test", "--"]
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--test-path", required=True)
    parser.add_argument("--stage", choices=("red", "green", "refactor"), required=True)
    args = parser.parse_args()
    if not Path(args.test_path).is_file():
        print(json.dumps({"stage_result": "ERROR", "reason": f"Test file not found: {args.test_path}"}))
        return 1
    command = runner()
    if command is None:
        print(json.dumps({"stage_result": "ERROR", "reason": "No supported test runner found"}))
        return 1
    target_code, target_output = run(command, args.test_path)
    full_code, full_output = (target_code, target_output) if args.stage == "red" else run(command)
    if args.stage == "red":
        result = "PASS_UNEXPECTED" if target_code == 0 else "ERROR" if target_code < 0 else "FAIL_CORRECT"
        detail = "Target test passed immediately" if result == "PASS_UNEXPECTED" else "Target test failed as expected" if result == "FAIL_CORRECT" else "Test runner could not be interpreted"
    elif target_code != 0:
        result, detail = "TARGET_FAIL", "Target test is still failing"
    elif full_code != 0:
        result, detail = "REGRESSION", "The full suite failed"
    else:
        result, detail = "ALL_PASS", "Target and full suite pass"
    print(json.dumps({"stage_result": result, "stage": args.stage, "detail": detail, "output_snippet": (target_output if args.stage == "red" else full_output)[-1200:]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
