"""Run a Python script with the active interpreter."""

from __future__ import annotations

import runpy
import sys


if len(sys.argv) < 2:
    raise SystemExit("usage: run_python.py SCRIPT [ARGS ...]")

sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name="__main__")
