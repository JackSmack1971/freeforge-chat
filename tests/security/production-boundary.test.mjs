// Coverage for docs/control-plane/production-boundary.md and
// .agents/skills/release-readiness/SKILL.md: the production-deployment
// governance layer for FreeForge's current Netlify architecture (see that
// document for the full policy). This file exists to demonstrate, in one
// place, the specific contrast the governance work asked for: normal local
// validation commands are never treated as deploys, while the real
// publication-command families are — via the same advisory hook already
// covered piecemeal in tests/security/codex-hooks.test.mjs.
//
// No `codex` binary is required: the hook is a standalone Node script
// invoked directly, matching the existing pattern in codex-hooks.test.mjs.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');
const HOOK_PATH = path.join(REPO_ROOT, '.codex', 'hooks', 'guard-production-signal.js');
const DOC_PATH = path.join(REPO_ROOT, 'docs', 'control-plane', 'production-boundary.md');
const SKILL_PATH = path.join(REPO_ROOT, '.agents', 'skills', 'release-readiness', 'SKILL.md');

function runHook(command) {
  const result = spawnSync(process.execPath, [HOOK_PATH], {
    cwd: REPO_ROOT,
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
  });
  assert.equal(result.error, undefined, `hook failed to spawn: ${result.error}`);
  let json = null;
  if (result.stdout?.trim()) {
    try {
      json = JSON.parse(result.stdout);
    } catch {
      json = null;
    }
  }
  return { status: result.status, json };
}

function isFlagged({ status, json }) {
  return (
    status === 0 &&
    json?.hookSpecificOutput?.permissionDecision === 'allow' &&
    typeof json?.hookSpecificOutput?.additionalContext === 'string' &&
    /Production-sensitive operation/.test(json.hookSpecificOutput.additionalContext)
  );
}

// ---------------------------------------------------------------------------
// Normal local validation is never treated as a deploy.
// ---------------------------------------------------------------------------

const LOCAL_VALIDATION_COMMANDS = [
  'npm --prefix freeforge test',
  'node --test tests/security/*.test.mjs',
  'npx --yes @biomejs/biome@1.9.4 check freeforge/src tests/security tests/helpers',
  'git status --short --branch',
  'git diff --check',
  'git log --oneline -20',
];

for (const command of LOCAL_VALIDATION_COMMANDS) {
  test(`production signal: local validation command is not flagged: ${command}`, () => {
    const result = runHook(command);
    assert.equal(result.status, 0);
    assert.equal(result.json, null, `expected no advisory comment for "${command}"`);
    assert.ok(!isFlagged(result), `"${command}" must not be flagged as production-sensitive`);
  });
}

// ---------------------------------------------------------------------------
// Publication-command families trigger the expected advisory policy path.
// ---------------------------------------------------------------------------

const PUBLICATION_COMMANDS = [
  { name: 'push to main', command: 'git push origin main' },
  { name: 'PR merge', command: 'gh pr merge 42 --squash' },
  { name: 'tag creation (release precursor)', command: 'git tag v1.0.0' },
  { name: 'GitHub release publication', command: 'gh release create v1.0.0' },
  { name: 'Netlify CLI preview deploy', command: 'netlify deploy' },
  { name: 'Netlify CLI production deploy', command: 'netlify deploy --prod' },
  { name: 'npm package publication', command: 'npm publish' },
];

for (const { name, command } of PUBLICATION_COMMANDS) {
  test(`production signal: ${name} is flagged ("${command}")`, () => {
    const result = runHook(command);
    assert.ok(isFlagged(result), `expected "${command}" to be flagged as production-sensitive`);
  });
}

test('production signal is advisory-only: it never denies, even for the most sensitive command', () => {
  const result = runHook('netlify deploy --prod');
  assert.equal(result.json?.hookSpecificOutput?.permissionDecision, 'allow');
});

// ---------------------------------------------------------------------------
// The governance documents exist and state their own real scope.
// ---------------------------------------------------------------------------

test('docs/control-plane/production-boundary.md exists and covers the required contract elements', () => {
  assert.ok(existsSync(DOC_PATH), 'production-boundary.md must exist');
  const rawText = readFileSync(DOC_PATH, 'utf8');
  // Normalize away hard-wrapped line breaks and Markdown blockquote markers
  // so word-adjacency assertions aren't sensitive to prose reflow.
  const text = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/^>\s?/, ''))
    .join(' ');

  assert.match(text, /publish = "freeforge"/, 'must name the netlify.toml publish directory fact');
  assert.match(text, /no\s+repository\s+build\s+step/i, 'must state the no-build-step fact plainly');

  for (const state of ['Candidate', 'Committed', 'Pushed', 'PR', 'Merged', 'Deployed']) {
    assert.match(text, new RegExp(state), `must define the "${state}" state`);
  }

  assert.match(text, /evidence, not deployment authority/i, 'must state tests/CI are evidence, not deployment authority');
  assert.match(text, /freeforge\/\*\*/, 'must name freeforge/** as production-sensitive scope');
  assert.match(text, /netlify\.toml/, 'must name netlify.toml as production-sensitive scope');
  assert.match(text, /CSP|SRI/i, 'must name the CSP/SRI/CDN dependency surface');
  assert.match(text, /explicit[\s\S]{0,30}operator intent/i, 'must require explicit operator intent to merge to main');
  assert.match(text, /rollback[\s\S]{0,200}exact/i, 'must require rollback to identify the exact prior Git state');
  assert.match(text, /security review/i, 'must require security review for security-sensitive deploys');
  assert.match(text, /control-plane-only/i, 'must address control-plane-only changes needing release-behavior review');
  assert.match(
    text,
    /does not claim hooks can prevent every remote merge path|cannot prevent every remote merge path/i,
    'must explicitly disclaim that hooks cannot prevent every remote merge path',
  );
});

test('.agents/skills/release-readiness/SKILL.md exists, has valid frontmatter, and cross-references the policy doc', () => {
  assert.ok(existsSync(SKILL_PATH), 'release-readiness/SKILL.md must exist');
  const text = readFileSync(SKILL_PATH, 'utf8');

  assert.match(text, /^---\r?\n/, 'must start with YAML frontmatter');
  assert.match(text, /^name:\s*release-readiness\s*$/m, 'frontmatter name must be release-readiness');
  assert.match(text, /^description:\s*\S.+$/m, 'frontmatter description must be non-empty');
  assert.match(text, /production-boundary\.md/, 'must cross-reference the canonical policy document');
  assert.match(text, /cannot prevent every remote merge path|cannot see or stop a merge/i, 'must not overclaim hook/rule enforcement reach');
});

test('production-boundary.md and the release-readiness skill agree on the core fact (no build step, merge = publication)', () => {
  const docText = readFileSync(DOC_PATH, 'utf8');
  const skillText = readFileSync(SKILL_PATH, 'utf8');
  for (const text of [docText, skillText]) {
    assert.match(text, /merg(e|ing)[\s\S]{0,60}main[\s\S]{0,60}production/i);
  }
});
