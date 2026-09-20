#!/usr/bin/env node
// .agents/skills/control-plane-validation/scripts/run-checks.mjs
//
// Deterministic evidence collector for the control-plane-validation skill.
// It performs steps 1, 2, 4, 6, and 7 of SKILL.md's workflow in one
// read-only pass and prints a single JSON evidence object matching
// references/evidence-schema.md. It does NOT perform step 3 (checking
// current official Codex docs) or step 5 (git diff --check review scored
// against schema) — those need judgment / network access respectively and
// stay with the invoking agent.
//
// Zero third-party dependencies, zero network access, read-only: it never
// writes, stages, commits, or mutates repository or Git state.
//
// Usage:
//   node .agents/skills/control-plane-validation/scripts/run-checks.mjs [--root <path>] [--json]
//
// Exit code: non-zero iff an authoritative check fails (see "authoritative"
// in the JSON output) — mirrors tools/control-plane/verify.mjs's contract.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { root: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') args.root = argv[++i];
    else if (arg === '--json') args.json = true;
  }
  return args;
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error ?? null };
}

function resolveRoot(explicitRoot) {
  if (explicitRoot) return path.resolve(explicitRoot);
  const probe = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: __dirname, encoding: 'utf8' });
  if (!probe.error && probe.status === 0 && probe.stdout.trim()) {
    return path.resolve(probe.stdout.trim());
  }
  // Fallback: this file lives at <root>/.agents/skills/control-plane-validation/scripts/.
  return path.resolve(__dirname, '..', '..', '..', '..');
}

// ---------------------------------------------------------------------------
// Step 1: Git baseline
// ---------------------------------------------------------------------------

function gitBaseline(root) {
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const head = git(root, ['rev-parse', 'HEAD']);
  const isRepo = git(root, ['rev-parse', '--is-inside-work-tree']);
  const porcelain = git(root, ['status', '--porcelain=v1']);

  const clean = isRepo.status === 0 && porcelain.status === 0 && porcelain.stdout.trim() === '';

  return {
    isGitRepo: isRepo.status === 0 && isRepo.stdout.trim() === 'true',
    branch: branch.status === 0 ? branch.stdout.trim() : null,
    headSha: head.status === 0 ? head.stdout.trim() : null,
    dirty: !clean,
    rawStatusLineCount: porcelain.status === 0 ? porcelain.stdout.split(/\r?\n/).filter(Boolean).length : null,
  };
}

// ---------------------------------------------------------------------------
// Step 2: Owning-plane classification for every changed path.
// Kept in sync by hand with references/topology.md's prose table — this is
// the executable source of truth; topology.md explains the *why*.
// ---------------------------------------------------------------------------

