#!/usr/bin/env python3
"""Ask Codex for a revised skill description from evaluation evidence."""

import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

try:
    from scripts.utils import parse_skill_md
except ModuleNotFoundError:
    from utils import parse_skill_md


def improve_description(skill_name: str, skill_content: str, current: str,
                        eval_results: dict, project_root: Path, timeout: int = 180) -> str:
    prompt = f"""Improve this Codex skill description.
Return only the replacement text between <new_description> and </new_description>.
Keep it under 1024 characters, keyword-forward, and specific to user intent.

Skill: {skill_name}
Current description: {current}
Evaluation evidence:
{json.dumps(eval_results, indent=2)}
Skill body:
{skill_content}
"""
    codex = shutil.which("codex") or "codex"
    with tempfile.TemporaryDirectory(prefix="codex-description-") as temp:
        output = Path(temp) / "last-message.txt"
        result = subprocess.run(
            [codex, "exec", "--ephemeral", "--skip-git-repo-check", "-s", "read-only",
             "-C", str(project_root), "-o", str(output), prompt],
            cwd=project_root, capture_output=True, text=True, timeout=timeout,
        )
        if result.returncode or not output.is_file():
            raise RuntimeError(result.stderr.strip() or "Codex description run failed")
        text = output.read_text(encoding="utf-8", errors="replace")
    if "<new_description>" in text:
        text = text.split("<new_description>", 1)[1].split("</new_description>", 1)[0]
    description = " ".join(text.strip().strip('"').split())
    if not description or len(description) > 1024:
        raise ValueError("Codex returned an empty or overlong description")
    return description


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-results", required=True)
    parser.add_argument("--skill-path", required=True)
    args = parser.parse_args()
    skill_path = Path(args.skill_path).resolve()
    name, description, content = parse_skill_md(skill_path)
    result = improve_description(name, content,
                                 json.loads(Path(args.eval_results).read_text())["description"],
                                 json.loads(Path(args.eval_results).read_text()),
                                 next((parent for parent in [skill_path, *skill_path.parents]
                                       if (parent / ".agents").is_dir()), skill_path.parent))
    print(json.dumps({"description": result}, indent=2))


if __name__ == "__main__":
    main()
