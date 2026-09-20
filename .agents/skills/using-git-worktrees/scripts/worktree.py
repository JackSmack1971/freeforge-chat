"""Cross-platform, bounded Git worktree helper."""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


def git(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, check=False)


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("detect")
    path = sub.add_parser("path"); path.add_argument("--location", required=True); path.add_argument("--branch", required=True)
    create = sub.add_parser("create"); create.add_argument("--path", required=True); create.add_argument("--branch", required=True); create.add_argument("--no-create-branch", action="store_true")
    for name in ("setup", "test"): p = sub.add_parser(name); p.add_argument("--path", required=True)
    ignore = sub.add_parser("verify-ignore"); ignore.add_argument("--dir", required=True)
    args = parser.parse_args()

    if args.command == "detect":
        dot, plain = Path(".worktrees").is_dir(), Path("worktrees").is_dir()
        print(json.dumps({"status": "FOUND_BOTH" if dot and plain else "FOUND_DOTWORKTREES" if dot else "FOUND_WORKTREES" if plain else "NOT_FOUND", "location": ".worktrees" if dot else "worktrees" if plain else None}))
        return 0
    if args.command == "path":
        root = git("rev-parse", "--show-toplevel")
        if root.returncode:
            print(json.dumps({"status": "ERROR", "message": "Not a Git repository"})); return 1
        project = Path(root.stdout.strip()).name
        raw_location = args.location
        location = Path(raw_location).expanduser()
        output = location / project / args.branch if raw_location.startswith("~") else location / args.branch
        print(json.dumps({"status": "PATH_READY", "worktree_path": str(output), "project": project})); return 0
    if args.command == "verify-ignore":
        result = git("check-ignore", "-q", args.dir)
        print(json.dumps({"status": "IGNORED" if result.returncode == 0 else "NOT_IGNORED", "dir": args.dir})); return 0
    if args.command == "create":
        if git("rev-parse", "--show-toplevel").returncode:
            print(json.dumps({"status": "ERROR", "message": "Not a Git repository"})); return 1
        exists = git("show-ref", "--verify", "--quiet", f"refs/heads/{args.branch}").returncode == 0
        if exists and not args.no_create_branch:
            print(json.dumps({"status": "BRANCH_EXISTS", "branch": args.branch})); return 0
        command = ["worktree", "add", args.path] + ([args.branch] if args.no_create_branch else ["-b", args.branch])
        result = git(*command)
        print(json.dumps({"status": "CREATED" if result.returncode == 0 else "ERROR", "path": args.path, "branch": args.branch, "message": result.stderr[-500:] if result.returncode else None})); return 0
    target = Path(args.path)
    if not target.is_dir():
        print(json.dumps({"status": "ERROR", "message": f"Path not found: {target}"})); return 1
    if args.command == "setup":
        print(json.dumps({"status": "SETUP_COMPLETE", "tool": "none", "note": "No automatic dependency installation; run the project-documented setup command."})); return 0
    print(json.dumps({"status": "NO_TEST_RUNNER", "count": 0, "failures": 0, "note": "Run the project's documented baseline test command."})); return 0


if __name__ == "__main__":
    raise SystemExit(main())
