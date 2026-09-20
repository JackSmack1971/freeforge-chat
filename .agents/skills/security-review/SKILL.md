---
name: security-review
description: Review changes for compliance with the repository's security constitution (security/constitution.md) — XSS/sanitization, API-key storage, CSP/SRI, and untrusted-data validation. Trigger on markdown/HTML rendering, innerHTML, imported JSON, OpenRouter request/response handling, API-key storage, local/session storage, CSP/SRI/headers/netlify.toml, external URLs or network behavior, clipboard/export, agent persona import/export, or dependency/CDN-asset changes.
compatibility: Requires read access to security/constitution.md, SECURITY.md, and tests/security/.
---

# Security Review

`security/constitution.md` is the authoritative, machine-readable source of
security invariants for this repository. This skill is a *procedure* for
applying it during review — it does not restate the constitution's rules.
Read the constitution file itself for the current rule set; do not rely on
a cached or paraphrased copy of it, and do not duplicate its `must` /
`must_not` lists into this file or into review output.

`SECURITY.md` gives narrative context for the same rules. When the two
disagree, `security/constitution.md` wins — it is the enforceable contract;
`SECURITY.md` is explanatory.

## Role boundary

This skill reviews and reports. It does not implement fixes unless the
invoking task has explicitly assigned this agent as the writer for the
finding. Default output is findings, not diffs.

## When to run this review

Run it for any change touching:

- markdown/HTML rendering, `innerHTML`
- imported or remote JSON (agent personas, chat history, OpenRouter
  responses)
- OpenRouter request/response handling
- API-key storage or handling
- `localStorage` / `sessionStorage`
- CSP, SRI, HTTP headers, `netlify.toml`
- external URLs or outbound network behavior
- clipboard or export features
- agent persona import/export
- dependencies or CDN-loaded assets

If a diff touches none of these surfaces, this skill does not apply — say so
and skip it rather than forcing a review.

## Procedure

1. **Map changed trust boundaries.** For each changed file, identify where
   untrusted data enters (network response, imported file, clipboard,
   localStorage read written by a prior session, URL) and where it exits
   (DOM sink, storage write, outbound request, export).

2. **Load `security/constitution.md` and pick applicable rules.** Match
   each trust boundary from step 1 to the constitution's rule `id`s, and
   note the `vulnerability_class`, `cwe`, and `owasp` fields for citation in
   findings. Do not invent rules not present in the file; if a boundary has
   no corresponding rule, say so explicitly instead of silently applying an
   unrelated one.

3. **Trace the actual path.** Follow the real code path from input →
   validation → storage → rendering/network, reading the actual source
   (not a summary of it). A rule is satisfied only if every step on the
   concrete path enforces it — e.g. sanitization added on one render path
   but not another is a fail, not a pass.

4. **Inspect the tests that prove the invariant.** Use the reference
   mapping below to find the tests covering the rule(s) in scope. Confirm
   they still assert the invariant after the change (not just that they
   still pass) — a test that was loosened to accommodate the change is a
   finding, not a green light.

5. **Require targeted negative/adversarial cases for anything new.** New
   code on a covered trust boundary needs a test that proves the *bad*
   path is rejected or neutralized (e.g. a payload that would execute if
   unsanitized, a key that must not survive to persistent storage, a
   malformed imported document), not just a happy-path test.

6. **Report findings by severity**, each with concrete evidence:
   `file:symbol` or `file:line`, the constitution rule id (or CWE/OWASP
   reference for anything outside the constitution's current scope), and
   the concrete failure path. No evidence, no finding.

7. **Separate behavioral advice from enforceable policy.** Label anything
   that is a good practice but not an encoded constitution rule as
   "advisory" — do not present it with the same weight as a constitution
   violation.

## Hard invariants (non-negotiable, no severity judgment call needed)

These four hold regardless of how a change is framed. A violation is
always a finding, never a style note:

- The OpenRouter API key never enters persistent storage, logs, or
  exports.
- Untrusted content never reaches `innerHTML` before sanitization.
- Imported structured data (personas, chat history, remote JSON) is
  schema/shape-validated before use.
- Any change that weakens CSP or removes/loosens SRI requires explicit,
  named human review — flag it, don't wave it through even if the rest of
  the diff looks fine.

Tests must never send real secrets or make real network calls — a test
that does either is itself a finding, independent of what it's testing.

## Constitution → test reference map

| Constitution rule id | Tests proving the invariant |
|---|---|
| `render-assistant-html-safely` | `tests/security/markdown-pipeline.test.mjs`, `tests/security/innerhtml-audit.test.mjs`, `tests/security/runtime-ui-features.test.mjs` |
| `keep-api-key-out-of-persistent-storage` | `tests/security/state-storage.test.mjs`, `tests/security/runtime-state-api.test.mjs`, `tests/security/runtime-undo-edit.test.mjs` |
| `preserve-csp-and-subresource-integrity` | `tests/security/style-csp.test.mjs` |
| `validate-untrusted-structured-data` | `tests/security/agent-schema.test.mjs`, `tests/security/agent-storage.test.mjs` |

This map is a starting point for step 4, not a substitute for confirming
coverage against the current constitution file — re-check it when
`security/constitution.md` gains or changes a rule id, since the map can
drift out of date.

## Output format

For each finding: severity, one-line summary, `file:symbol`, constitution
rule id or CWE/OWASP reference, the concrete failure path, and whether a
regression/negative test exists. End with which of the hard invariants
above were explicitly checked, even when clean.
