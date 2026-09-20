#!/usr/bin/env python3
"""Post a validated PR review using GitHub CLI.

This script is the only intended GitHub write path for the pr-review skill.
It refuses to submit unless --confirm-submit is present and validation passes.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import shutil
import subprocess
import sys

VALID_DECISIONS = {"approve", "comment", "request-changes"}


def run(cmd: list[str], cwd: pathlib.Path | None = None, allow_fail: bool = False) -> tuple[int, str, str]:
    proc = subprocess.run(cmd, cwd=str(cwd) if cwd else None, text=True, capture_output=True, check=False)
    if proc.returncode != 0 and not allow_fail:
        raise RuntimeError(f"Command failed ({proc.returncode}): {' '.join(cmd)}\n{proc.stderr.strip()}")
    return proc.returncode, proc.stdout, proc.stderr


def parse_pr_number(target: str) -> str | None:
    if re.fullmatch(r"\d+", target):
        return target
    match = re.search(r"/pull/(\d+)(?:\b|/|$)", target)
    return match.group(1) if match else None


def parse_decision(review_text: str) -> str:
    match = re.search(r"^Decision:\s*(APPROVE|COMMENT|REQUEST_CHANGES)\s*$", review_text, re.MULTILINE)
    if not match:
        raise ValueError("Review file does not contain a valid Decision line.")
    return match.group(1).lower().replace("_", "-")


def main() -> int:
    parser = argparse.ArgumentParser(description="Post a validated GitHub PR review.")
    parser.add_argument("target", help="PR number or PR URL.")
    parser.add_argument("--review-file", required=True)
    parser.add_argument("--repo")
    parser.add_argument("--decision", choices=sorted(VALID_DECISIONS))
    parser.add_argument("--confirm-submit", action="store_true")
    parser.add_argument("--base", help="Accepted for argument passthrough; ignored.")
    parser.add_argument("--head", help="Accepted for argument passthrough; ignored.")
    parser.add_argument("--submit-review", action="store_true", help="Accepted for argument passthrough; ignored.")
    args, unknown = parser.parse_known_args()

    if unknown:
        print(json.dumps({"warning": f"Ignoring unrecognized post args: {unknown}"}), file=sys.stderr)

    if not args.confirm_submit:
        raise PermissionError("Refusing to post review without --confirm-submit.")
    if shutil.which("gh") is None:
        raise RuntimeError("GitHub CLI `gh` is not installed or not on PATH.")

    review_path = pathlib.Path(args.review_file).resolve()
    if not review_path.is_file():
        raise FileNotFoundError(f"Review file not found: {review_path}")

    # Validate before posting.
    validator = pathlib.Path(__file__).with_name("validate_review.py")
    code, out, err = run([sys.executable, str(validator), str(review_path)], allow_fail=True)
    if code != 0:
        raise RuntimeError(f"Review validation failed; not posting.\n{out}\n{err}")

    pr = parse_pr_number(args.target)
    if pr is None:
        raise ValueError("Posting requires a PR number or GitHub PR URL target.")

    review_text = review_path.read_text(encoding="utf-8", errors="replace")
    decision = args.decision or parse_decision(review_text)
    if decision not in VALID_DECISIONS:
        raise ValueError(f"Invalid decision: {decision}")

    flag = {"approve": "--approve", "comment": "--comment", "request-changes": "--request-changes"}[decision]
    cmd = ["gh", "pr", "review", pr, flag, "--body-file", str(review_path)]
    if args.repo:
        cmd.extend(["--repo", args.repo])
    _, stdout, stderr = run(cmd)
    print(json.dumps({"ok": True, "decision": decision, "stdout": stdout.strip(), "stderr": stderr.strip()}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        raise SystemExit(2)
