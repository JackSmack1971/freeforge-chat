#!/usr/bin/env python3
"""Find the first test that creates an unwanted file or directory."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pollution_check")
    parser.add_argument("test_pattern")
    args = parser.parse_args()

    pollution = Path(args.pollution_check)
    tests = sorted(Path.cwd().glob(args.test_pattern))
    print(f"Searching for test that creates: {pollution}")
    print(f"Test pattern: {args.test_pattern}\n")
    print(f"Found {len(tests)} test files\n")

    for index, test_file in enumerate(tests, 1):
        if pollution.exists():
            print(f"Pollution already exists before test {index}/{len(tests)}")
            print(f"Skipping: {test_file}")
            continue

        print(f"[{index}/{len(tests)}] Testing: {test_file}")
        subprocess.run(["npm", "test", str(test_file)], stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, check=False)

        if pollution.exists():
            print("\nFOUND POLLUTER!")
            print(f"Test: {test_file}")
            print(f"Created: {pollution}")
            print(f"\nRun again with: npm test {test_file}")
            return 1

    print("\nNo polluter found - all tests clean!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

