#!/usr/bin/env python3
"""Read-only, bounded inventory of the Codex CLI control plane."""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:  # Python < 3.11: preserve safe shape-only fallback.
    tomllib = None

MAX_RECORDS = 100
SKIP_DIRS = {".git", "node_modules", "vendor", ".venv", "venv", "dist", "build", ".cache", "__pycache__"}
DISCOVERY_KEYS = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}
CONTEXT_KEYS = {
    "project_doc_max_bytes", "project_doc_fallback_filenames", "model_instructions_file", "model_context_window",
    "history", "tool_output_token_limit", "skills", "agents", "hooks", "mcp_servers", "sandbox_mode",
    "approval_policy", "model", "review_model", "reasoning_effort", "profile",
}
HOOK_EVENTS = {"SessionStart", "SessionEnd", "SubagentStart", "SubagentStop", "PreToolUse", "PostToolUse", "UserPromptSubmit", "PreCompact", "PostCompact", "Stop", "PermissionRequest"}


def metadata(path: Path, root: Path) -> dict[str, Any]:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
        return {"relative_path": str(path.relative_to(root)), "size_bytes": path.stat().st_size, "lines": len(text.splitlines()), "chars": len(text)}
    except (OSError, ValueError):
        return {"relative_path": str(path), "readable": False}


def bounded(paths: list[Path]) -> tuple[list[Path], dict[str, Any]]:
    paths = sorted(paths)
    shown = paths[:MAX_RECORDS]
    return shown, {"total": len(paths), "shown": len(shown), "truncated": len(paths) > len(shown), "omitted": max(0, len(paths) - len(shown))}


