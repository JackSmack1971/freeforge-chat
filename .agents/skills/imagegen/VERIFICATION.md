# Verification

- Python AST check passed for both scripts.
- `python scripts/image_gen.py generate --prompt a-blue-square --dry-run` passed without an API key or network call.
- Source files remain under `.claude/skills/imagegen/`; target files are under `.agents/skills/imagegen/`.
- Live image generation was not run because it would require an API key and external side effects.
