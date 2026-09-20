# Evidence schema and evidence-vs-assumption discipline

Reference material for the `control-plane-validation` skill. Load it when
interpreting `scripts/run-checks.mjs` output, or when writing the final
report for a control-plane change.

## `run-checks.mjs` JSON shape

```jsonc
{
  "tool": ".agents/skills/control-plane-validation/scripts/run-checks.mjs",
  "root": "<absolute repo root>",
  "gitBaseline": {
    "isGitRepo": true,
    "branch": "main",
    "headSha": "<40-char sha or null>",
    "dirty": true,
    "rawStatusLineCount": 66
  },
  "diffScope": {
    "inScope": [{ "path": "AGENTS.md", "statusCode": "M", "plane": "behavioral-policy" }],
    "outOfScopeCount": 40,
    "byPlane": { "behavioral-policy": [{ "path": "AGENTS.md", "statusCode": "M" }] }
  },
  "controlPlaneVerifier": {
    "ran": true,
    "result": { /* full tools/control-plane/verify.mjs runVerification() output */ }
  },
  "diffCheck": {
    "unstagedExit": 0,
    "stagedExit": 0,
    "output": "<raw git diff --check output, or null>",
    "hasConflictMarkers": false,
    "authoritativeFailure": false
  },
  "syntaxCheck": {
    "checked": 1,
    "failures": 0,
    "results": [{ "path": "tools/control-plane/verify.mjs", "ok": true, "detail": null }]
  },
  "ok": true
}
```

`ok` is `true` iff: the control-plane verifier ran and reported `ok: true`,
`diffCheck.authoritativeFailure` is `false` (i.e. no real conflict markers —
trailing-whitespace-only findings do not fail this), and every syntax-checked
file parsed. A `false` `ok` means at least one of those three failed; read
the corresponding sub-object for which one.

## Status vocabulary

Use these four states consistently in any report this skill produces —
never collapse them into a binary pass/fail:

- **PASS** — the check ran and the condition held.
- **FAIL** — the check ran and the condition did not hold. Authoritative
  FAILs (see `tools/control-plane/verify.mjs`'s own `authoritative` flag per
  check, and this skill's `diffCheck.authoritativeFailure`) block a
  release-ready claim; non-authoritative/informational FAILs (e.g. the
  Claude-compatibility check inside `verify.mjs`) are reported but do not by
  themselves block one.
- **SKIPPED** — the check could not run (missing binary, missing optional
  directory, `codex` CLI unavailable for live execpolicy checks, etc.). A
  SKIPPED check is *not* evidence of a passing condition. Never report
  "N/A" or silently omit a skipped check from the final summary — name it
  and say why.
- **UNVERIFIED** — no check attempted to cover this claim at all (distinct
  from SKIPPED, where a check tried and could not run). If step 3 of
  SKILL.md's workflow (checking current official Codex docs) could not be
  performed because network access was unavailable, the claim "the Codex
  rule-file format hasn't changed" is UNVERIFIED, not PASS.

## Evidence vs. assumption

Per the workflow's step 8 ("distinguish tested evidence from assumptions"):

- A claim backed by this skill's own script output, `tools/control-plane/verify.mjs`
  output, `git diff`/`git status` output captured in the current session, or
  a freshly fetched official Codex doc is **evidence**.
- A claim backed by `docs/control-plane/CURRENT_STATE.md`,
  `docs/control-plane/MIGRATION_CONTRACT.md`, a prior session's summary, a
  `.planning/**` artifact, or this skill's own reference files (including
  this one) is a **hypothesis** until re-confirmed against current on-disk
  state or a current tool run. Migration invariant 3.6 ("git diff is
  authoritative") says exactly this about `CURRENT_STATE.md` specifically;
  apply the same discipline to every other static document.
- Never upgrade a hypothesis to evidence by repeating it. If a prior
  document and a fresh `run-checks.mjs`/`verify.mjs` run disagree, the fresh
  run wins, and the disagreement itself is worth reporting (the static
  document is now stale, which is useful to know).

## Blocking a release-ready claim (step 9)

Do not state or imply a control-plane change is "ready to merge," "safe to
release," or "production ready" when any of the following holds:

- `tools/control-plane/verify.mjs` could not run at all (not merely a
  SKIPPED sub-check — the whole tool failing to execute).
- Step 3 (current official Codex docs) was required by the change (i.e. the
  change touches a Codex-native file format: `.codex/config.toml`,
  `.codex/hooks.json`, `.codex/rules/*.rules`, `.codex/agents/*.toml`) and
  could not be performed.
- Any authoritative check reports FAIL and has not been fixed or explicitly
  accepted by the user as a known, called-out exception.
- The diff scope includes a path this skill's plane map does not recognize
  and its plane could not be established by other means (surface it as an
  open question, do not guess).

None of the above authorizes push, merge, or deploy on its own even when all
checks pass — see the authority statement in
[`topology.md`](topology.md). This section only governs what this skill is
allowed to *claim*, not what it authorizes.
