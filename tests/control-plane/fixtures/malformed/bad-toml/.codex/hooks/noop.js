#!/usr/bin/env node
// Fixture no-op hook: reads stdin and exits 0 without producing output.
process.stdin.resume();
process.stdin.on('end', () => process.exit(0));
