// Deterministic fixtures for tools/control-plane/verify.mjs, the
// authoritative cross-runtime control-plane verifier (see
// docs/control-plane/MIGRATION_CONTRACT.md). Each test spawns the verifier
// as a real subprocess against a fixture root under
// tests/control-plane/fixtures/** and asserts on its JSON output and exit
// code — matching the spawn-and-assert style already used in
// tests/security/codex-hooks.test.mjs.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');
const VERIFIER_PATH = path.join(REPO_ROOT, 'tools', 'control-plane', 'verify.mjs');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function runVerifier(fixtureRoot) {
  const result = spawnSync(process.execPath, [VERIFIER_PATH, '--root', fixtureRoot, '--json'], {
    encoding: 'utf8',
  });
  assert.equal(result.error, undefined, `verifier failed to spawn: ${result.error}`);
  let json;
  try {
    json = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`verifier did not emit valid JSON on stdout: ${error.message}\n---stdout---\n${result.stdout}\n---stderr---\n${result.stderr}`);
  }
  return { status: result.status, json };
}

function findCheck(json, id) {
  return json.checks.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// The real repository (sanity check the verifier is actually usable here)
// ---------------------------------------------------------------------------

test('verify.mjs reports the real repository as passing (exit 0, ok: true)', () => {
  const { status, json } = runVerifier(REPO_ROOT);
  assert.equal(json.ok, true, `unexpected authoritative failures: ${JSON.stringify(json.checks.filter((c) => c.authoritative && c.status === 'FAIL'), null, 2)}`);
  assert.equal(status, 0);
  assert.equal(typeof json.sourceCommit, 'string');
  assert.match(json.sourceCommit, /^[0-9a-f]{40}$/);
});

// ---------------------------------------------------------------------------
// Good fixture
// ---------------------------------------------------------------------------

test('the "good" fixture passes every authoritative check', () => {
  const { status, json } = runVerifier(path.join(FIXTURES_DIR, 'good'));
  const authoritativeFailures = json.checks.filter((c) => c.authoritative && c.status === 'FAIL');
  assert.deepEqual(authoritativeFailures, []);
  assert.equal(json.ok, true);
  assert.equal(status, 0);
});

// ---------------------------------------------------------------------------
// Malformed fixtures — each must fail exactly (at least) the check it targets
// and exit non-zero.
// ---------------------------------------------------------------------------

const MALFORMED_CASES = [
  {
    dir: 'bad-toml',
    checkId: 'codex-config:parses',
    description: 'a syntactically invalid .codex/config.toml fails TOML parsing',
  },
  {
    dir: 'missing-hook-target',
    checkId: 'codex-hooks-json:target:.codex/hooks/does-not-exist.js',
    description: 'a hooks.json command pointing at a nonexistent script fails',
  },
  {
    dir: 'bad-skill-frontmatter',
    checkId: 'agents-skills:sample',
    description: 'a SKILL.md with an empty description fails',
  },
  {
    dir: 'no-rules-dir',
    checkId: 'codex-rules:exist',
    description: 'a missing .codex/rules directory fails',
  },
  {
    dir: 'claude-sdk-under-codex',
    checkId: 'no-claude-sdk-under-codex',
    description: 'a Claude Agent SDK import under .codex/** fails',
  },
  {
    dir: 'stale-identifier-under-codex',
    checkId: 'no-stale-identifiers-under-codex',
    description: 'a stale "desktop-ai-client" identifier under .codex/** fails',
  },
  {
    dir: 'missing-required-agents-md',
    checkId: 'agents-md:tests/AGENTS.md',
    description: 'a missing required tests/AGENTS.md fails',
  },
  {
    dir: 'dangling-reference',
    checkId: 'referenced-files:AGENTS.md:docs/does-not-exist.md',
    description: 'AGENTS.md referencing a nonexistent local file fails',
  },
  {
    dir: 'missing-commit-sha',
    checkId: 'evidence:identifies-commit:docs/control-plane/CURRENT_STATE.md',
    description: 'a generated evidence doc with no commit SHA fails',
  },
  {
    dir: 'ignored-required-file',
    checkId: 'control-plane-not-ignored:AGENTS.md',
    description: 'a required control-plane file hidden by .gitignore fails',
  },
  {
    dir: 'agents-missing-developer-instructions',
    checkId: 'codex-agents-toml:.codex/agents/gamma.toml',
    description: 'a standalone agent TOML missing developer_instructions fails',
  },
  {
    dir: 'agents-duplicate-names',
    checkId: 'codex-agents-toml:unique-names',
    description: 'two standalone agent TOML files sharing the same "name" fail',
  },
  {
    dir: 'agents-invalid-sandbox-mode',
    checkId: 'codex-agents-toml:.codex/agents/epsilon.toml:sandbox-mode',
    description: 'a standalone agent TOML with an out-of-enum sandbox_mode fails',
  },
  {
    dir: 'missing-skill-md',
    checkId: 'agents-skills:orphan',
    description: 'a .agents/skills/<name>/ directory with no SKILL.md fails',
  },
  {
    dir: 'writer-configured-read-only',
    checkId: 'codex-agents-toml:.codex/agents/gamma.toml:role-sandbox-consistency',
    description: 'an agent that self-describes as a "writer" but is sandboxed read-only fails',
  },
  {
    dir: 'reviewer-configured-write-enabled',
    checkId: 'codex-agents-toml:.codex/agents/delta.toml:role-sandbox-consistency',
    description: 'an agent that self-describes as "read-only" but is sandboxed workspace-write fails',
  },
];

for (const { dir, checkId, description } of MALFORMED_CASES) {
  test(`malformed fixture "${dir}": ${description}`, () => {
    const { status, json } = runVerifier(path.join(FIXTURES_DIR, 'malformed', dir));
    const check = findCheck(json, checkId);
    assert.ok(check, `expected a check with id "${checkId}" in verifier output`);
    assert.equal(check.status, 'FAIL');
    assert.equal(check.authoritative, true, 'this check must be authoritative (able to fail the build)');
    assert.equal(json.ok, false);
    assert.notEqual(status, 0);
  });
}

// ---------------------------------------------------------------------------
// SKIPPED vs. PASS must never be conflated
// ---------------------------------------------------------------------------

test('missing optional directories (.codex/agents) are reported SKIPPED, not PASS', () => {
  const { json } = runVerifier(path.join(FIXTURES_DIR, 'good'));
  const check = findCheck(json, 'codex-agents-toml');
  assert.ok(check);
  assert.equal(check.status, 'SKIPPED');
});

test('the Claude compatibility check never affects the authoritative outcome', () => {
  const { json } = runVerifier(path.join(FIXTURES_DIR, 'good'));
  const check = findCheck(json, 'claude-compat');
  assert.ok(check);
  assert.equal(check.authoritative, false);
});

// ---------------------------------------------------------------------------
// .codex/agents/*.toml — standalone agent definitions (required fields,
// sandbox_mode enum validity, unique names). See docs/control-plane and the
// FreeForge-specific agents this repository ships under .codex/agents/.
// ---------------------------------------------------------------------------

test('"agents-good" fixture: valid standalone agent TOML files all pass', () => {
  const { status, json } = runVerifier(path.join(FIXTURES_DIR, 'agents-good'));
  const authoritativeFailures = json.checks.filter((c) => c.authoritative && c.status === 'FAIL');
  assert.deepEqual(authoritativeFailures, []);
  assert.equal(json.ok, true);
  assert.equal(status, 0);

  for (const rel of ['.codex/agents/alpha.toml', '.codex/agents/beta.toml']) {
    assert.equal(findCheck(json, `codex-agents-toml:${rel}`)?.status, 'PASS', `${rel} required-field check should pass`);
    assert.equal(findCheck(json, `codex-agents-toml:${rel}:sandbox-mode`)?.status, 'PASS', `${rel} sandbox_mode check should pass`);
  }
  assert.equal(findCheck(json, 'codex-agents-toml:unique-names')?.status, 'PASS');
  assert.equal(findCheck(json, 'codex-agents-toml')?.status, 'PASS');
});

test('the real repository: the three FreeForge read-only review agents are read-only, complete, and uniquely named', () => {
  const { json } = runVerifier(REPO_ROOT);

  const AGENT_FILES = ['code_explorer.toml', 'reviewer.toml', 'security_reviewer.toml'];
  for (const file of AGENT_FILES) {
    const rel = `.codex/agents/${file}`;
    assert.equal(
      findCheck(json, `codex-agents-toml:${rel}`)?.status,
      'PASS',
      `${rel} should have all required fields (name, description, developer_instructions)`,
    );
    assert.equal(findCheck(json, `codex-agents-toml:${rel}:sandbox-mode`)?.status, 'PASS', `${rel} sandbox_mode should be a valid enum value`);

    const text = readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.match(text, /sandbox_mode\s*=\s*"read-only"/, `${rel} must explicitly declare sandbox_mode = "read-only"`);
  }

  assert.equal(findCheck(json, 'codex-agents-toml:unique-names')?.status, 'PASS', 'agent names must be unique across .codex/agents/*.toml');
  assert.equal(findCheck(json, 'codex-agents-toml')?.status, 'PASS');
  assert.equal(
    findCheck(json, 'no-stale-identifiers-under-codex')?.status,
    'PASS',
    'the new agent files must not carry stale desktop/Tauri-only identifiers',
  );
});

// ---------------------------------------------------------------------------
// Identity: canonical `name`, not the human-readable `description` (display
// text), is what determines agent identity/uniqueness. Two agents sharing a
// display label must never be conflated with — or excused from — the
// duplicate-name check that targets canonical identity.
// ---------------------------------------------------------------------------

test('"identity-good" fixture: two agents sharing the same display description but distinct canonical names are not flagged as duplicates', () => {
  const { status, json } = runVerifier(path.join(FIXTURES_DIR, 'identity-good'));
  const authoritativeFailures = json.checks.filter((c) => c.authoritative && c.status === 'FAIL');
  assert.deepEqual(authoritativeFailures, []);
  assert.equal(json.ok, true);
  assert.equal(status, 0);

  const alpha = readFileSync(path.join(FIXTURES_DIR, 'identity-good', '.codex/agents/alpha.toml'), 'utf8');
  const beta = readFileSync(path.join(FIXTURES_DIR, 'identity-good', '.codex/agents/beta.toml'), 'utf8');
  assert.match(alpha, /description\s*=\s*"Repository Reviewer"/);
  assert.match(beta, /description\s*=\s*"Repository Reviewer"/);
  assert.notEqual(alpha.match(/^name\s*=\s*"([^"]+)"/m)?.[1], beta.match(/^name\s*=\s*"([^"]+)"/m)?.[1]);

  assert.equal(findCheck(json, 'codex-agents-toml:unique-names')?.status, 'PASS', 'a shared display description must not trigger the canonical-identity duplicate check');
});

test('"agents-duplicate-names" fixture: the reverse case — same canonical name, different descriptions — is still caught', () => {
  const { json } = runVerifier(path.join(FIXTURES_DIR, 'malformed', 'agents-duplicate-names'));
  const check = findCheck(json, 'codex-agents-toml:unique-names');
  assert.equal(check.status, 'FAIL', 'canonical name collision must be caught even when display descriptions differ');
});

// ---------------------------------------------------------------------------
// implementation_owner / verifier — execution-oriented agents. Conformance
// checks for role identity (distinct name/description matching the intended
// role), sandbox authority (least-authority per role, with the
// implementation_owner's write grant justified and the verifier's read-only
// grant confirmed), and instruction content (each role's non-negotiable
// behaviors are actually present in developer_instructions).
// ---------------------------------------------------------------------------

test('the real repository: implementation_owner.toml and verifier.toml pass required-field and sandbox-mode checks', () => {
  const { json } = runVerifier(REPO_ROOT);

  for (const file of ['implementation_owner.toml', 'verifier.toml']) {
    const rel = `.codex/agents/${file}`;
    assert.equal(
      findCheck(json, `codex-agents-toml:${rel}`)?.status,
      'PASS',
      `${rel} should have all required fields (name, description, developer_instructions)`,
    );
    assert.equal(findCheck(json, `codex-agents-toml:${rel}:sandbox-mode`)?.status, 'PASS', `${rel} sandbox_mode should be a valid enum value`);
  }

  assert.equal(
    findCheck(json, 'codex-agents-toml:unique-names')?.status,
    'PASS',
    'implementation_owner/verifier names must be unique alongside the existing read-only agents',
  );
  assert.equal(
    findCheck(json, 'no-stale-identifiers-under-codex')?.status,
    'PASS',
    'the new agent files must not carry stale desktop/Tauri-only identifiers',
  );
  assert.equal(
    findCheck(json, 'no-claude-sdk-under-codex')?.status,
    'PASS',
    'the new agent files must not import the Claude Agent SDK under .codex/**',
  );
});

test('role identity: implementation_owner and verifier declare distinct, role-matching name/description', () => {
  const ownerToml = readFileSync(path.join(REPO_ROOT, '.codex/agents/implementation_owner.toml'), 'utf8');
  const verifierToml = readFileSync(path.join(REPO_ROOT, '.codex/agents/verifier.toml'), 'utf8');

  assert.match(ownerToml, /^name\s*=\s*"implementation_owner"/m);
  assert.match(ownerToml, /description\s*=\s*".*[Ii]mplementation.*writer.*"/, 'implementation_owner description must identify it as the writer role');

  assert.match(verifierToml, /^name\s*=\s*"verifier"/m);
  assert.match(verifierToml, /description\s*=\s*".*verif.*"/i, 'verifier description must identify it as the verification role');
});

test('sandbox authority: implementation_owner is workspace-write (justified) and verifier is read-only (least authority)', () => {
  const ownerToml = readFileSync(path.join(REPO_ROOT, '.codex/agents/implementation_owner.toml'), 'utf8');
  const verifierToml = readFileSync(path.join(REPO_ROOT, '.codex/agents/verifier.toml'), 'utf8');

  assert.match(ownerToml, /sandbox_mode\s*=\s*"workspace-write"/, 'implementation_owner must declare workspace-write (it is the single writer role)');
  assert.doesNotMatch(ownerToml, /sandbox_mode\s*=\s*"danger-full-access"/, 'implementation_owner must not claim danger-full-access');
  // The write grant must be justified in-file, not silently assumed.
  assert.match(ownerToml, /#.*sandbox_mode\s*=\s*"workspace-write":/i, 'implementation_owner must document why it needs workspace-write');

  assert.match(verifierToml, /sandbox_mode\s*=\s*"read-only"/, 'verifier must default to read-only per least-authority');
  assert.doesNotMatch(verifierToml, /sandbox_mode\s*=\s*"workspace-write"/, 'verifier must not claim workspace-write without documented cache/output need');
  assert.doesNotMatch(verifierToml, /sandbox_mode\s*=\s*"danger-full-access"/, 'verifier must not claim danger-full-access');
  // The read-only choice must be justified in-file (why no write access is needed).
  assert.match(verifierToml, /#.*sandbox_mode\s*=\s*"read-only":/i, 'verifier must document why read-only suffices');
});

test('instruction content: implementation_owner instructions carry its non-negotiable behaviors', () => {
  const ownerToml = readFileSync(path.join(REPO_ROOT, '.codex/agents/implementation_owner.toml'), 'utf8');

  assert.match(ownerToml, /single writer/i);
  assert.match(ownerToml, /smallest coherent change/i);
  assert.match(ownerToml, /preserve unrelated dirty state|preserve unrelated/i);
  assert.match(ownerToml, /AGENTS\.md/);
  assert.match(ownerToml, /behavioral tests|tests\/security/i);
  assert.match(ownerToml, /never.*commit|do not.*commit/is);
  assert.match(ownerToml, /push|merge|deploy/i);
  assert.match(ownerToml, /explicitly.*authoriz/is);
  assert.match(ownerToml, /changed paths/i);
  assert.match(ownerToml, /rationale/i);
  assert.match(ownerToml, /validation evidence/i);
  // Must not recursively spawn agents without a concrete workflow requiring it.
  assert.match(ownerToml, /do not spawn other agents|you do not spawn other agents/i);
});

test('instruction content: verifier instructions carry its non-negotiable behaviors', () => {
  const verifierToml = readFileSync(path.join(REPO_ROOT, '.codex/agents/verifier.toml'), 'utf8');

  assert.match(verifierToml, /independently verif/i);
  assert.match(verifierToml, /authoritative/i);
  assert.match(verifierToml, /git diff|git status/i);
  assert.match(verifierToml, /must not silently repair|not.*silently repair/i);
  assert.match(verifierToml, /PASS.*FAIL.*BLOCKED.*UNAVAILABLE/s);
  assert.match(verifierToml, /tested Git\/worktree state|commit SHA|rev-parse HEAD/i);
  assert.match(verifierToml, /production-surface|production boundary|netlify\.toml/i);
  assert.match(verifierToml, /do not.*commit|not.*commit.*push/is);
  // Must not recursively spawn agents.
  assert.match(verifierToml, /do not spawn other agents|does not spawn other agents/i);
});
