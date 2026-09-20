# Hook Guidance for PR Review Skill

Use hooks only when the team wants deterministic enforcement around PR review submission. Place reviewed hook configuration in the repository's `.codex/hooks.json` only after confirming the current Codex hook schema and project trust state.

## PreToolUse guard
Purpose: prevent ad-hoc GitHub review submission. Allow review posting only through `scripts/post_review.py`, which validates the review body and requires `--confirm-submit`.

Recommended behavior:
- Block `gh pr review` commands unless the command is executed by `post_review.py`.
- Block commands that expose environment variables or tokens.
- Block destructive git commands during review, including `git reset --hard`, `git clean -fd`, and force pushes.

## PostToolUse validation
Purpose: validate generated review drafts immediately after the skill writes them.

Recommended behavior:
- When `codex-pr-reviews/**/review.md` changes, run `python3 .agents/skills/pr-review/scripts/validate_review.py <path>`.
- If validation fails, return the validator errors to the agent and require repair before submission.

## Stop / TaskCompleted check
Purpose: prevent incomplete review handoff.

Required final state:
- Context collection succeeded or failure was explicitly documented.
- Review draft exists.
- Validator exited zero.
- Submission result is recorded when `--submit-review` was used.

## SubagentStop check
Purpose: keep forked review work structured.

If this skill is used in a forked reviewer or governance pipeline, require subagents to return only:
- decision;
- finding count;
- review draft path;
- validation result;
- submission URL or failure reason.


