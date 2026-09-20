// Deterministic fixtures for tools/control-plane/handoff.mjs, the
// runtime-neutral task-handoff/evidence helper documented in
// docs/control-plane/handoff-contract.md. Matches the spawn-and-assert style
// already used in tests/control-plane/verify.test.mjs and
// tests/security/codex-hooks.test.mjs: every case spawns the real script as
// a subprocess against a throwaway file, never imports it directly, so the
// CLI surface itself is what gets exercised.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');
const HANDOFF_SCRIPT = path.join(REPO_ROOT, 'tools', 'control-plane', 'handoff.mjs');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'docs', 'control-plane', 'evidence');

function run(args) {
  const result = spawnSync(process.execPath, [HANDOFF_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.error, undefined, `handoff.mjs failed to spawn: ${result.error}`);
  return result;
}

function withTempFile(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'freeforge-handoff-test-'));
  const file = path.join(dir, 'handoff.json');
  try {
    return fn(file, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

test('init writes a schema-valid record with a real baselineSha/branch from git', () => {
  withTempFile((file) => {
    const init = run(['init', '--out', file, '--objective', 'do the thing']);
    assert.equal(init.status, 0, init.stderr);
    assert.equal(existsSync(file), true);

    const record = readJson(file);
    assert.equal(record.objective, 'do the thing');
    assert.match(record.baselineSha, /^[0-9a-f]{40}$/);
    assert.equal(typeof record.worktree.branch, 'string');
    assert.ok(record.worktree.branch.length > 0);
    assert.deepEqual(record.verification, []);
    assert.equal(record.productionImpact, false);

    const validate = run(['validate', file]);
    assert.equal(validate.status, 0, validate.stdout + validate.stderr);
  });
});

test('init refuses to overwrite an existing file without --force', () => {
  withTempFile((file) => {
    run(['init', '--out', file, '--objective', 'first']);
    const second = run(['init', '--out', file, '--objective', 'second']);
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /already exists/);
  });
});

// ---------------------------------------------------------------------------
// validate — evidence-semantics and schema enforcement
// ---------------------------------------------------------------------------

const VALID_BASE = {
  schema: { name: 'freeforge-handoff', schemaVersion: 1 },
  objective: 'x',
  baselineSha: '0'.repeat(40),
  worktree: { branch: 'main' },
  intendedScope: [],
  changedFiles: [],
  verification: [],
  unresolvedFailures: [],
  openRisks: [],
  nonGoals: [],
  nextActions: [],
  productionImpact: false,
  updatedAt: new Date().toISOString(),
};

test('validate accepts a well-formed record with every evidence state represented', () => {
  withTempFile((file) => {
    const record = {
      ...VALID_BASE,
      verification: [
        { id: 'a', state: 'PASSED', command: 'npm test', result: 'exit 0' },
        { id: 'b', state: 'FAILED', command: 'npm run lint' },
        { id: 'c', state: 'UNAVAILABLE' },
        { id: 'd', state: 'NOT_APPLICABLE', rationale: 'no Python in this change' },
      ],
    };
    writeFileSync(file, JSON.stringify(record));
    const result = run(['validate', file]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /valid/);
  });
});

test('validate rejects PASSED with no command', () => {
  withTempFile((file) => {
    writeFileSync(file, JSON.stringify({ ...VALID_BASE, verification: [{ id: 'a', state: 'PASSED', result: 'exit 0' }] }));
    const result = run(['validate', file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /state PASSED requires a non-empty "command"/);
  });
});

test('validate rejects PASSED with no result', () => {
  withTempFile((file) => {
    writeFileSync(file, JSON.stringify({ ...VALID_BASE, verification: [{ id: 'a', state: 'PASSED', command: 'npm test' }] }));
    const result = run(['validate', file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /state PASSED requires a non-empty "result"/);
  });
});

test('validate rejects FAILED with no command', () => {
  withTempFile((file) => {
    writeFileSync(file, JSON.stringify({ ...VALID_BASE, verification: [{ id: 'a', state: 'FAILED' }] }));
    const result = run(['validate', file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /state FAILED requires a non-empty "command"/);
  });
});

test('validate rejects NOT_APPLICABLE with no rationale', () => {
  withTempFile((file) => {
    writeFileSync(file, JSON.stringify({ ...VALID_BASE, verification: [{ id: 'a', state: 'NOT_APPLICABLE' }] }));
    const result = run(['validate', file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /state NOT_APPLICABLE requires a non-empty "rationale"/);
  });
});

test('validate rejects an unknown verification state (never silently defaults to PASSED)', () => {
  withTempFile((file) => {
    writeFileSync(file, JSON.stringify({ ...VALID_BASE, verification: [{ id: 'a', state: 'MAYBE' }] }));
    const result = run(['validate', file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /must be one of PASSED, FAILED, UNAVAILABLE, NOT_APPLICABLE/);
  });
});

test('validate accepts UNAVAILABLE with no command/result at all', () => {
  withTempFile((file) => {
    writeFileSync(file, JSON.stringify({ ...VALID_BASE, verification: [{ id: 'a', state: 'UNAVAILABLE' }] }));
    const result = run(['validate', file]);
    assert.equal(result.status, 0, result.stdout);
  });
});

test('validate rejects an unknown top-level field', () => {
  withTempFile((file) => {
    writeFileSync(file, JSON.stringify({ ...VALID_BASE, sneaky: true }));
    const result = run(['validate', file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /unknown top-level field: "sneaky"/);
  });
});

test('validate rejects a non-40-hex baselineSha', () => {
  withTempFile((file) => {
    writeFileSync(file, JSON.stringify({ ...VALID_BASE, baselineSha: 'not-a-sha' }));
    const result = run(['validate', file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /baselineSha must be a 40-character lowercase hex/);
  });
});

// ---------------------------------------------------------------------------
// update — atomic write + refuses to write an invalid result
// ---------------------------------------------------------------------------

test('update appends a verification entry and rewrites updatedAt', () => {
  withTempFile((file) => {
    run(['init', '--out', file]);
    const before = readJson(file);
    const result = run(['update', file, '--add-verification', 'id=npm-test,state=PASSED,command=npm test,result=exit 0']);
    assert.equal(result.status, 0, result.stderr);
    const after = readJson(file);
    assert.equal(after.verification.length, 1);
    assert.equal(after.verification[0].id, 'npm-test');
    assert.equal(after.verification[0].state, 'PASSED');
    assert.notEqual(after.updatedAt, before.updatedAt);
  });
});

test('update refuses to write when the resulting record would be invalid, leaving the file unchanged', () => {
  withTempFile((file) => {
    run(['init', '--out', file]);
    const before = readFileSync(file, 'utf8');
    const result = run(['update', file, '--add-verification', 'id=bad,state=PASSED,command=echo hi']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /state PASSED requires a non-empty "result"/);
    assert.equal(readFileSync(file, 'utf8'), before, 'file must be byte-identical after a rejected update');
  });
});

test('update leaves no stray temp file behind after a successful atomic write', () => {
  withTempFile((file, dir) => {
    run(['init', '--out', file]);
    run(['update', file, '--add-next', 'ship it']);
    const entries = readdirSync(dir);
    assert.deepEqual(entries.filter((e) => e.includes('.tmp-')), []);
  });
});

test('update --set writes a nested dotted path', () => {
  withTempFile((file) => {
    run(['init', '--out', file]);
    const result = run(['update', file, '--set', 'worktree.branch=feature/x']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readJson(file).worktree.branch, 'feature/x');
  });
});

test('update --production-impact true/false round-trips as a boolean', () => {
  withTempFile((file) => {
    run(['init', '--out', file]);
    run(['update', file, '--production-impact', 'true']);
    assert.equal(readJson(file).productionImpact, true);
  });
});

// ---------------------------------------------------------------------------
// show — staleness reporting
// ---------------------------------------------------------------------------

test('show reports "Baseline matches current HEAD" for a freshly-init record', () => {
  withTempFile((file) => {
    run(['init', '--out', file]);
    const result = run(['show', file]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Baseline matches current HEAD/);
  });
});

test('show reports STALE for a record whose baselineSha does not match current HEAD', () => {
  withTempFile((file) => {
    writeFileSync(file, JSON.stringify({ ...VALID_BASE, objective: 'stale test' }));
    const result = run(['show', file]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /STALE:/);
  });
});

test('show reports schema-invalid state without crashing, on a best-effort basis', () => {
  withTempFile((file) => {
    writeFileSync(file, JSON.stringify({ ...VALID_BASE, verification: [{ id: 'a', state: 'NOPE' }] }));
    const result = run(['show', file]);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /SCHEMA INVALID/);
  });
});

test('show on a missing file reports nothing to summarize rather than failing', () => {
  withTempFile((file) => {
    const result = run(['show', file]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Nothing to summarize/);
  });
});

// ---------------------------------------------------------------------------
// promote — only ever targets docs/control-plane/evidence/, never stale/invalid
// ---------------------------------------------------------------------------

test('promote refuses a target outside docs/control-plane/evidence/', () => {
  withTempFile((file, dir) => {
    run(['init', '--out', file, '--objective', 'x']);
    const outside = path.join(dir, 'escaped.json');
    const result = run(['promote', file, '--to', outside]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must be a path under/);
    assert.equal(existsSync(outside), false);
  });
});

test('promote refuses a stale record', () => {
  withTempFile((file) => {
    writeFileSync(file, JSON.stringify({ ...VALID_BASE, objective: 'stale promote test' }));
    const target = 'docs/control-plane/evidence/__test-stale.json';
    const result = run(['promote', file, '--to', target]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /refusing to promote a stale record/);
    assert.equal(existsSync(path.join(REPO_ROOT, target)), false);
  });
});

test('promote writes a current, valid record under docs/control-plane/evidence/', () => {
  withTempFile((file) => {
    run(['init', '--out', file, '--objective', 'promote me']);
    const targetRel = 'docs/control-plane/evidence/__test-promoted.json';
    const targetAbs = path.join(REPO_ROOT, targetRel);
    try {
      const result = run(['promote', file, '--to', targetRel]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(existsSync(targetAbs), true);
      assert.equal(readJson(targetAbs).objective, 'promote me');
    } finally {
      rmSync(targetAbs, { force: true });
    }
  });
});

test('promote refuses an invalid source record', () => {
  withTempFile((file) => {
    writeFileSync(file, JSON.stringify({ ...VALID_BASE, baselineSha: 'not-a-sha' }));
    const target = 'docs/control-plane/evidence/__test-invalid.json';
    const result = run(['promote', file, '--to', target]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /refusing to promote an invalid record/);
    assert.equal(existsSync(path.join(REPO_ROOT, target)), false);
  });
});
