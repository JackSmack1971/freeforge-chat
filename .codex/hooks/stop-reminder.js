#!/usr/bin/env node
// Stop hook: reminds the model, at end of turn, that passing checks are
// evidence rather than approval, and that it must not claim success it has
// not actually run. Never blocks the turn from ending and never asserts
// that anything passed or failed itself — it has no visibility into what
// was actually run this turn. Advisory only.
'use strict';

const { readStdinJson, writeJson } = require('./_shared');

const REMINDER =
  'Turn complete. Before reporting this as done: state only checks you actually ran this turn, with their real ' +
  'output — do not claim tests/lint/typecheck passed unless you ran them just now. `npm test` / `npm run lint` / ' +
  '`npm run typecheck` (see CLAUDE.md source-of-truth commands) are evidence, not authorization to commit, merge, or ' +
  'deploy (docs/control-plane/MIGRATION_CONTRACT.md section 3.7). If something is unverified or still failing, say so ' +
  'explicitly as a Limitation rather than reporting completion.';

async function main() {
  try {
    await readStdinJson();
  } catch {
    // Input is irrelevant to this reminder's content; ignore parse errors.
  }
  writeJson({
    systemMessage: REMINDER,
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext: REMINDER,
    },
  });
  process.exit(0);
}

main().catch(() => process.exit(0));
