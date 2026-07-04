#!/usr/bin/env node
// Lightweight Stop hook. Keep heavy tests out of Stop; run /quality-gate explicitly.
process.stdout.write(
  'Swarm turn complete. Run /quality-gate before commit, merge, deploy, or release. Run /control-plane-check after framework edits, and use /handoff before pausing multi-step work. Include raw stdout for every passing verification command.\n'
);
process.exit(0);