def read_json(path: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def frontmatter(text: str) -> dict[str, str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    result: dict[str, str] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            return result
        if line[:1].isspace() or ":" not in line:
            continue
        key, value = line.split(":", 1)
        result[key.strip()] = value.strip().strip("'\"")
    return {}


def skill_record(path: Path, root: Path) -> dict[str, Any]:
    record = metadata(path, root)
    try:
        fm = frontmatter(path.read_text(encoding="utf-8", errors="replace"))
    except OSError:
        fm = {}
    record.update({
        "name": fm.get("name", path.parent.name),
        "description_chars": len(fm.get("description", "")),
        "frontmatter_keys": sorted(key for key in fm if key in DISCOVERY_KEYS),
        "has_scripts": (path.parent / "scripts").is_dir(),
        "has_references": (path.parent / "references").is_dir(),
        "has_assets": (path.parent / "assets").is_dir(),
        "has_agents_metadata": (path.parent / "agents" / "openai.yaml").is_file(),
    })
    return record


def skill_inventory(repo: Path, cwd: Path, codex_home: Path) -> dict[str, Any]:
    roots = []
    current = cwd
    while True:
        roots.append(current / ".agents" / "skills")
        if current == repo:
            break
        if current.parent == current:
            break
        current = current.parent
    roots.append(Path.home() / ".agents" / "skills")
    paths = [path for root in roots if root.is_dir() for path in root.rglob("SKILL.md") if all(part not in SKIP_DIRS for part in path.parts)]
    shown, counts = bounded(paths)
    return {"skills": [skill_record(path, repo) for path in shown], "record_counts": counts, "scan_roots": [str(root) for root in roots if root.is_dir()]}


def instruction_inventory(repo: Path, cwd: Path, codex_home: Path) -> dict[str, Any]:
    paths: list[Path] = []
    for root in (codex_home, repo):
        if root.is_file():
            continue
        candidates = [root / name for name in ("AGENTS.md", "AGENTS.override.md") if (root / name).is_file()]
        paths.extend(candidates)
    current = cwd
    while True:
        for name in ("AGENTS.md", "AGENTS.override.md"):
            path = current / name
            if path.is_file() and path not in paths:
                paths.append(path)
        current = current.parent
        if current == repo.parent:
            break
    shown, counts = bounded(paths)
    return {"files": [metadata(path, repo) for path in shown], "record_counts": counts}


def classify(value: Any) -> Any:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, list):
        return {"count": len(value)}
    if isinstance(value, dict):
        return {"keys": sorted(str(key) for key in value)[:MAX_RECORDS], "key_count": len(value)}
    return "configured" if value is not None else None


def toml_record(path: Path, root: Path) -> dict[str, Any]:
    record = metadata(path, root)
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return record | {"valid_toml": False}
    if tomllib is None:
        return record | {"valid_toml": None, "parser": "unavailable"}
    try:
        data = tomllib.loads(raw)
    except tomllib.TOMLDecodeError:
        return record | {"valid_toml": False}
    context = {key: classify(data[key]) for key in CONTEXT_KEYS if key in data}
    hook = data.get("hooks") if isinstance(data.get("hooks"), dict) else None
    record.update({"valid_toml": True, "context_keys": sorted(context), "context_values": context, "hook_events": sorted(set(hook or {}) & HOOK_EVENTS), "has_hooks": hook is not None})
    return record


def hook_record(path: Path, root: Path) -> dict[str, Any]:
    record = metadata(path, root)
    data = read_json(path)
    if not isinstance(data, dict):
        return record | {"valid_json": False}
    events = sorted(set(str(key) for key in data) & HOOK_EVENTS)
    handlers = 0
    context_limits = 0
    for groups in data.values():
        if not isinstance(groups, list):
            continue
        for group in groups:
            if not isinstance(group, dict):
                continue
            values = group.get("hooks", [])
            if isinstance(values, list):
                handlers += len(values)
                context_limits += sum(isinstance(item, dict) and "additionalContextLimit" in item for item in values)
    return record | {"valid_json": True, "event_count": len(events), "events": events, "handler_count": handlers, "additional_context_limit_count": context_limits}


def rules_inventory(root: Path, base: Path) -> dict[str, Any]:
    paths = list(root.glob("rules/*.rules")) if root.is_dir() else []
    shown, counts = bounded([path for path in paths if path.is_file()])
    records = []
    for path in shown:
        record = metadata(path, base)
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            text = ""
        record["decisions_present"] = sorted(set(re.findall(r"decision\s*=\s*[\"'](allow|prompt|forbidden)[\"']", text)))
        records.append(record)
    return {"files": records, "record_counts": counts}


def layer_inventory(root: Path, base: Path) -> dict[str, Any]:
    result: dict[str, Any] = {"root": str(root), "available": root.is_dir()}
    config = root / "config.toml"
    result["config"] = toml_record(config, base) if config.is_file() else None
    hooks = root / "hooks.json"
    result["hooks"] = hook_record(hooks, base) if hooks.is_file() else None
    result["rules"] = rules_inventory(root, base)
    agents = sorted(path for path in (root / "agents").glob("*.toml") if path.is_file()) if root.is_dir() else []
    shown, counts = bounded(agents)
    result["agents"] = {"files": [metadata(path, base) for path in shown], "record_counts": counts}
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=os.getcwd())
    parser.add_argument("--cwd", default=os.getcwd())
    parser.add_argument("--codex-home", default=os.environ.get("CODEX_HOME", str(Path.home() / ".codex")))
    args = parser.parse_args()
    repo = Path(args.repo).expanduser().resolve()
    cwd = Path(args.cwd).expanduser().resolve()
    codex_home = Path(args.codex_home).expanduser().resolve()
    project_layer = repo / ".codex"
    payload = {
        "schema_version": 1,
        "inputs": {"repo": str(repo), "cwd": str(cwd), "codex_home": str(codex_home)},
        "collector_guarantees": {"read_only": True, "emits_file_bodies": False, "emits_raw_environment_values": False, "emits_commands_or_urls": False, "emits_hook_payloads": False, "reads_transcripts": False, "token_estimation": "none"},
        "environment": {"CODEX_HOME_present": "CODEX_HOME" in os.environ},
        "instructions": instruction_inventory(repo, cwd, codex_home),
        "skills": skill_inventory(repo, cwd, codex_home),
        "project_codex": layer_inventory(project_layer, repo),
        "user_codex": layer_inventory(codex_home, repo),
        "runtime_telemetry": {"available": False, "note": "Supply Codex runtime or exec JSON telemetry separately when exact context usage is needed."},
        "not_resolved": ["project trust state", "active profile and merged precedence", "actual hook stdout/additionalContext", "live MCP connections", "session transcript contents", "effective runtime context utilization"],
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
