// Deterministic fixtures for .codex/hooks/*.js, the Codex-native hook layer
// documented in docs/control-plane/hooks-policy-map.md. Each hook is a
// standalone Node script with no dependency, so these tests spawn it
// directly with a representative JSON payload on stdin and assert on its
// stdout/exit behavior — no `codex` binary required.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');
const HOOKS_DIR = path.join(REPO_ROOT, '.codex', 'hooks');
const HANDOFF_PATH = path.join(REPO_ROOT, 'tools', 'control-plane', 'generated', 'handoff.json');

function runHook(scriptName, input) {
  const scriptPath = path.join(HOOKS_DIR, scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: REPO_ROOT,
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
  });
  assert.equal(result.error, undefined, `hook process failed to spawn: ${result.error}`);
  let json = null;
  if (result.stdout?.trim()) {
    try {
      json = JSON.parse(result.stdout);
    } catch {
      json = null;
    }
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, json };
}

// ---------------------------------------------------------------------------
// guard-protected-writes.js
// ---------------------------------------------------------------------------

test('guard-protected-writes: allows a read-only Bash command', () => {
  const { status, json } = runHook('guard-protected-writes.js', {
    tool_name: 'Bash',
    tool_input: { command: 'cat freeforge/src/index.js' },
  });
  assert.equal(status, 0);
  assert.equal(json, null, 'no JSON output expected for a plain allow');
});

test('guard-protected-writes: allows a non-write, non-guarded tool untouched', () => {
  const { status, json } = runHook('guard-protected-writes.js', {
    tool_name: 'Read',
    tool_input: { file_path: 'freeforge/src/index.js' },
  });
  assert.equal(status, 0);
  assert.equal(json, null);
});

test('guard-protected-writes: blocks an apply_patch write to a hard-protected path (.env)', () => {
  const patch = [
    '*** Begin Patch',
    '*** Add File: .env',
    '+SECRET=1',
    '*** End Patch',
  ].join('\n');
  const { status, json } = runHook('guard-protected-writes.js', {
    tool_name: 'apply_patch',
    tool_input: { command: patch },
  });
  assert.equal(status, 0, 'modern deny uses exit 0 with hookSpecificOutput, not the legacy exit-2 form');
  assert.equal(json?.hookSpecificOutput?.hookEventName, 'PreToolUse');
  assert.equal(json?.hookSpecificOutput?.permissionDecision, 'deny');
  assert.match(json?.hookSpecificOutput?.permissionDecisionReason ?? '', /\.env/);
});

test('guard-protected-writes: blocks a Bash write into .git/', () => {
  const { json } = runHook('guard-protected-writes.js', {
    tool_name: 'Bash',
    tool_input: { command: 'cp payload.json .git/hooks/pre-commit' },
  });
  assert.equal(json?.hookSpecificOutput?.permissionDecision, 'deny');
});

test('guard-protected-writes: advisory-allows (does not deny) a control-plane path write', () => {
  const patch = [
    '*** Begin Patch',
    '*** Update File: AGENTS.md',
    '@@',
    '-old',
    '+new',
    '*** End Patch',
  ].join('\n');
  const { status, json } = runHook('guard-protected-writes.js', {
    tool_name: 'apply_patch',
    tool_input: { command: patch },
  });
  assert.equal(status, 0);
  assert.equal(json?.hookSpecificOutput?.permissionDecision, 'allow');
  assert.match(json?.hookSpecificOutput?.additionalContext ?? '', /AGENTS\.md/);
  assert.match(json?.hookSpecificOutput?.additionalContext ?? '', /advisory/i);
});

test('guard-protected-writes: Windows-style backslash path is normalized and still blocked', () => {
  const { json } = runHook('guard-protected-writes.js', {
    tool_name: 'Bash',
    tool_input: { command: String.raw`copy id_rsa C:\Users\public\keys\id_rsa` },
  });
  assert.equal(json?.hookSpecificOutput?.permissionDecision, 'deny');
});

test('guard-protected-writes: Edit tool with a Windows-style secrets path is blocked', () => {
  const { json } = runHook('guard-protected-writes.js', {
    tool_name: 'Edit',
    tool_input: { file_path: String.raw`secrets\prod-credentials.json` },
  });
  assert.equal(json?.hookSpecificOutput?.permissionDecision, 'deny');
});

