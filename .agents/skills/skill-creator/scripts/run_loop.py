#!/usr/bin/env python3
"""Run a small Codex evaluation/improvement loop without browser or daemon state."""

import argparse
import json
import subprocess
import sys
from pathlib import Path

try:
    from scripts.improve_description import improve_description
    from scripts.run_eval import run_eval
    from scripts.utils import parse_skill_md
except ModuleNotFoundError:
    from improve_description import improve_description
    from run_eval import run_eval
    from utils import parse_skill_md


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-set", required=True)
    parser.add_argument("--skill-path", required=True)
    parser.add_argument("--max-iterations", type=int, default=3)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--results-dir")
    args = parser.parse_args()
    skill_path = Path(args.skill_path).resolve()
    name, description, content = parse_skill_md(skill_path)
    project_root = next((parent for parent in [skill_path, *skill_path.parents]
                         if (parent / ".agents").is_dir()), skill_path.parent)
    eval_set = json.loads(Path(args.eval_set).read_text(encoding="utf-8"))
    history = []
    current = description
    for iteration in range(1, args.max_iterations + 1):
        result = run_eval(eval_set, name, project_root, args.timeout, 1, 0.5)
        result["description"] = current
        result["iteration"] = iteration
        history.append(result)
        if result["summary"]["failed"] == 0:
            break
        current = improve_description(name, content, current, result, project_root,
                                      args.timeout)
    output = {"skill_name": name, "original_description": description,
              "best_description": current, "history": history,
              "mode": "explicit_codex_invocation"}
    text = json.dumps(output, indent=2)
    print(text)
    if args.results_dir:
        destination = Path(args.results_dir)
        destination.mkdir(parents=True, exist_ok=True)
        (destination / "results.json").write_text(text + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