const PLANE_RULES = [
  { plane: 'behavioral-policy', pattern: /^(AGENTS\.md|tests\/AGENTS\.md|\.agents\/AGENTS\.md)$/ },
  { plane: 'skills', pattern: /^\.agents\/skills\// },
  { plane: 'codex-runtime', pattern: /^\.codex\/(config\.toml|hooks\.json|rules\/|agents\/|hooks\/|workflows\/|skills\/)/ },
  { plane: 'legacy-claude-runtime', pattern: /^\.claude\// },
  { plane: 'ci-governance', pattern: /^\.github\/workflows\// },
  { plane: 'security-invariants', pattern: /^security\/constitution\.md$/ },
  { plane: 'control-plane-evidence', pattern: /^docs\/control-plane\// },
  { plane: 'production-publication', pattern: /^netlify\.toml$/ },
  { plane: 'control-plane-tooling', pattern: /^tools\/control-plane\// },
];

function classifyPlane(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  for (const { plane, pattern } of PLANE_RULES) {
    if (pattern.test(normalized)) return plane;
  }
  return null; // not a control-plane path; out of this skill's scope
}

function changedFiles(root) {
  // Union of staged, unstaged, and untracked changes — each with its Git
  // status code — via a single porcelain call (authoritative per
  // AGENTS.md's "git diff is authoritative" invariant; no cached summaries).
  const result = git(root, ['status', '--porcelain=v1']);
  if (result.status !== 0) return [];
  const files = [];
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line) continue;
    const code = line.slice(0, 2);
    const rel = line.slice(3).trim();
    // Renames show as "old -> new"; keep the destination path.
    const arrow = rel.indexOf(' -> ');
    const finalRel = arrow === -1 ? rel : rel.slice(arrow + 4);
    files.push({ path: finalRel, statusCode: code.trim() });
  }
  return files;
}

function classifyChangedFiles(root) {
  const files = changedFiles(root);
  const inScope = [];
  const outOfScope = [];
  for (const file of files) {
    const plane = classifyPlane(file.path);
    if (plane) inScope.push({ ...file, plane });
    else outOfScope.push(file);
  }
  const byPlane = {};
  for (const entry of inScope) {
    byPlane[entry.plane] ||= [];
    byPlane[entry.plane].push({ path: entry.path, statusCode: entry.statusCode });
  }
  return { inScope, outOfScopeCount: outOfScope.length, byPlane };
}

// ---------------------------------------------------------------------------
// Step 4: run tools/control-plane/verify.mjs (imported, not re-implemented)
// ---------------------------------------------------------------------------

async function runControlPlaneVerifier(root) {
  const verifyPath = path.join(root, 'tools', 'control-plane', 'verify.mjs');
  try {
    const mod = await import(pathToFileURL(verifyPath).href);
    if (typeof mod.runVerification !== 'function') {
      return { ran: false, reason: `tools/control-plane/verify.mjs does not export runVerification()` };
    }
    const result = mod.runVerification(root);
    return { ran: true, result };
  } catch (error) {
    return { ran: false, reason: `failed to load/run tools/control-plane/verify.mjs: ${error.message}` };
  }
}

// ---------------------------------------------------------------------------
// Step 6: git diff --check (working tree + staged), scanned for real
// conflict markers vs. cosmetic whitespace findings.
// ---------------------------------------------------------------------------

const CONFLICT_MARKER_PATTERN = /^[<>=]{7}(?:[<>=]| |$)/m;

function diffCheck(root) {
  const unstaged = git(root, ['diff', '--check']);
  const staged = git(root, ['diff', '--cached', '--check']);
  const combinedOutput = [unstaged.stdout, staged.stdout].filter(Boolean).join('\n');
  const hasConflictMarkers = CONFLICT_MARKER_PATTERN.test(combinedOutput);
  return {
    unstagedExit: unstaged.status,
    stagedExit: staged.status,
    output: combinedOutput || null,
    hasConflictMarkers,
    // git diff --check exits non-zero for trailing whitespace too, which is
    // cosmetic, not a blocker. Only real conflict markers are authoritative.
    authoritativeFailure: hasConflictMarkers,
  };
}

// ---------------------------------------------------------------------------
// Step 5: syntax check every changed control-plane-scoped JS/MJS file.
// This is NOT a substitute for running a changed script's own unit tests
// (SKILL.md step 5 tells the agent to do that separately); it only proves
// the file parses.
// ---------------------------------------------------------------------------

function syntaxCheckChangedScripts(root, inScopeFiles) {
  const candidates = inScopeFiles.filter((f) => /\.(mjs|cjs|js)$/i.test(f.path) && f.statusCode !== 'D');
  const results = [];
  for (const file of candidates) {
    const abs = path.join(root, file.path);
    const check = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
    results.push({
      path: file.path,
      ok: check.status === 0,
      detail: check.status === 0 ? null : (check.stderr || '').trim(),
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function collectEvidence(root) {
  const baseline = gitBaseline(root);
  const scope = classifyChangedFiles(root);
  const verifier = await runControlPlaneVerifier(root);
  const diff = diffCheck(root);
  const syntax = syntaxCheckChangedScripts(root, scope.inScope);

  const syntaxFailures = syntax.filter((s) => !s.ok);
  const verifierFailed = verifier.ran ? !verifier.result.ok : true;

  const ok = !verifierFailed && !diff.authoritativeFailure && syntaxFailures.length === 0;

  return {
    tool: '.agents/skills/control-plane-validation/scripts/run-checks.mjs',
    root,
    gitBaseline: baseline,
    diffScope: scope,
    controlPlaneVerifier: verifier,
    diffCheck: diff,
    syntaxCheck: { checked: syntax.length, failures: syntaxFailures.length, results: syntax },
    ok,
  };
}

function printHumanSummary(evidence) {
  const lines = [];
  lines.push(`Control-plane validation evidence — HEAD ${evidence.gitBaseline.headSha ?? '(unknown)'} on ${evidence.gitBaseline.branch ?? '(unknown branch)'}`);
  lines.push(`root: ${evidence.root}`);
  lines.push(`working tree: ${evidence.gitBaseline.dirty ? 'DIRTY' : 'clean'} (${evidence.gitBaseline.rawStatusLineCount ?? '?'} changed path(s))`);
  lines.push('');
  lines.push('Diff scope by owning plane:');
  const planes = Object.keys(evidence.diffScope.byPlane);
  if (planes.length === 0) {
    lines.push('  (no control-plane-scoped paths changed)');
  } else {
    for (const plane of planes) {
      lines.push(`  ${plane}:`);
      for (const entry of evidence.diffScope.byPlane[plane]) {
        lines.push(`    [${entry.statusCode || '?'}] ${entry.path}`);
      }
    }
  }
  if (evidence.diffScope.outOfScopeCount > 0) {
    lines.push(`  (${evidence.diffScope.outOfScopeCount} other changed path(s) outside control-plane scope, not listed)`);
  }
  lines.push('');
  lines.push(
    evidence.controlPlaneVerifier.ran
      ? `tools/control-plane/verify.mjs: ${evidence.controlPlaneVerifier.result.ok ? 'PASS' : 'FAIL'} (${evidence.controlPlaneVerifier.result.summary.pass} pass / ${evidence.controlPlaneVerifier.result.summary.fail} fail / ${evidence.controlPlaneVerifier.result.summary.skipped} skipped)`
      : `tools/control-plane/verify.mjs: DID NOT RUN — ${evidence.controlPlaneVerifier.reason}`,
  );
  lines.push(
    `git diff --check: ${evidence.diffCheck.hasConflictMarkers ? 'FAIL (conflict markers found)' : evidence.diffCheck.output ? 'informational findings only (see output)' : 'clean'}`,
  );
  lines.push(`syntax check: ${evidence.syntaxCheck.checked} file(s) checked, ${evidence.syntaxCheck.failures} failure(s)`);
  lines.push('');
  lines.push(`Overall: ${evidence.ok ? 'PASS' : 'FAIL'}`);
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = resolveRoot(args.root);
  const evidence = await collectEvidence(root);

  if (!args.json) {
    process.stdout.write(printHumanSummary(evidence) + '\n');
    process.stdout.write('===JSON===\n');
  }
  process.stdout.write(JSON.stringify(evidence, null, 2) + '\n');

  process.exitCode = evidence.ok ? 0 : 1;
}

const isMainModule = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMainModule) {
  main();
}