test('guard-protected-writes: fails closed (deny) on malformed JSON input', () => {
  const { status, json } = runHook('guard-protected-writes.js', '{not valid json');
  assert.equal(status, 0);
  assert.equal(json?.hookSpecificOutput?.permissionDecision, 'deny');
  assert.match(json?.hookSpecificOutput?.permissionDecisionReason ?? '', /fail-conservative/);
});

test('guard-protected-writes: fails closed (deny) on an apply_patch call with no recognizable file target', () => {
  const { json } = runHook('guard-protected-writes.js', {
    tool_name: 'apply_patch',
    tool_input: { command: 'not a real patch body' },
  });
  assert.equal(json?.hookSpecificOutput?.permissionDecision, 'deny');
});

// ---------------------------------------------------------------------------
// guard-production-signal.js (advisory only — must never deny)
// ---------------------------------------------------------------------------

test('guard-production-signal: flags a production-boundary command but always allows', () => {
  const { status, json } = runHook('guard-production-signal.js', {
    tool_name: 'Bash',
    tool_input: { command: 'git push origin main' },
  });
  assert.equal(status, 0);
  assert.equal(json?.hookSpecificOutput?.permissionDecision, 'allow');
  assert.match(json?.hookSpecificOutput?.additionalContext ?? '', /Production-sensitive operation/);
  assert.match(json?.hookSpecificOutput?.additionalContext ?? '', /defense-in-depth/);
});

test('guard-production-signal: flags local git tag creation as an early release signal', () => {
  const { status, json } = runHook('guard-production-signal.js', {
    tool_name: 'Bash',
    tool_input: { command: 'git tag v1.2.0' },
  });
  assert.equal(status, 0);
  assert.equal(json?.hookSpecificOutput?.permissionDecision, 'allow');
  assert.match(json?.hookSpecificOutput?.additionalContext ?? '', /Production-sensitive operation/);
});

test('guard-production-signal: does not comment on an unrelated command', () => {
  const { status, json } = runHook('guard-production-signal.js', {
    tool_name: 'Bash',
    tool_input: { command: 'node --test tests/security/*.test.mjs' },
  });
  assert.equal(status, 0);
  assert.equal(json, null);
});

test('guard-production-signal: degrades safely (allow, no crash) on malformed JSON input', () => {
  const { status, json } = runHook('guard-production-signal.js', '{not valid json');
  assert.equal(status, 0);
  assert.equal(json, null);
});

// ---------------------------------------------------------------------------
// session-start.js
// ---------------------------------------------------------------------------

test('session-start: reports repo root, branch, baseline SHA, and dirty-state from cwd', () => {
  const { status, json } = runHook('session-start.js', { cwd: REPO_ROOT, source: 'startup' });
  assert.equal(status, 0);
  const context = json?.hookSpecificOutput?.additionalContext ?? '';
  assert.match(context, /Repo root:/);
  assert.match(context, /Branch:/);
  assert.match(context, /Baseline SHA:/);
  assert.match(context, /Working tree state:/);
});

test('session-start: degrades safely when cwd is not inside a Git repository', () => {
  const { status, json } = runHook('session-start.js', { cwd: path.parse(REPO_ROOT).root, source: 'startup' });
  assert.equal(status, 0);
  assert.match(json?.hookSpecificOutput?.additionalContext ?? '', /could not resolve a Git repository root/);
});

// ---------------------------------------------------------------------------
// session-start.js — handoff summary integration
// (docs/control-plane/handoff-contract.md#codex-sessionstart-integration).
// Writes/removes the real gitignored runtime path
// (tools/control-plane/generated/handoff.json) around each case, since that
// path is fixed by tools/control-plane/handoff.mjs and not parameterizable.
// ---------------------------------------------------------------------------

function withHandoffFile(contents, fn) {
  const preexisting = existsSync(HANDOFF_PATH);
  const previous = preexisting ? readFileSync(HANDOFF_PATH, 'utf8') : null;
  mkdirSync(path.dirname(HANDOFF_PATH), { recursive: true });
  writeFileSync(HANDOFF_PATH, typeof contents === 'string' ? contents : JSON.stringify(contents));
  try {
    fn();
  } finally {
    if (preexisting) writeFileSync(HANDOFF_PATH, previous);
    else rmSync(HANDOFF_PATH, { force: true });
  }
}

const CURRENT_HEAD = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout.trim();

test('session-start: absent handoff file leaves output unchanged (no handoff section)', () => {
  assert.equal(existsSync(HANDOFF_PATH), false, 'precondition: no runtime handoff file should exist in this checkout');
  const { json } = runHook('session-start.js', { cwd: REPO_ROOT, source: 'startup' });
  assert.doesNotMatch(json?.hookSpecificOutput?.additionalContext ?? '', /Handoff record found/);
});

