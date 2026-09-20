#!/usr/bin/env python3
"""Run Codex-backed skill evaluations.

Codex JSONL currently exposes generic agent/command events, not a stable
implicit-skill-selection event. Evaluations therefore use explicit skill
invocation and require the candidate to print SKILL_USED when it actually
followed the skill. This measures the usable runner path, not implicit ranking.
"""

import argparse
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

try:
    from scripts.utils import parse_skill_md
except ModuleNotFoundError:
    from utils import parse_skill_md


def run_single_query(query: str, skill_name: str, project_root: Path, timeout: int) -> bool:
    codex = shutil.which("codex") or "codex"
    expected = "SKILL_USED"
    prompt = (
        f"Use the repository skill at .agents/skills/{skill_name}/SKILL.md for this evaluation. Do not use a user or system skill with the same name. Do not edit files.\n"
        f"Task: {query}\n"
        f"If you followed that skill, end your final answer with {expected}."
    )
    with tempfile.TemporaryDirectory(prefix="codex-skill-eval-") as temp:
        output = Path(temp) / "last-message.txt"
        command = [codex, "exec", "--ephemeral", "--skip-git-repo-check",
                   "-s", "read-only", "-C", str(project_root), "-o", str(output), prompt]
        process = subprocess.Popen(command, cwd=project_root, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True)
        try:
            process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                               capture_output=True, text=True)
            else:
                process.kill()
            process.wait()
            return False
        if process.returncode != 0 or not output.is_file():
            return False
        return expected in output.read_text(encoding="utf-8", errors="replace")


def run_eval(eval_set: list[dict], skill_name: str, project_root: Path,
             timeout: int, runs_per_query: int, threshold: float) -> dict:
    results = []
    for item in eval_set:
        outcomes = [run_single_query(item["query"], skill_name, project_root, timeout)
                    for _ in range(runs_per_query)]
        rate = sum(outcomes) / len(outcomes)
        should_trigger = bool(item.get("should_trigger", True))
        passed = rate >= threshold if should_trigger else rate < threshold
        results.append({"query": item["query"], "should_trigger": should_trigger,
                        "trigger_rate": rate, "triggers": sum(outcomes),
                        "runs": len(outcomes), "pass": passed})
    passed = sum(result["pass"] for result in results)
    return {"skill_name": skill_name, "mode": "explicit_codex_invocation",
            "results": results,
            "summary": {"total": len(results), "passed": passed,
                        "failed": len(results) - passed}}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-set", required=True)
    parser.add_argument("--skill-path", required=True)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--runs-per-query", type=int, default=1)
    parser.add_argument("--trigger-threshold", type=float, default=0.5)
    args = parser.parse_args()
    skill_path = Path(args.skill_path).resolve()
    if not (skill_path / "SKILL.md").is_file():
        raise SystemExit(f"No SKILL.md found at {skill_path}")
    name, _, _ = parse_skill_md(skill_path)
    data = json.loads(Path(args.eval_set).read_text(encoding="utf-8"))
    project_root = next((parent for parent in [skill_path, *skill_path.parents]
                         if (parent / ".agents").is_dir()), skill_path.parent)
    print(json.dumps(run_eval(data, name, project_root, args.timeout,
                              args.runs_per_query, args.trigger_threshold), indent=2))


if __name__ == "__main__":
    main()
