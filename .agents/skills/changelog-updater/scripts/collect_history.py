#!/usr/bin/env python3
"""Collect bounded Git history for semantic changelog analysis."""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

EXIT_USAGE = 2
EXIT_GIT = 3
EXIT_IO = 5
EXIT_LIMIT = 7


def emit(payload: Dict[str, Any], *, stream: Any = sys.stdout) -> None:
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True), file=stream)


def fail(message: str, code: int, details: Optional[List[str]] = None) -> "NoReturn":
    emit(
        {
            "ok": False,
            "operation": "collect-history",
            "error": message,
            "details": details or [],
        },
        stream=sys.stderr,
    )
    raise SystemExit(code)


def run_git(repo: Path, args: Sequence[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    process = subprocess.run(
        ["git", "-C", str(repo), *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        encoding="utf-8",
        errors="replace",
    )
    if check and process.returncode != 0:
        fail(
            f"git {' '.join(args)} failed",
            EXIT_GIT,
            [process.stderr.strip() or f"exit code {process.returncode}"],
        )
    return process


def resolve_repo(repo_arg: str) -> Path:
    candidate = Path(repo_arg).expanduser().resolve()
    if not candidate.exists():
        fail(f"repository path does not exist: {candidate}", EXIT_GIT)
    result = run_git(candidate, ["rev-parse", "--show-toplevel"])
    return Path(result.stdout.strip()).resolve()


def resolve_commit(repo: Path, ref: str) -> str:
    result = run_git(repo, ["rev-parse", "--verify", f"{ref}^{{commit}}"])
    return result.stdout.strip()


def is_ancestor(repo: Path, older: str, newer: str) -> bool:
    result = run_git(repo, ["merge-base", "--is-ancestor", older, newer], check=False)
    return result.returncode == 0


def tags_merged_into_head(repo: Path) -> List[Dict[str, str]]:
    result = run_git(repo, ["tag", "--merged", "HEAD", "--sort=creatordate"])
    tags: List[Dict[str, str]] = []
    for name in [line.strip() for line in result.stdout.splitlines() if line.strip()]:
        commit = resolve_commit(repo, name)
        date_result = run_git(
            repo,
            ["for-each-ref", f"refs/tags/{name}", "--format=%(creatordate:iso-strict)"],
        )
        creator_date = date_result.stdout.strip()
        tags.append({"name": name, "commit": commit, "creator_date": creator_date})
    return tags


def latest_reachable_tag(repo: Path) -> Optional[str]:
    result = run_git(repo, ["describe", "--tags", "--abbrev=0", "HEAD"], check=False)
    if result.returncode != 0:
        return None
    value = result.stdout.strip()
    return value or None


def collect_log(
    repo: Path,
    revision_args: Sequence[str],
    *,
    include_merges: bool,
    first_parent: bool,
    include_files: bool,
) -> List[Dict[str, Any]]:
    # Record separator and unit separator avoid ambiguity with normal commit text.
    pretty = "%x1e%H%x1f%h%x1f%P%x1f%aI%x1f%an%x1f%ae%x1f%s%x1f%B"
    args: List[str] = ["log", "--reverse", f"--format={pretty}", "--numstat"]
    if not include_merges:
        args.append("--no-merges")
    if first_parent:
        args.append("--first-parent")
    args.extend(revision_args)
    result = run_git(repo, args)

    commits: List[Dict[str, Any]] = []
    for raw_record in result.stdout.split("\x1e"):
        if not raw_record.strip():
            continue
        header_and_stats = raw_record.lstrip("\n").splitlines()
        if not header_and_stats:
            continue

        # The body may span lines. Parse the first seven separators from the entire record,
        # then identify numstat lines from the tail.
        parts = raw_record.lstrip("\n").split("\x1f", 7)
        if len(parts) != 8:
            fail("unable to parse git log record", EXIT_GIT, [raw_record[:200]])
        full_hash, short_hash, parents_raw, author_date, author_name, author_email, subject, remainder = parts

        remainder_lines = remainder.splitlines()
        body_lines: List[str] = []
        stats_lines: List[str] = []
        in_stats = False
        numstat_re = re.compile(r"^(?:\d+|-)\t(?:\d+|-)\t.+$")
        for line in remainder_lines:
            if numstat_re.match(line):
                in_stats = True
                stats_lines.append(line)
            elif in_stats and not line.strip():
                continue
            elif in_stats:
                # A non-numstat line after stats is unexpected; retain it as body evidence.
                body_lines.append(line)
            else:
                body_lines.append(line)

        # %B starts with the subject. Avoid duplicating it in body.
        body = "\n".join(body_lines).strip()
        if body == subject.strip():
            body = ""
        elif body.startswith(subject.strip() + "\n"):
            body = body[len(subject.strip()) :].lstrip("\n")

        files: List[Dict[str, Any]] = []
        insertions = 0
        deletions = 0
        binary_files = 0
        for line in stats_lines:
            added_raw, deleted_raw, path = line.split("\t", 2)
            binary = added_raw == "-" or deleted_raw == "-"
            added = None if binary else int(added_raw)
            deleted = None if binary else int(deleted_raw)
            if binary:
                binary_files += 1
            else:
                insertions += added or 0
                deletions += deleted or 0
            if include_files:
                files.append(
                    {
                        "path": path,
                        "insertions": added,
                        "deletions": deleted,
                        "binary": binary,
                    }
                )

        tags_result = run_git(repo, ["tag", "--points-at", full_hash])
        tags = [line.strip() for line in tags_result.stdout.splitlines() if line.strip()]
        parents = [item for item in parents_raw.split() if item]
        commit: Dict[str, Any] = {
            "hash": full_hash,
            "short_hash": short_hash,
            "parents": parents,
            "author_date": author_date,
            "subject": subject.strip(),
            "body": body,
            "tags": tags,
            "stats": {
                "files_changed": len(stats_lines),
                "insertions": insertions,
                "deletions": deletions,
                "binary_files": binary_files,
            },
            "hints": mechanical_hints(subject, body, files, len(parents)),
        }
        if include_files:
            commit["files"] = files
        commits.append(commit)
    return commits


def mechanical_hints(
    subject: str,
    body: str,
    files: Sequence[Dict[str, Any]],
    parent_count: int,
) -> List[str]:
    text = f"{subject}\n{body}".lower()
    paths = [str(item.get("path", "")).lower() for item in files]
    hints: List[str] = []
    if parent_count > 1:
        hints.append("merge_commit")
    if re.search(r"\b(bump|release|version)\b", text):
        hints.append("possible_version_only")
    if re.search(r"\b(dependabot|renovate|dependency|dependencies|lockfile)\b", text):
        hints.append("possible_dependency_update")
    if re.search(r"\b(security|vulnerability|cve-|auth|permission|xss|csrf|injection)\b", text):
        hints.append("security_review")
    if re.search(r"\b(breaking|remove[sd]?|rename[sd]?|deprecat|migration|schema)\b", text):
        hints.append("breaking_review")
    if paths:
        if all(is_test_path(path) for path in paths):
            hints.append("test_only_paths")
        if all(is_docs_path(path) for path in paths):
            hints.append("docs_only_paths")
        if all(is_ci_path(path) for path in paths):
            hints.append("ci_only_paths")
        if all(is_generated_or_lock_path(path) for path in paths):
            hints.append("generated_or_lock_only_paths")
        if any(is_public_surface_path(path) for path in paths):
            hints.append("public_surface_review")
    return sorted(set(hints))


def is_test_path(path: str) -> bool:
    return bool(
        re.search(
            r"(^|/)(tests?|specs?|__tests__|fixtures?|mocks?)(/|$)|(^|/).*\.(test|spec)\.[^/]+$",
            path,
        )
    )


def is_docs_path(path: str) -> bool:
    name = Path(path).name.lower()
    return path.startswith("docs/") or name.startswith("readme") or name in {
        "contributing.md",
        "security.md",
        "migration.md",
    }


def is_ci_path(path: str) -> bool:
    return path.startswith(".github/") or path.startswith(".gitlab/") or path in {
        "jenkinsfile",
        ".circleci/config.yml",
        "azure-pipelines.yml",
    }


def is_generated_or_lock_path(path: str) -> bool:
    name = Path(path).name.lower()
    return name.endswith(".lock") or name in {
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "poetry.lock",
        "cargo.lock",
        "go.sum",
    } or "/generated/" in f"/{path}/"


def is_public_surface_path(path: str) -> bool:
    markers = (
        "api/",
        "cli/",
        "commands/",
        "migrations/",
        "schema/",
        "schemas/",
        "config/",
        "routes/",
        "public/",
        "ui/",
        "src/bin/",
    )
    lower = path.lower()
    return lower.startswith(markers) or any(f"/{marker}" in lower for marker in markers)


def build_segments(
    repo: Path,
    args: argparse.Namespace,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    warnings: List[str] = []
    segments: List[Dict[str, Any]] = []

    if args.mode == "full":
        tags = tags_merged_into_head(repo)
        if not tags:
            segments.append({"label": "Unreleased", "range": "HEAD", "revision_args": ["HEAD"]})
            warnings.append("No reachable tags found; full history is one Unreleased segment.")
            return segments, warnings

        previous: Optional[Dict[str, str]] = None
        for tag in tags:
            if previous is None:
                revision = tag["name"]
                display_range = tag["name"]
            else:
                revision = f"{previous['name']}..{tag['name']}"
                display_range = revision
                if not is_ancestor(repo, previous["commit"], tag["commit"]):
                    warnings.append(
                        f"Tag {previous['name']} is not an ancestor of {tag['name']}; release segments may overlap."
                    )
            segments.append(
                {
                    "label": tag["name"],
                    "range": display_range,
                    "revision_args": [revision],
                    "tag_creator_date": tag["creator_date"],
                    "tag_commit": tag["commit"],
                }
            )
            previous = tag

        head = resolve_commit(repo, "HEAD")
        if previous and previous["commit"] != head:
            segments.append(
                {
                    "label": "Unreleased",
                    "range": f"{previous['name']}..HEAD",
                    "revision_args": [f"{previous['name']}..HEAD"],
                }
            )
        return segments, warnings

    if args.mode == "since-tag":
        tag = latest_reachable_tag(repo)
        if tag:
            segments.append(
                {"label": "Unreleased", "range": f"{tag}..HEAD", "revision_args": [f"{tag}..HEAD"]}
            )
        else:
            segments.append({"label": "Unreleased", "range": "HEAD", "revision_args": ["HEAD"]})
            warnings.append("No reachable tag found; collected full history instead.")
        return segments, warnings

    if args.mode == "range":
        if not args.from_ref:
            fail("--from-ref is required for range mode", EXIT_USAGE)
        to_ref = args.to_ref or "HEAD"
        resolve_commit(repo, args.from_ref)
        resolve_commit(repo, to_ref)
        revision = f"{args.from_ref}..{to_ref}"
        segments.append({"label": "Selected range", "range": revision, "revision_args": [revision]})
        return segments, warnings

    if args.mode == "dates":
        if not args.since and not args.until:
            fail("dates mode requires --since and/or --until", EXIT_USAGE)
        revision_args: List[str] = [args.to_ref or "HEAD"]
        if args.since:
            revision_args.append(f"--since={args.since}")
        if args.until:
            revision_args.append(f"--until={args.until}")
        label_parts = []
        if args.since:
            label_parts.append(f"since {args.since}")
        if args.until:
            label_parts.append(f"until {args.until}")
        segments.append(
            {
                "label": "Selected dates",
                "range": ", ".join(label_parts),
                "revision_args": revision_args,
            }
        )
        return segments, warnings

    fail(f"unsupported mode: {args.mode}", EXIT_USAGE)


def redact_revision_args(segment: Dict[str, Any]) -> Dict[str, Any]:
    result = dict(segment)
    result.pop("revision_args", None)
    return result


def write_json_atomic(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    try:
        temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(temp, path)
    except OSError as exc:
        try:
            temp.unlink(missing_ok=True)
        except OSError:
            pass
        fail(f"unable to write output: {path}", EXIT_IO, [str(exc)])


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".", help="Git repository path")
    parser.add_argument("--mode", choices=("full", "since-tag", "range", "dates"), required=True)
    parser.add_argument("--from-ref")
    parser.add_argument("--to-ref")
    parser.add_argument("--since")
    parser.add_argument("--until")
    parser.add_argument("--include-merges", action="store_true")
    parser.add_argument("--first-parent", action="store_true")
    parser.add_argument("--no-files", action="store_true")
    parser.add_argument("--max-commits", type=int, default=10000)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    if args.max_commits < 1:
        parser.error("--max-commits must be positive")
    return args


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    repo = resolve_repo(args.repo)
    head = resolve_commit(repo, "HEAD")
    branch_result = run_git(repo, ["branch", "--show-current"])
    remote_result = run_git(repo, ["remote", "get-url", "origin"], check=False)
    segments, warnings = build_segments(repo, args)

    collected_segments: List[Dict[str, Any]] = []
    total_commits = 0
    seen_hashes: Dict[str, List[str]] = defaultdict(list)
    for segment in segments:
        commits = collect_log(
            repo,
            segment["revision_args"],
            include_merges=args.include_merges,
            first_parent=args.first_parent,
            include_files=not args.no_files,
        )
        total_commits += len(commits)
        if total_commits > args.max_commits:
            fail(
                f"collected commit count exceeds --max-commits ({args.max_commits})",
                EXIT_LIMIT,
                ["Use a narrower range or raise the explicit limit."],
            )
        clean_segment = redact_revision_args(segment)
        clean_segment["commit_count"] = len(commits)
        clean_segment["commits"] = commits
        collected_segments.append(clean_segment)
        for commit in commits:
            seen_hashes[commit["hash"]].append(str(segment["label"]))

    overlaps = {commit: labels for commit, labels in seen_hashes.items() if len(labels) > 1}
    if overlaps:
        warnings.append(
            f"{len(overlaps)} commits appear in multiple release segments; inspect tag ancestry before reconstruction."
        )

    status_result = run_git(repo, ["status", "--short"])
    payload: Dict[str, Any] = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repository": {
            "root": str(repo),
            "head": head,
            "branch": branch_result.stdout.strip() or None,
            "origin": remote_result.stdout.strip() if remote_result.returncode == 0 else None,
            "dirty": bool(status_result.stdout.strip()),
        },
        "request": {
            "mode": args.mode,
            "from_ref": args.from_ref,
            "to_ref": args.to_ref,
            "since": args.since,
            "until": args.until,
            "include_merges": args.include_merges,
            "first_parent": args.first_parent,
            "include_files": not args.no_files,
            "max_commits": args.max_commits,
        },
        "summary": {
            "segment_count": len(collected_segments),
            "commit_count": total_commits,
            "overlap_count": len(overlaps),
        },
        "warnings": warnings,
        "segments": collected_segments,
    }

    output = Path(args.output).expanduser()
    if not output.is_absolute():
        output = repo / output
    output = output.resolve()
    write_json_atomic(output, payload)
    emit(
        {
            "ok": True,
            "operation": "collect-history",
            "output": str(output),
            "segments": len(collected_segments),
            "commits": total_commits,
            "warnings": warnings,
        }
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except FileNotFoundError as exc:
        fail("required executable not found", EXIT_GIT, [str(exc)])
