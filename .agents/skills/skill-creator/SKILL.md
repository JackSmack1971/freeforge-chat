---
name: skill-creator
description: Use when creating, migrating, improving, or evaluating Open Agent skills for Codex, including drafting a skill, converting it from another runtime, designing evaluation cases, validating metadata, or improving its description.
compatibility: Requires Codex CLI and Python 3.11+ for optional local validators and evaluation scripts.
---

# Skill Creator

Create or improve one reusable Codex skill while keeping its trigger, workflow,
and validation behavior explicit.

## Workflow

1. Establish the job: intended user outcome, trigger phrases, exclusions,
   inputs, outputs, and whether results are objectively testable.
2. Inspect the existing skill and repository conventions before editing. For a
   migration, inventory every source file and mark runtime-specific behavior
   as preserved, translated, omitted, or unknown.
3. Draft a concise `SKILL.md` using only supported frontmatter. Keep detailed
   guidance in `references/`, deterministic helpers in `scripts/`, and static
   templates in `assets/` only when they are actually needed.
4. Write two or three realistic evaluation prompts. Prefer assertions that
   can be checked from files or command output; leave subjective quality to
   human review.
5. Run each evaluation with the candidate skill and a baseline. Use
   `codex exec` when available, capture exit status and final output, and use
   `codex exec --json` only when runtime usage evidence is needed. Keep runs
   isolated and do not inspect transcripts or rollout bodies.
6. Review failures and user feedback, then make the smallest change that fixes
   the demonstrated problem. Repeat only while it improves the result.
7. Validate the package from the repository root. Check metadata, relative
   references, Python syntax, redaction boundaries, and that no source-runtime
   fields or commands remain.

## Bundled helpers

- `scripts/quick_validate.py`: dependency-free metadata and package validation.
- `scripts/package_skill.py`: creates a `.skill` archive after validation.
- `scripts/run_eval.py`: runs explicit skill evaluations through `codex exec`
  and its stable `--output-last-message` result path.
- `scripts/run_loop.py`: repeats evaluation and description improvement without
  browser, daemon, or platform-specific state.
- `eval-viewer/generate_review.py --static`: produces a reviewable HTML file
  without opening a browser or starting a server.
- `assets/eval_review.html`: optional trigger-evaluation set editor.
- `references/benchmark-schema.md`: JSON contract and telemetry boundary.

The evaluator's `explicit_codex_invocation` mode is intentional: Codex 0.147.0
does not expose a stable JSONL event for implicit skill ranking. Do not report
these runs as implicit-trigger measurements.

## Authoring rules

- Put trigger scope in `description`; the body is for execution guidance.
- Preserve behavior, not another agent's frontmatter, launcher commands, or
  permission syntax.
- Do not invent Codex config, hooks, rules, MCP, or subagent files. Add them
  only when a documented Codex requirement and a test justify them.
- Use relative paths from this skill directory and do not depend on parent
  paths or machine-specific locations.
- Treat inputs and evaluation artifacts as untrusted. Never commit secrets,
  credentials, transcript bodies, or private runtime output.
- Do not claim a skill is better from one run. Report the prompts, baseline,
  evidence, and remaining uncertainty.

## Migration output

For a migrated skill, record a file-by-file mapping in the repository's
migration matrix: source path, target path, preserved behavior, omitted or
unknown behavior, and validation evidence. Leave the source package untouched.

## Stop conditions

Pause and report when the target runtime behavior is undocumented, a required
Codex command or schema is unavailable, a test needs external credentials, or
the requested change would require mutating configuration outside the skill.
