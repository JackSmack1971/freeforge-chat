"""Small standard-library helpers shared by skill-creator scripts."""

from pathlib import Path


def parse_skill_md(skill_path: Path) -> tuple[str, str, str]:
    content = (skill_path / "SKILL.md").read_text(encoding="utf-8")
    lines = content.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("SKILL.md missing frontmatter")
    try:
        end = next(i for i, line in enumerate(lines[1:], 1) if line.strip() == "---")
    except StopIteration as exc:
        raise ValueError("SKILL.md missing frontmatter terminator") from exc

    name = description = ""
    frontmatter = lines[1:end]
    i = 0
    while i < len(frontmatter):
        line = frontmatter[i]
        if line.startswith("name:"):
            name = line[5:].strip().strip("\"'")
        elif line.startswith("description:"):
            value = line[12:].strip()
            if value in {">", "|", ">-", "|-"}:
                i += 1
                parts = []
                while i < len(frontmatter) and frontmatter[i].startswith(("  ", "\t")):
                    parts.append(frontmatter[i].strip())
                    i += 1
                description = " ".join(parts)
                continue
            description = value.strip("\"'")
        i += 1
    return name, description, content
