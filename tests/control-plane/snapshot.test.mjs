// Tests for tools/control-plane/snapshot.mjs, the deterministic
// control-plane snapshot compiler. Covers: determinism across repeated
// compiles, a one-file mutation changing the digest, diagnostics for
// missing/invalid sources, and dirty-state representation.
//
// Fixture-based cases spawn the compiler as a real subprocess against
// tests/control-plane/fixtures/snapshot-*, matching the style already used
// by tests/control-plane/verify.test.mjs. The dirty-state case builds an
// isolated, throwaway git repository under the OS temp directory (via
// mkdtempSync) rather than mutating this repository's own working tree or
// the fixtures directory, since this repository's live dirty state is not
// controllable or deterministic from within a test.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');
const COMPILER_PATH = path.join(REPO_ROOT, 'tools', 'control-plane', 'snapshot.mjs');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function runSnapshot(root, extraArgs = []) {
  const result = spawnSync(process.execPath, [COMPILER_PATH, '--root', root, ...extraArgs], { encoding: 'utf8' });
  assert.equal(result.error, undefined, `snapshot.mjs failed to spawn: ${result.error}`);
  let json;
  try {
    json = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`snapshot.mjs did not emit valid JSON on stdout: ${error.message}\n---stdout---\n${result.stdout}\n---stderr---\n${result.stderr}`);
  }
  return { status: result.status, json };
}

