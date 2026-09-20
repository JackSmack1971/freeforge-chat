# Verification

- Source package: `.claude/skills/healing-test-failures/SKILL.md` (retrieved via
  `git show HEAD:.claude/skills/healing-test-failures/SKILL.md`; the file is
  deleted, uncommitted, in the current working tree — read from history, not
  restored).
- Target package: `.agents/skills/healing-test-failures/`.
- Preserved principle: diagnose before changing production code (`freeforge/src/`).
- Preserved and made explicit: the referenced-but-not-inlined
  `.claude/rules/failure-escalation.md` two-attempt escalation cap and payload
  fields, now folded directly into `SKILL.md` (that rules file and its
  `.claude/`-only Claude Code frontmatter are not ported, per repo convention —
  `.agents/skills/*/SKILL.md` here use only `name`/`description`/optional
  `compatibility`; no `allowed-tools`, `disable-model-invocation`, or
  `user-invocable` fields, matching `test-driven-development`,
  `systematic-debugging`, and `stack-detection`).
- Removed the `codebase-cartographer` agent dependency (Claude-Code-only
  subagent, not present in this repository) in favor of directly inspecting
  `freeforge/src/`, the test file, `tests/helpers/mock-dom.mjs`, and
  `tests/AGENTS.md` — this repo's actual node:test/mock-dom conventions.
- Added, not present in the source: explicit reproduce → classify (production
  vs. test vs. environment/tooling) → minimize → inspect → remediate (2-cycle
  cap per error signature) → rerun focused → broaden-after-success → escalate
  ordering, tailored to `node --test`, `--test-name-pattern`,
  `tests/security/*.test.mjs`, `installGlobals`/`restore()`,
  `resetState(S)`/`importFresh`/`importShared`, and the awaited-microtask
  pattern documented in `tests/AGENTS.md`.
- Added an explicit non-authorization statement for GitHub issue filing: the
  skill may request that external effect but does not grant itself the
  authority to perform it, matching the goal instruction and this repository's
  `control-plane-validation` authority-statement convention.

## Discovery validation

Ran the repository's control-plane validator, which enumerates every
`.agents/skills/*/SKILL.md` and checks frontmatter and `.gitignore` visibility:

```bash
node tools/control-plane/verify.mjs
```

Observed in this environment on 2026-09-20 (source commit
`76f40a99368aa4627f32cbe439cf45e1e3f039dc`):

```
[PASS] agents-skills:healing-test-failures — .agents/skills/healing-test-failures/SKILL.md exists and has valid name/description
[PASS] control-plane-not-ignored:.agents/skills/healing-test-failures/SKILL.md — .agents/skills/healing-test-failures/SKILL.md is not hidden by .gitignore
```

Final JSON summary: `"ok": true`, zero `[FAIL]` lines in the full run.

## Synthetic failure fixture

To validate the workflow itself (not just discovery), ran a synthetic
production-defect fixture in the session scratchpad (outside the repository —
not committed, since it exercises the skill's steps rather than adding
repository test coverage):

`sanitize.mjs`:
```js
export function clampTokenBudget(used, max) {
  return used; // BUG: unclamped
}
```

`sanitize.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampTokenBudget } from './sanitize.mjs';

test('clampTokenBudget never exceeds max', () => {
  assert.equal(clampTokenBudget(500, 100), 100);
});
```

Followed the skill's steps:

1. **Reproduce** — `node --test sanitize.test.mjs` failed:
   `AssertionError: Expected values to be strictly equal: 500 !== 100`.
2. **Classify** — test's contract (`never exceeds max`) is correct; the source
   function ignores `max` entirely → production defect.
3. **Minimize** — already a single `test()` block, one file.
4. **Inspect** — read both the test and the implementation before editing.
5. **Remediate (cycle 1)** — changed `return used;` to
   `return Math.min(used, max);`.
6. **Rerun focused** — `node --test sanitize.test.mjs`:
   `# pass 1`, `# fail 0`. Resolved on cycle 1; the 2-cycle cap and escalation
   path were not exercised by this fixture (by construction — the fixture
   verifies the happy path of steps 1-7; the escalation-payload fields
   themselves are exercised by the `tests/evaluation-cases.md` scenarios in
   this skill directory, not by a live run).

This confirms the skill's step ordering (reproduce → classify → fix → rerun) is
mechanically followable with the exact commands it prescribes.