test('session-start: summarizes a present, valid, current handoff record without asserting it is verified fact', () => {
  withHandoffFile({
    schema: { name: 'freeforge-handoff', schemaVersion: 1 },
    objective: 'wire up the handoff contract',
    baselineSha: CURRENT_HEAD,
    worktree: { branch: 'main' },
    intendedScope: [], changedFiles: [],
    verification: [],
    unresolvedFailures: ['flaky test X'],
    openRisks: [], nonGoals: [],
    nextActions: ['run promote once reviewed'],
    productionImpact: false,
    updatedAt: new Date().toISOString(),
  }, () => {
    const { json } = runHook('session-start.js', { cwd: REPO_ROOT, source: 'startup' });
    const ctx = json?.hookSpecificOutput?.additionalContext ?? '';
    assert.match(ctx, /Handoff record found/);
    assert.match(ctx, /Objective: wire up the handoff contract/);
    assert.match(ctx, /Unresolved failures: flaky test X/);
    assert.match(ctx, /Next actions: run promote once reviewed/);
    assert.match(ctx, /not verified fact for this session/);
    assert.doesNotMatch(ctx, /STALE:/);
  });
});

test('session-start: flags a stale handoff record instead of presenting it as current', () => {
  withHandoffFile({
    schema: { name: 'freeforge-handoff', schemaVersion: 1 },
    objective: 'old task',
    baselineSha: '0'.repeat(40),
    worktree: { branch: 'main' },
    intendedScope: [], changedFiles: [], verification: [],
    unresolvedFailures: [], openRisks: [], nonGoals: [], nextActions: [],
    productionImpact: false,
    updatedAt: new Date().toISOString(),
  }, () => {
    const { json } = runHook('session-start.js', { cwd: REPO_ROOT, source: 'startup' });
    const ctx = json?.hookSpecificOutput?.additionalContext ?? '';
    assert.match(ctx, /STALE:/);
  });
});

test('session-start: flags a schema-invalid handoff record as best-effort only', () => {
  withHandoffFile({ schema: { name: 'freeforge-handoff', schemaVersion: 1 }, objective: '' }, () => {
    const { json } = runHook('session-start.js', { cwd: REPO_ROOT, source: 'startup' });
    const ctx = json?.hookSpecificOutput?.additionalContext ?? '';
    assert.match(ctx, /SCHEMA INVALID/);
  });
});

test('session-start: degrades safely (still exits 0, no crash) on unparseable handoff JSON', () => {
  withHandoffFile('{not valid json', () => {
    const { status, json } = runHook('session-start.js', { cwd: REPO_ROOT, source: 'startup' });
    assert.equal(status, 0);
    assert.match(json?.hookSpecificOutput?.additionalContext ?? '', /not valid JSON/);
  });
});

// ---------------------------------------------------------------------------
// record-touched-files.js
// ---------------------------------------------------------------------------

test('record-touched-files: records an apply_patch target as evidence context', () => {
  const patch = [
    '*** Begin Patch',
    '*** Update File: freeforge/src/index.js',
    '*** End Patch',
  ].join('\n');
  const { status, json } = runHook('record-touched-files.js', {
    tool_name: 'apply_patch',
    tool_input: { command: patch },
    tool_response: { success: true },
  });
  assert.equal(status, 0);
  assert.match(json?.hookSpecificOutput?.additionalContext ?? '', /apply_patch/);
  assert.match(json?.hookSpecificOutput?.additionalContext ?? '', /freeforge\/src\/index\.js/);
});

test('record-touched-files: degrades safely (no crash, no output) on malformed JSON input', () => {
  const { status, json } = runHook('record-touched-files.js', '{not valid json');
  assert.equal(status, 0);
  assert.equal(json, null);
});

// ---------------------------------------------------------------------------
// stop-reminder.js
// ---------------------------------------------------------------------------

test('stop-reminder: always emits a non-blocking evidence reminder', () => {
  const { status, json } = runHook('stop-reminder.js', {});
  assert.equal(status, 0);
  assert.match(json?.systemMessage ?? '', /do not claim/i);
});

test('stop-reminder: degrades safely on malformed JSON input', () => {
  const { status, json } = runHook('stop-reminder.js', '{not valid json');
  assert.equal(status, 0);
  assert.match(json?.systemMessage ?? '', /Turn complete/);
});