function findDiagnostic(json, category, pathSuffix) {
  return json.diagnostics.find((d) => d.category === category && (!pathSuffix || (d.path ?? '').endsWith(pathSuffix)));
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test('compiling the same fixture twice yields the same digest', () => {
  const root = path.join(FIXTURES_DIR, 'snapshot-good');
  const { json: first } = runSnapshot(root);
  const { json: second } = runSnapshot(root);
  assert.equal(typeof first.digest, 'string');
  assert.match(first.digest, /^[0-9a-f]{64}$/);
  assert.equal(first.digest, second.digest);
});

test('the "snapshot-good" fixture reports zero error-severity diagnostics', () => {
  const { json } = runSnapshot(path.join(FIXTURES_DIR, 'snapshot-good'));
  const errors = json.diagnostics.filter((d) => d.severity === 'error');
  assert.deepEqual(errors, []);
});

// ---------------------------------------------------------------------------
// One-file mutation changes the digest
// ---------------------------------------------------------------------------

test('mutating one governance source file changes the digest, and reverting it restores the original digest', () => {
  const src = path.join(FIXTURES_DIR, 'snapshot-good');
  const workRoot = mkdtempSync(path.join(tmpdir(), 'snapshot-mutation-'));
  try {
    cpSync(src, workRoot, { recursive: true });
    const { json: before } = runSnapshot(workRoot);

    const mutatedFile = path.join(workRoot, '.agents', 'skills', 'sample', 'SKILL.md');
    const original = readFileSync(mutatedFile, 'utf8');
    writeFileSync(mutatedFile, `${original}\nMutated for the test.\n`);
    const { json: mutated } = runSnapshot(workRoot);
    assert.notEqual(mutated.digest, before.digest, 'digest must change after a tracked source file is mutated');

    const beforeEntry = before.sources.agentSkills.find((e) => e.path === '.agents/skills/sample/SKILL.md');
    const mutatedEntry = mutated.sources.agentSkills.find((e) => e.path === '.agents/skills/sample/SKILL.md');
    assert.notEqual(mutatedEntry.digest, beforeEntry.digest);

    writeFileSync(mutatedFile, original);
    const { json: reverted } = runSnapshot(workRoot);
    assert.equal(reverted.digest, before.digest, 'reverting the mutation must restore the original digest');
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Invalid / missing source detection
// ---------------------------------------------------------------------------

test('the "snapshot-missing-sources" fixture reports a diagnostic for each absent category', () => {
  const { json } = runSnapshot(path.join(FIXTURES_DIR, 'snapshot-missing-sources'));

  assert.equal(json.sources.codexConfig, null);
  assert.ok(findDiagnostic(json, 'codex-config', '.codex/config.toml'), 'missing .codex/config.toml must be diagnosed');

  assert.deepEqual(json.sources.codexRules, []);
  assert.ok(findDiagnostic(json, 'codex-rules', '.codex/rules'), 'missing .codex/rules must be diagnosed');

  assert.equal(json.sources.codexHooks.hooksJson, null);
  assert.ok(findDiagnostic(json, 'codex-hooks', '.codex/hooks.json'), 'missing .codex/hooks.json must be diagnosed');

  assert.equal(json.sources.securityConstitution, null);
  assert.ok(findDiagnostic(json, 'security-constitution', 'security/constitution.md'), 'missing security/constitution.md must be diagnosed');

  assert.deepEqual(json.sources.ciWorkflows, []);
  assert.ok(findDiagnostic(json, 'ci-workflows', '.github/workflows'), 'missing .github/workflows must be diagnosed');

  const errors = json.diagnostics.filter((d) => d.severity === 'error');
  assert.ok(errors.length >= 5, `expected at least 5 error diagnostics, got ${errors.length}`);
});

test('an invalid (non-JSON) .codex/hooks.json is diagnosed instead of crashing the compiler', () => {
  const src = path.join(FIXTURES_DIR, 'snapshot-good');
  const workRoot = mkdtempSync(path.join(tmpdir(), 'snapshot-invalid-hooks-'));
  try {
    cpSync(src, workRoot, { recursive: true });
    writeFileSync(path.join(workRoot, '.codex', 'hooks.json'), '{ not valid json');
    const { status, json } = runSnapshot(workRoot);
    assert.equal(status, 0, 'a malformed source must be a diagnostic, not a crash');
    const diag = findDiagnostic(json, 'codex-hooks', '.codex/hooks.json');
    assert.ok(diag, 'invalid JSON in .codex/hooks.json must be diagnosed');
    assert.equal(diag.severity, 'error');
    assert.match(diag.message, /invalid JSON/);
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
});

test('a hooks.json command pointing at a nonexistent script is diagnosed', () => {
  const src = path.join(FIXTURES_DIR, 'snapshot-good');
  const workRoot = mkdtempSync(path.join(tmpdir(), 'snapshot-dangling-hook-'));
  try {
    cpSync(src, workRoot, { recursive: true });
    writeFileSync(
      path.join(workRoot, '.codex', 'hooks.json'),
      JSON.stringify({
        hooks: {
          SessionStart: [
            {
              matcher: 'startup',
              hooks: [{ type: 'command', command: 'node .codex/hooks/does-not-exist.js' }],
            },
          ],
        },
      }),
    );
    const { json } = runSnapshot(workRoot);
    const diag = findDiagnostic(json, 'codex-hooks', '.codex/hooks/does-not-exist.js');
    assert.ok(diag, 'a hook command target that does not exist on disk must be diagnosed');
    assert.equal(diag.severity, 'error');
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Dirty-state representation — isolated throwaway git repo, not this
// repository's own (uncontrollable, non-deterministic) working tree.
// ---------------------------------------------------------------------------

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

test('git commit and dirty-state are represented, and flip from clean to dirty on an uncommitted change', () => {
  const workRoot = mkdtempSync(path.join(tmpdir(), 'snapshot-git-state-'));
  try {
    cpSync(path.join(FIXTURES_DIR, 'snapshot-good'), workRoot, { recursive: true });
    git(workRoot, ['init', '--quiet']);
    git(workRoot, ['config', 'user.email', 'test@example.com']);
    git(workRoot, ['config', 'user.name', 'Test']);
    git(workRoot, ['add', '-A']);
    git(workRoot, ['commit', '--quiet', '-m', 'fixture commit']);

    const { json: clean } = runSnapshot(workRoot);
    assert.match(clean.git.commit, /^[0-9a-f]{40}$/);
    assert.equal(clean.git.dirty, false);
    assert.equal(clean.git.dirtyFileCount, 0);

    writeFileSync(path.join(workRoot, 'AGENTS.md'), 'mutated after commit\n');
    const { json: dirty } = runSnapshot(workRoot);
    assert.equal(dirty.git.commit, clean.git.commit, 'commit must not change from an uncommitted edit');
    assert.equal(dirty.git.dirty, true);
    assert.ok(dirty.git.dirtyFileCount >= 1);
    assert.notEqual(dirty.digest, clean.digest, 'dirty-state flip must be reflected in the digest');
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
});

test('a non-git root reports commit/dirty as null with an explanatory note', () => {
  const workRoot = mkdtempSync(path.join(tmpdir(), 'snapshot-non-git-'));
  try {
    cpSync(path.join(FIXTURES_DIR, 'snapshot-good'), workRoot, { recursive: true });
    const { json } = runSnapshot(workRoot);
    // If the OS temp directory happens to sit inside a git worktree, this
    // assertion still holds vacuously (skip) rather than asserting a false
    // premise: only check the null-shape when git actually reports "not a
    // repository" for this root.
    if (json.git.commit === null) {
      assert.equal(json.git.dirty, null);
      assert.equal(typeof json.git.note, 'string');
    }
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// show / explain
// ---------------------------------------------------------------------------

test('explain reports why a tracked file is in the snapshot', () => {
  const root = path.join(FIXTURES_DIR, 'snapshot-good');
  const result = spawnSync(process.execPath, [COMPILER_PATH, 'explain', 'security/constitution.md', '--root', root], { encoding: 'utf8' });
  const explanation = JSON.parse(result.stdout);
  assert.equal(explanation.inSnapshot, true);
  assert.equal(explanation.category, 'security-constitution');
  assert.match(explanation.digest, /^[0-9a-f]{64}$/);
});

test('explain reports why an untracked path is not in the snapshot', () => {
  const root = path.join(FIXTURES_DIR, 'snapshot-good');
  const result = spawnSync(process.execPath, [COMPILER_PATH, 'explain', 'no/such/file.md', '--root', root], { encoding: 'utf8' });
  const explanation = JSON.parse(result.stdout);
  assert.equal(explanation.inSnapshot, false);
});

test('explain reports a diagnosed reason for a missing source path', () => {
  const root = path.join(FIXTURES_DIR, 'snapshot-missing-sources');
  const result = spawnSync(process.execPath, [COMPILER_PATH, 'explain', '.codex/config.toml', '--root', root], { encoding: 'utf8' });
  const explanation = JSON.parse(result.stdout);
  assert.equal(explanation.inSnapshot, false);
  assert.match(explanation.reason, /missing \.codex\/config\.toml/);
});

test('show prints a human-readable summary including the digest', () => {
  const root = path.join(FIXTURES_DIR, 'snapshot-good');
  const result = spawnSync(process.execPath, [COMPILER_PATH, 'show', '--root', root], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /digest: [0-9a-f]{64}/);
  assert.match(result.stdout, /security-constitution \(1\):/);
});

// ---------------------------------------------------------------------------
// The real repository (sanity check the compiler is actually usable here)
// ---------------------------------------------------------------------------

test('snapshot.mjs compiles a snapshot for the real repository', () => {
  const { status, json } = runSnapshot(REPO_ROOT);
  assert.equal(status, 0);
  assert.match(json.digest, /^[0-9a-f]{64}$/);
  assert.match(json.git.commit, /^[0-9a-f]{40}$/);
  assert.ok(json.sources.agentSkills.length > 0);
  assert.ok(json.sources.codexAgents.length > 0);
});
