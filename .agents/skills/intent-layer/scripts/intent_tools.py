"""Cross-platform Intent Layer inspection helpers."""

from __future__ import annotations

import argparse
from pathlib import Path


SKIP_DIRS = {"node_modules", ".git", "dist", ".next", "build", "__pycache__"}
CODE_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".rb",
    ".php", ".swift", ".kt", ".c", ".cpp", ".h", ".cs", ".vue",
    ".svelte", ".astro", ".md", ".mdx", ".json", ".yaml", ".yml",
    ".toml", ".sql", ".graphql", ".prisma",
}


def files(root: Path):
    for path in root.rglob("*"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.is_file():
            yield path


def detect_state(root: Path) -> int:
    root_file = "AGENTS.md" if (root / "AGENTS.md").is_file() else None
    has_section = bool(root_file and "## Intent Layer" in (root / root_file).read_text(encoding="utf-8", errors="replace"))
    children = sorted(path for path in root.rglob("AGENTS.md") if path != root / "AGENTS.md" and not any(part in SKIP_DIRS for part in path.parts))
    print("=== Intent Layer State ===")
    print(f"root_file: {root_file or 'none'}")
    print(f"has_intent_section: {str(has_section).lower()}")
    print(f"child_nodes: {len(children)}")
    for path in children:
        print(f"  - {path}")
    print()
    if not root_file:
        print("state: none\naction: initial setup required")
    elif not has_section:
        print(f"state: partial\naction: add Intent Layer section to {root_file}")
    else:
        print("state: complete\naction: maintenance mode (audit/candidates/both)")
    return 0


def analyze(root: Path) -> int:
    print("=== Intent Layer Structure Analysis ===")
    print(f"Target: {root}\n")
    print("## Directory Structure (depth 3)")
    dirs = sorted({path.parent for path in files(root) if len(path.relative_to(root).parts) <= 3})[:50]
    for path in dirs:
        print(path)
    print("\n## Existing Intent Nodes")
    for path in sorted(root.rglob("AGENTS.md")):
        if not any(part in SKIP_DIRS for part in path.parts):
            print(path)
    print("\n## Large Directories (potential boundaries)")
    for directory in sorted({path.parent for path in files(root)}):
        count = sum(1 for path in directory.iterdir() if path.is_file())
        if count > 20:
            print(f"{count} files: {directory}")
    print("\n## Package/Config Files (semantic boundaries)")
    for path in sorted(files(root)):
        if path.name in {"package.json", "Cargo.toml", "go.mod", "pyproject.toml"} and len(path.relative_to(root).parts) <= 4:
            print(path)
    print("\n## Suggested Intent Node Locations")
    print(f"1. Root: {root / 'AGENTS.md'} (required)")
    for name in ("src", "lib", "app", "packages", "services", "api"):
        if (root / name).is_dir():
            print(f"2. Source: {root / name / 'AGENTS.md'}")
    return 0


def estimate(root: Path) -> int:
    if not root.is_dir():
        raise SystemExit(f"Error: Path not found: {root}")
    selected = [path for path in files(root) if path.suffix.lower() in CODE_EXTENSIONS]
    byte_count = sum(path.stat().st_size for path in selected)
    # ponytail: byte/4 is a bounded compatibility heuristic; use runtime telemetry for actual tokens.
    tokens = byte_count // 4
    formatted = f"{tokens / 1_000_000:.1f}M" if tokens >= 1_000_000 else f"{tokens / 1_000:.1f}k" if tokens >= 1_000 else str(tokens)
    print(f"=== Token Estimate: {root.name} ===\n\nTotal tokens: ~{formatted} ({tokens})\nFile count: {len(selected)}\n")
    if tokens < 20_000:
        print("Threshold: <20k\nRecommendation: No dedicated Intent Node needed")
    elif tokens < 64_000:
        print("Threshold: 20-64k\nRecommendation: Good candidate for 2-3k token Intent Node")
    else:
        print("Threshold: >64k\nRecommendation: Consider splitting into child Intent Nodes")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("detect-state", "analyze", "estimate"))
    parser.add_argument("path", nargs="?", default=".")
    args = parser.parse_args()
    root = Path(args.path).resolve()
    return {"detect-state": detect_state, "analyze": analyze, "estimate": estimate}[args.command](root)


if __name__ == "__main__":
    raise SystemExit(main())
