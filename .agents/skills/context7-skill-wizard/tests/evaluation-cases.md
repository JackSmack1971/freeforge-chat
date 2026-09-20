# Evaluation cases

1. Explicitly invoke the skill for “build a skill for Prisma transactions”.
   It should request Context7 library resolution and not invent APIs.
2. Ask for “general advice on writing skills”. The skill should not trigger as
   a library-specific wizard.
3. Simulate unavailable Context7. The workflow should report the gap and stop,
   rather than using an undocumented fallback or a legacy launcher.
4. Validate a generated fixture with `scripts/validate_generated_skill.py` and
   confirm invalid frontmatter, nested references, and oversized bodies fail.
