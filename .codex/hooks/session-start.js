#!/usr/bin/env node
// SessionStart hook: reports repo root, branch, baseline SHA, clean/dirty
// state, and a production warning, so a session opens with concise,
// evidence-based context instead of assumptions. Advisory only — it never
// blocks a session from starting. See docs/control-plane/hooks-policy-map.md.
//
// Also summarizes an existing runtime handoff record
// (tools/control-plane/generated/handoff.json), if one is present, using the
// exact same validation/staleness logic tools/control-plane/handoff.mjs uses
// for its own `show` command (imported, not re-implemented). This is
// summarization, not trust: a stale or schema-invalid record is reported as
// such, never presented as current fact. See
// docs/control-plane/handoff-contract.md#codex-sessionstart-integration.
'use strict';

const path = require('path');
const { existsSync, readFileSync } = require('fs');
const { readStdinJson, git, resolveRepoRoot } = require('./_shared');

function emit(lines) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: lines.join('\n'),
    },
  }));
}

// Best-effort: appends a handoff summary using the same validation/staleness
// logic tools/control-plane/handoff.mjs enforces elsewhere. Never throws —
// any failure here (missing file, unreadable JSON, import error) degrades to
// "no handoff summary available" rather than blocking session start, per
// this hook's own degrade-safely contract (hooks-policy-map.md).
async function summarizeHandoff(repoRoot) {
  const handoffModulePath = path.join(repoRoot, 'tools', 'control-plane', 'handoff.mjs');
  if (!existsSync(handoffModulePath)) return null;

  let handoffMod;
  try {
    handoffMod = await import(`file://${handoffModulePath.replace(/\\/g, '/')}`);
  } catch {
    return null;
  }
  const { validateHandoff, staleness, DEFAULT_HANDOFF_PATH } = handoffMod;
  if (typeof validateHandoff !== 'function' || typeof staleness !== 'function' || !DEFAULT_HANDOFF_PATH) return null;
  if (!existsSync(DEFAULT_HANDOFF_PATH)) return null;

  let record;
  try {
    record = JSON.parse(readFileSync(DEFAULT_HANDOFF_PATH, 'utf8'));
  } catch (error) {
    return [`Handoff record present at ${DEFAULT_HANDOFF_PATH} but is not valid JSON (${error.message}). Not trusting its contents.`];
  }

  const { ok, errors } = validateHandoff(record);
  const lines = [`Handoff record found: ${DEFAULT_HANDOFF_PATH}`];
  if (!ok) {
    lines.push('SCHEMA INVALID — this summary is best-effort only, do not treat it as trustworthy:');
    for (const e of errors) lines.push(`  - ${e}`);
    return lines;
  }
  const st = staleness(record, repoRoot);
  if (st.checked && st.stale) {
    lines.push(`STALE: recorded baselineSha ${record.baselineSha} does not match current HEAD ${st.currentSha}. Re-verify before acting on its changedFiles/verification claims.`);
  }
  lines.push(`Objective: ${record.objective}`);
  lines.push(`Production impact: ${record.productionImpact ? 'YES' : 'no'}`);
  if (Array.isArray(record.unresolvedFailures) && record.unresolvedFailures.length > 0) {
    lines.push(`Unresolved failures: ${record.unresolvedFailures.join('; ')}`);
  }
  if (Array.isArray(record.nextActions) && record.nextActions.length > 0) {
    lines.push(`Next actions: ${record.nextActions.join('; ')}`);
  }
  lines.push('This is a summary, not verified fact for this session — re-run its verification commands before relying on them.');
  return lines;
}

async function main() {
  let payload = {};
  try {
    payload = await readStdinJson();
  } catch {
    payload = {};
  }

  const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const repoRoot = resolveRepoRoot(cwd);

  if (!repoRoot) {
    emit([
      'SessionStart: could not resolve a Git repository root from the session cwd.',
      'Repo-relative checks (branch, baseline SHA, dirty-state) are unavailable until this session runs inside a Git working tree.',
    ]);
    process.exit(0);
    return;
  }

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot);
  const sha = git(['rev-parse', 'HEAD'], repoRoot);
  const status = git(['status', '--porcelain'], repoRoot);

  const lines = [
    `Repo root: ${repoRoot}`,
    `Branch: ${branch || 'unknown'}`,
    `Baseline SHA: ${sha || 'unknown'}`,
  ];

  if (status === null) {
    lines.push('Working tree state: unknown (`git status` failed).');
  } else if (status.length > 0) {
    lines.push('Working tree state: dirty (uncommitted changes present). Do not assume prior summaries or plans describe the current tree — re-check with `git status`/`git diff`.');
  } else {
    lines.push('Working tree state: clean.');
  }

  if (branch === 'main' || branch === 'master') {
    lines.push(
      'Production warning: this is the production branch. Per docs/control-plane/MIGRATION_CONTRACT.md section 3.8, ' +
      'Netlify auto-deploys on push/merge to this branch with no separate gate — treat commits/pushes here with release-level care.',
    );
  }

  lines.push(
    'Hooks in this session are defense-in-depth only. .codex/rules/default.rules is the authoritative execpolicy layer ' +
    'for command allow/forbid/prompt decisions; see docs/control-plane/hooks-policy-map.md for how these hooks relate to it.',
  );

  let handoffLines = null;
  try {
    handoffLines = await summarizeHandoff(repoRoot);
  } catch {
    handoffLines = null;
  }
  if (handoffLines) lines.push('', ...handoffLines);

  emit(lines);
  process.exit(0);
}

main().catch(() => process.exit(0));
