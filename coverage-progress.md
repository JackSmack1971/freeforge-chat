# Coverage Progress

## Baseline

- Initial known coverage before this turn’s extra agent-coverage work: statements/lines 83.45%, branches 84.62%, functions 82.14%.

## Current

- Final verified coverage: statements/lines 92.5%, branches 87.86%, functions 90.47%.

## Commands Run

- `node --test tests/security/agent-ui-features.test.mjs`
- `npx --yes c8 --all --include "freeforge/src/**/*.js" --reporter=text node --test tests/security/*.test.mjs`

## Behaviors Covered

- `ui/agent-library.js`
  - Saved-agent rendering, active/saved badges, modal open/close visibility, and focus restoration.
- `ui/agent-builder.js`
  - Agent form rendering, edit-mode labels, draft reading, and newline splitting for starter prompts.
- `features/agents.js`
  - Builder submit saves a new agent, library actions dispatch duplicate/set-active/delete/export flows, and file import activates the imported agent.

## Notes

- The new test file is `tests/security/agent-ui-features.test.mjs`.
- The remaining uncovered branches are now concentrated in existing agent-management edge cases rather than the entire feature surface.
