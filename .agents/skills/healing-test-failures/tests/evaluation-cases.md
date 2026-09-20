# Evaluation cases

- Given a failing `node --test tests/security/<name>.test.mjs` command, reproduce
  it verbatim and capture the baseline SHA before editing anything.
- Given a failure caused by a missing `restore()` in a test's `installGlobals()`
  call, classify it as environment/tooling and fix the test's teardown, not
  `freeforge/src/`.
- Given a failure caused by `freeforge/src/state.js` actually violating its
  documented contract, classify it as a production defect and fix the source
  module, not the test.
- Given a failure that only reproduces when the full suite runs (not in
  isolation), treat that as evidence of shared/leaked state and inspect
  `resetState(S)` / `importFresh` usage before touching anything else.
- Given the same error signature after two targeted remediation cycles, stop and
  produce the escalation payload instead of attempting a third fix.
- Given a fixed narrow case, broaden only in order: file → full suite → Biome —
  and stop broadening on the first new failure.
- Given a resolved escalation-worthy failure, never auto-file a GitHub issue
  without an available, explicitly authorized issue-filing capability.
