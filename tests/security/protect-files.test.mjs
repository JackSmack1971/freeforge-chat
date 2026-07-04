import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const hookPath = '.claude/hooks/validators/protect-files.js';

function runHook(payload) {
  return spawnSync(process.execPath, [hookPath], {
    encoding: 'utf8',
    input: JSON.stringify(payload),
  });
}

function runWrite(filePath) {
  return runHook({
    tool_name: 'Write',
    tool_input: { file_path: filePath },
  });
}

function runBash(command) {
  return runHook({
    tool_name: 'Bash',
    tool_input: { command },
  });
}

function parseDecision(result) {
  assert.equal(result.error, undefined);
  return JSON.parse(result.stdout);
}

test('protect-files.js denies, asks, and passes file-path inputs', () => {
  const denied = parseDecision(runWrite('.env'));
  assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny');

  const asked = parseDecision(runWrite('CLAUDE.md'));
  assert.equal(asked.hookSpecificOutput.permissionDecision, 'ask');

  const passResult = runWrite('docs/notes.txt');
  assert.equal(passResult.status, 0);
  assert.equal(passResult.stdout, '');
});

test('protect-files.js applies the same protection rules to Bash commands', () => {
  const denied = parseDecision(runBash('cp secret.txt .env'));
  assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny');

  const asked = parseDecision(runBash('cp draft.txt CLAUDE.md'));
  assert.equal(asked.hookSpecificOutput.permissionDecision, 'ask');

  const passResult = runBash('echo hello');
  assert.equal(passResult.status, 0);
  assert.equal(passResult.stdout, '');
});

test('protect-files.js agrees with analyze-command.js on a shared protected path', () => {
  const protect = parseDecision(runWrite('CLAUDE.md'));
  const analyze = parseDecision(runBash('cp draft.txt CLAUDE.md'));

  assert.equal(protect.hookSpecificOutput.permissionDecision, 'ask');
  assert.equal(analyze.hookSpecificOutput.permissionDecision, 'ask');
});
