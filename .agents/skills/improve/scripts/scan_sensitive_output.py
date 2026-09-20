#!/usr/bin/env python3
"""Flag high-confidence secret signatures in persisted advisor output.

This is a safety net, not a general secret scanner.
Exit codes: 0 pass, 2 signatures found, 3 invocation/I/O failure.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

PATTERNS = {
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----"),
    "github-token": re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b"),
    "aws-access-key": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
    "openai-style-key": re.compile(r"\bsk-[A-Za-z0-9_-]{24,}\b"),
    "google-api-key": re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"),
    "slack-token": re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"),
    "jwt": re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
}


def files(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    if path.is_dir():
        return sorted(p for p in path.rglob("*") if p.is_file() and p.suffix.lower() in {".md", ".json", ".txt"})
    raise FileNotFoundError(path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        targets = files(args.path)
    except FileNotFoundError:
        print(json.dumps({"status": "error", "message": f"path not found: {args.path}"}), file=sys.stderr)
        return 3
    findings = []
    for path in targets:
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            print(json.dumps({"status": "error", "message": f"cannot read {path}: {exc}"}), file=sys.stderr)
            return 3
        for line_no, line in enumerate(text.splitlines(), 1):
            for name, pattern in PATTERNS.items():
                if pattern.search(line):
                    findings.append({"path": str(path), "line": line_no, "signature": name})
    result = {"status": "fail" if findings else "pass", "findings": findings}
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        for item in findings:
            print(f"{item['path']}:{item['line']}: possible {item['signature']}")
        print(result["status"].upper())
    return 2 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
