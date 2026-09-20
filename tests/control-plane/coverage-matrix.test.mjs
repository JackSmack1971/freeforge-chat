// Coverage matrix: proves, by actually running the real suites and reading
// their TAP output, that every scenario in the control-plane conformance
// goal has a corresponding test that exists AND currently passes. This is
// deliberately not a parallel reimplementation of any check — it spawns
// `node --test` against the real files under tests/control-plane/ and
// tests/security/ (the same files the CI workflows run; see
// .github/workflows/control-plane.yml and docs/control-plane/ci.md) and
// asserts each required scenario's exact test title appears as `ok` in the
// TAP stream. If a mapped test is renamed, deleted, or starts failing, this
// file fails loudly instead of silently going stale.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');

// One entry per required scenario from the control-plane conformance goal.
// `file` is the real suite file (never a copy/reimplementation); `title` is
// the exact `test(...)` title string that must appear as a passing ("ok")
// result in that file's own TAP output.
const SCENARIOS = [
  {
    scenario: 'missing SKILL.md',
    file: 'tests/control-plane/verify.test.mjs',
    title: 'malformed fixture "missing-skill-md": a .agents/skills/<name>/ directory with no SKILL.md fails',
  },
  {
    scenario: 'malformed Skill metadata',
    file: 'tests/control-plane/verify.test.mjs',
    title: 'malformed fixture "bad-skill-frontmatter": a SKILL.md with an empty description fails',
  },
  {
    scenario: 'malformed agent TOML',
    file: 'tests/control-plane/verify.test.mjs',
    title: 'malformed fixture "agents-missing-developer-instructions": a standalone agent TOML missing developer_instructions fails',
  },
  {
    scenario: 'duplicate agent identity',
    file: 'tests/control-plane/verify.test.mjs',
    title: 'malformed fixture "agents-duplicate-names": two standalone agent TOML files sharing the same "name" fail',
  },
  {
    scenario: 'writer accidentally configured read-only',
    file: 'tests/control-plane/verify.test.mjs',
    title: 'malformed fixture "writer-configured-read-only": an agent that self-describes as a "writer" but is sandboxed read-only fails',
  },
  {
    scenario: 'reviewer accidentally write-enabled',
    file: 'tests/control-plane/verify.test.mjs',
    title: 'malformed fixture "reviewer-configured-write-enabled": an agent that self-describes as "read-only" but is sandboxed workspace-write fails',
  },
  {
    scenario: 'broken hook target',
    file: 'tests/control-plane/verify.test.mjs',
    title: 'malformed fixture "missing-hook-target": a hooks.json command pointing at a nonexistent script fails',
  },
  {
    scenario: 'malformed hook input',
    file: 'tests/security/codex-hooks.test.mjs',
    title: 'guard-protected-writes: fails closed (deny) on malformed JSON input',
  },
  {
    scenario: 'dangerous command denial',
    file: 'tests/security/codex-execpolicy-rules.test.mjs',
    title: 'destructive rm -rf is forbidden',
  },
  {
    scenario: 'force-push variants',
    file: 'tests/security/codex-execpolicy-rules.test.mjs',
    title: 'force push (--force/-f/--force-with-lease) is forbidden',
  },
  {
    scenario: 'normal safe Git inspection',
    file: 'tests/security/codex-execpolicy-rules.test.mjs',
    title: 'git status is a safe, allowed inspection command',
  },
  {
    scenario: 'control-plane protected-file write',
    file: 'tests/security/codex-hooks.test.mjs',
    title: 'guard-protected-writes: blocks a Bash write into .git/',
  },
  {
    scenario: 'stale Claude SDK reference under .codex',
    file: 'tests/control-plane/verify.test.mjs',
    title: 'malformed fixture "claude-sdk-under-codex": a Claude Agent SDK import under .codex/** fails',
  },
  {
    scenario: 'stale desktop/Tauri project text',
    file: 'tests/control-plane/verify.test.mjs',
    title: 'malformed fixture "stale-identifier-under-codex": a stale "desktop-ai-client" identifier under .codex/** fails',
  },
  {
    scenario: 'instruction reference to missing files',
    file: 'tests/control-plane/verify.test.mjs',
    title: 'malformed fixture "dangling-reference": AGENTS.md referencing a nonexistent local file fails',
  },
  {
    scenario: 'snapshot determinism',
    file: 'tests/control-plane/snapshot.test.mjs',
    title: 'compiling the same fixture twice yields the same digest',
  },
  {
    scenario: 'snapshot change after source mutation',
    file: 'tests/control-plane/snapshot.test.mjs',
    title: 'mutating one governance source file changes the digest, and reverting it restores the original digest',
  },
  {
    scenario: 'unrelated dirty-state preservation',
    file: 'tests/control-plane/policy-invariants.test.mjs',
    title: 'running snapshot.mjs and handoff.mjs does not touch unrelated dirty/untracked work already present in the repo',
  },
  {
    scenario: 'missing verification reported UNAVAILABLE rather than PASS',
    file: 'tests/control-plane/handoff.test.mjs',
    title: 'validate accepts UNAVAILABLE with no command/result at all',
  },
  {
    scenario: 'production-sensitive vs non-production command classification (non-production)',
    file: 'tests/security/production-boundary.test.mjs',
    title: 'production signal: local validation command is not flagged: npm --prefix freeforge test',
  },
  {
    scenario: 'production-sensitive vs non-production command classification (production-sensitive)',
    file: 'tests/security/production-boundary.test.mjs',
    title: 'production signal: push to main is flagged ("git push origin main")',
  },
  // Cross-cutting invariants explicitly called out in addition to the 19
  // fixture/behavior scenarios above.
  {
    scenario: 'policy monotonicity (Skill cannot authorize a forbidden command)',
    file: 'tests/control-plane/policy-invariants.test.mjs',
    title: 'monotonicity: adding a Skill that textually claims to authorize a forbidden command does not change verify.mjs or the underlying rules decision',
  },
  {
    scenario: 'policy monotonicity (appended permissive rule cannot downgrade a forbidden decision)',
    file: 'tests/control-plane/policy-invariants.test.mjs',
    title: 'monotonicity: appending a spurious "allow" rule for an already-forbidden command cannot loosen the effective decision',
  },
  {
    scenario: 'identity: display name must not substitute for canonical identity',
    file: 'tests/control-plane/verify.test.mjs',
    title: '"identity-good" fixture: two agents sharing the same display description but distinct canonical names are not flagged as duplicates',
  },
];

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function runFileAsTap(relFile) {
  // NODE_TEST_CONTEXT is set by node:test on every process it runs a test
  // file in; if inherited, a nested `node --test` invocation refuses to run
  // at all ("run() is being called recursively within a test file") and
  // silently emits no output. This file's own tests spawn a *separate*,
  // independent `node --test` run over each real suite file specifically to
  // read its TAP output as evidence — that is not the same thing as this
  // process's own test run recursing into itself, so the env var must be
  // stripped for the child.
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', relFile], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: childEnv,
  });
  assert.equal(result.error, undefined, `failed to spawn node --test for ${relFile}: ${result.error}`);
  return result.stdout;
}

