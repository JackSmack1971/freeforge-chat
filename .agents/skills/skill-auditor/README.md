# Skill Auditor Pack

A read-only, evidence-first Open Agent skill for auditing individual skills and multi-skill workflows.

## Validate

```bash
python scripts/validate_skill_pack.py . --strict
python scripts/inventory_skill.py . --output /tmp/skill-auditor-inventory.json
```

## Install

- Codex desktop: upload the ZIP with `skill-auditor/` as the archive root.
- Codex CLI personal: copy to `~/.agents/skills/skill-auditor/`.
- Codex CLI project: copy to `.agents/skills/skill-auditor/`.
- OpenAI API: upload/manage separately for the target workspace.


