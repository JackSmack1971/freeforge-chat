#!/usr/bin/env python3
"""Collect bounded PR or branch-diff context for the pr-review skill.

The script is intentionally read-only against source files. It writes review artifacts
only under codex-pr-reviews/ inside the current git repository.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
from typing import Any

MAX_DIFF_BYTES = 700_000  # Keeps review context bounded while preserving enough hunks for most PRs.


def run(cmd: list[str], cwd: pathlib.Path, allow_fail: bool = False) -> tuple[int, str, str]:
    proc = subprocess.run(cmd, cwd=str(cwd), text=True, capture_output=True, check=False)
    if proc.returncode != 0 and not allow_fail:
        raise RuntimeError(f"Command failed ({proc.returncode}): {' '.join(cmd)}\n{proc.stderr.strip()}")
    return proc.returncode, proc.stdout, proc.stderr


def repo_root() -> pathlib.Path:
    code, out, err = run(["git", "rev-parse", "--show-toplevel"], pathlib.Path.cwd(), allow_fail=True)
    if code != 0:
        raise RuntimeError("Not inside a git repository. Run from repository root or pass a diff file from inside a repo.")
    return pathlib.Path(out.strip()).resolve()


def safe_under(path: pathlib.Path, root: pathlib.Path) -> pathlib.Path:
    resolved = path.resolve()
    try:
        resolved.relative_to(root.resolve())
    except ValueError as exc:
        raise ValueError(f"Refusing path outside repository: {path}") from exc
    return resolved


def parse_pr_number(target: str) -> str | None:
    if re.fullmatch(r"\d+", target):
        return target
    match = re.search(r"/pull/(\d+)(?:\b|/|$)", target)
    return match.group(1) if match else None


def slug(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-._")
    return value[:80] or "review"


def write_text(path: pathlib.Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def truncate_diff(diff: str) -> tuple[str, bool, str]:
    encoded = diff.encode("utf-8", errors="replace")
    digest = hashlib.sha256(encoded).hexdigest()
    if len(encoded) <= MAX_DIFF_BYTES:
        return diff, False, digest
    truncated = encoded[:MAX_DIFF_BYTES].decode("utf-8", errors="replace")
    truncated += "\n\n[DIFF TRUNCATED BY collect_pr_context.py: review high-risk files with targeted reads before final decision.]\n"
    return truncated, True, digest


def collect_pr(root: pathlib.Path, pr: str, repo: str | None) -> dict[str, Any]:
    if shutil.which("gh") is None:
        raise RuntimeError("GitHub CLI `gh` is not installed or not on PATH. Use a local branch range or diff file for draft-only review.")

    base_cmd = ["gh", "pr", "view", pr, "--json", "number,title,author,body,baseRefName,headRefName,url,isDraft,mergeStateStatus,reviewDecision,changedFiles,additions,deletions,commits,files,labels"]
    if repo:
        base_cmd.extend(["--repo", repo])
    _, meta_out, _ = run(base_cmd, root)
    metadata = json.loads(meta_out)

    diff_cmd = ["gh", "pr", "diff", pr]
    if repo:
        diff_cmd.extend(["--repo", repo])
    _, diff_out, _ = run(diff_cmd, root)

    checks_cmd = ["gh", "pr", "checks", pr]
    if repo:
        checks_cmd.extend(["--repo", repo])
    checks_code, checks_out, checks_err = run(checks_cmd, root, allow_fail=True)

    metadata["target_type"] = "github_pr"
    metadata["checks_available"] = checks_code == 0
    metadata["checks_output"] = checks_out if checks_code == 0 else checks_err
    metadata["diff"] = diff_out
    return metadata


def collect_branch_range(root: pathlib.Path, base: str, head: str) -> dict[str, Any]:
    range_expr = f"{base}...{head}"
    _, name_status, _ = run(["git", "diff", "--name-status", range_expr], root)
    _, stat, _ = run(["git", "diff", "--stat", range_expr], root)
    _, diff_out, _ = run(["git", "diff", "--patch", range_expr], root)
    _, log_out, _ = run(["git", "log", "--oneline", "--decorate", f"{base}..{head}"], root, allow_fail=True)
    return {
        "target_type": "branch_range",
        "baseRefName": base,
        "headRefName": head,
        "title": f"Local diff {base}...{head}",
        "url": None,
        "changed_files_name_status": name_status,
        "stat": stat,
        "commits_text": log_out,
        "diff": diff_out,
    }


def collect_diff_file(root: pathlib.Path, target: str) -> dict[str, Any]:
    diff_path = safe_under(root / target, root)
    if not diff_path.is_file():
        raise FileNotFoundError(f"Diff file not found: {target}")
    diff_text = diff_path.read_text(encoding="utf-8", errors="replace")
    return {
        "target_type": "diff_file",
        "title": f"Diff file {target}",
        "url": None,
        "diff_file": str(diff_path.relative_to(root)),
        "diff": diff_text,
    }


def changed_files_from_diff(diff: str) -> list[str]:
    files: list[str] = []
    for line in diff.splitlines():
        if line.startswith("diff --git "):
            parts = line.split()
            if len(parts) >= 4:
                candidate = parts[3]
                if candidate.startswith("b/"):
                    candidate = candidate[2:]
                files.append(candidate)
    return sorted(dict.fromkeys(files))


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect PR review context.")
    parser.add_argument("target", nargs="?", help="PR number, PR URL, base...head range, or diff file path.")
    parser.add_argument("--base")
    parser.add_argument("--head")
    parser.add_argument("--repo")
    parser.add_argument("--out-dir")
    parser.add_argument("--submit-review", action="store_true", help="Accepted for argument passthrough; ignored by collector.")
    parser.add_argument("--decision", choices=["approve", "comment", "request-changes"], help="Accepted for passthrough; ignored by collector.")
    args, unknown = parser.parse_known_args()

    if unknown:
        print(json.dumps({"warning": f"Ignoring unrecognized collector args: {unknown}"}), file=sys.stderr)

    root = repo_root()
    target = args.target or ""
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S")
    target_slug = slug(target or f"{args.base or 'base'}-{args.head or 'head'}")
    default_out = root / "codex-pr-reviews" / f"pr-review-{timestamp}-{target_slug}"
    out_dir = pathlib.Path(args.out_dir) if args.out_dir else default_out
    if not out_dir.is_absolute():
        out_dir = root / out_dir
    out_dir = safe_under(out_dir, root)
    allowed_parent = root / "codex-pr-reviews"
    try:
        out_dir.relative_to(allowed_parent.resolve())
    except ValueError as exc:
        raise ValueError("Output directory must be under codex-pr-reviews/") from exc
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.base and args.head:
        metadata = collect_branch_range(root, args.base, args.head)
    elif target and "..." in target and not pathlib.Path(root / target).exists():
        base, head = target.split("...", 1)
        metadata = collect_branch_range(root, base, head)
    elif target and (pr := parse_pr_number(target)):
        metadata = collect_pr(root, pr, args.repo)
    elif target:
        metadata = collect_diff_file(root, target)
    else:
        raise ValueError("Provide a PR number, PR URL, base...head range, diff file path, or --base and --head.")

    diff_text = metadata.pop("diff")
    bounded_diff, truncated, diff_sha = truncate_diff(diff_text)
    changed_files = changed_files_from_diff(diff_text)

    code, status_out, _ = run(["git", "status", "--short"], root, allow_fail=True)
    metadata.update({
        "collected_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "repository_root": str(root),
        "output_dir": str(out_dir),
        "repo_arg": args.repo,
        "diff_sha256": diff_sha,
        "diff_truncated": truncated,
        "diff_max_bytes": MAX_DIFF_BYTES,
        "changed_files_from_diff": changed_files,
        "git_status_short": status_out if code == 0 else "unavailable",
    })

    write_text(out_dir / "diff.patch", bounded_diff)
    write_text(out_dir / "changed-files.txt", "\n".join(changed_files) + ("\n" if changed_files else ""))
    write_text(out_dir / "context.json", json.dumps(metadata, indent=2, sort_keys=True))

    summary_lines = [
        "# PR Review Context Summary",
        "",
        f"- Target type: {metadata.get('target_type')}",
        f"- Title: {metadata.get('title')}",
        f"- URL: {metadata.get('url') or 'local'}",
        f"- Base: {metadata.get('baseRefName', 'unknown')}",
        f"- Head: {metadata.get('headRefName', 'unknown')}",
        f"- Changed files: {len(changed_files) or metadata.get('changedFiles', 'unknown')}",
        f"- Diff SHA256: {diff_sha}",
        f"- Diff truncated: {str(truncated).lower()}",
        f"- Output directory: {out_dir}",
        "",
        "## Changed files",
        *(f"- {item}" for item in changed_files[:250]),
    ]
    if len(changed_files) > 250:
        summary_lines.append(f"- [changed-files list truncated in summary: {len(changed_files) - 250} additional files]")
    write_text(out_dir / "summary.md", "\n".join(summary_lines) + "\n")

    print(json.dumps({"ok": True, "output_dir": str(out_dir), "diff_truncated": truncated, "changed_files": len(changed_files)}, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}), file=sys.stderr)
        raise SystemExit(2)

