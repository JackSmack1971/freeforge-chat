#!/usr/bin/env python3
"""Package a validated skill as a zip-compatible .skill file."""

import fnmatch
import sys
import zipfile
from pathlib import Path

try:
    from scripts.quick_validate import validate_skill
except ModuleNotFoundError:
    from quick_validate import validate_skill

EXCLUDED_DIRS = {"__pycache__", "node_modules"}


def package_skill(skill_path: str | Path, output_dir: str | Path | None = None) -> Path:
    root = Path(skill_path).resolve()
    ok, message = validate_skill(root)
    if not ok:
        raise ValueError(message)
    destination = Path(output_dir or Path.cwd()).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    archive = destination / f"{root.name}.skill"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        for path in root.rglob("*"):
            relative = path.relative_to(root)
            if not path.is_file() or any(part in EXCLUDED_DIRS for part in relative.parts):
                continue
            if fnmatch.fnmatch(path.name, "*.pyc") or path.name == ".DS_Store":
                continue
            bundle.write(path, Path(root.name) / relative)
    return archive


if __name__ == "__main__":
    if len(sys.argv) not in {2, 3}:
        raise SystemExit("Usage: python package_skill.py <skill-directory> [output-directory]")
    print(package_skill(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else None))