// Run each real suite file exactly once (not once per scenario) and cache
// its TAP output for every scenario mapped to it.
const uniqueFiles = [...new Set(SCENARIOS.map((s) => s.file))];
const tapOutputByFile = new Map();
for (const file of uniqueFiles) {
  tapOutputByFile.set(file, runFileAsTap(file));
}

for (const { scenario, file, title } of SCENARIOS) {
  test(`coverage: "${scenario}" has a currently-passing test in ${file}`, () => {
    const tap = tapOutputByFile.get(file);
    assert.ok(tap, `no TAP output captured for ${file}`);
    const okPattern = new RegExp(`^ok \\d+ - ${escapeRegExp(title)}$`, 'm');
    const failPattern = new RegExp(`^not ok \\d+ - ${escapeRegExp(title)}$`, 'm');
    assert.ok(
      !failPattern.test(tap),
      `expected test "${title}" in ${file} to pass for scenario "${scenario}", but it failed`,
    );
    assert.ok(
      okPattern.test(tap),
      `expected to find a passing ("ok") test titled exactly "${title}" in ${file}'s TAP output for scenario "${scenario}"; the test may have been renamed, removed, or never existed`,
    );
  });
}

test('every scenario in the control-plane conformance goal maps to at least one real test', () => {
  const requiredScenarioSubstrings = [
    'missing SKILL.md',
    'malformed Skill metadata',
    'malformed agent TOML',
    'duplicate agent identity',
    'writer accidentally configured read-only',
    'reviewer accidentally write-enabled',
    'broken hook target',
    'malformed hook input',
    'dangerous command denial',
    'force-push variants',
    'normal safe Git inspection',
    'control-plane protected-file write',
    'stale Claude SDK reference',
    'stale desktop/Tauri',
    'instruction reference to missing files',
    'snapshot determinism',
    'snapshot change after source mutation',
    'unrelated dirty-state preservation',
    'missing verification reported UNAVAILABLE',
    'production-sensitive vs non-production',
  ];
  for (const substring of requiredScenarioSubstrings) {
    assert.ok(
      SCENARIOS.some((s) => s.scenario.includes(substring)),
      `no coverage-matrix entry found for required scenario: "${substring}"`,
    );
  }
});
