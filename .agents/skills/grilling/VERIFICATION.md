# Verification

- Source inventory: `.claude/skills/grilling/SKILL.md` contained one skill definition and no scripts or references.
- Target mapping: `.agents/skills/grilling/SKILL.md` preserves the one-question interview, recommendation, codebase-exploration, and confirmation gates.
- Omitted source metadata: Claude-only `disable-model-invocation` was not copied; no Codex-native replacement was evidenced or needed.
- Validation: frontmatter name matches the directory; required `name` and `description` are present; no Claude-only fields or paths remain.

