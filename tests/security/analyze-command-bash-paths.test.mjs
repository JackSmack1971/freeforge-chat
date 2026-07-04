import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const hookPath = '.claude/hooks/validators/analyze-command.js';

function runHook(command) {
  const result = spawnSync(process.execPath, [hookPath], {
    encoding: 'utf8',
    input: JSON.stringify({ tool_input: { command } })
  });

  assert.equal(result.error, undefined);
  return JSON.parse(result.stdout);
}

test('asks for Bash writes to governance files', () => {
  const payload = runHook('echo checkpoint > .claude/agents/lead-engineer.md');
  assert.equal(payload.hookSpecificOutput.permissionDecision, 'ask');
});

test('denies Bash writes to hard-protected files', () => {
  const payload = runHook('echo token > .env.local');
  assert.equal(payload.hookSpecificOutput.permissionDecision, 'deny');
});
