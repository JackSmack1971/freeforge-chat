#!/usr/bin/env node
// tools/control-plane/handoff.mjs
//
// Runtime-neutral task-handoff/evidence helper for freeforge-chat.
//
// Replaces Claude-Code-specific continuity (the retired
// `.claude/handoff/current-task.json` mechanism, driven by the retired
// `/handoff` and `/resume-handoff` slash commands) as the *only* place
// task state lives, with a schema documented in
// docs/control-plane/handoff-contract.md and enforced here, in
// docs/control-plane/schema/handoff.schema.json.
//
// Design rules (matching tools/control-plane/snapshot.mjs and verify.mjs):
//   - Zero third-party dependencies.
//   - Read-only by default; every write goes through an atomic
//     write-temp-then-rename so a crash mid-write can never corrupt the
//     tracked or runtime file.
//   - Runtime state lives under tools/control-plane/generated/ (gitignored)
//     unless a task explicitly promotes it into tracked evidence under
//     docs/control-plane/evidence/ via the `promote` command — never
//     implicitly.
//   - Evidence semantics are enforced on every write and on `validate`:
//     PASSED/FAILED only for a command that actually ran, UNAVAILABLE for
//     "not run or capability missing", NOT_APPLICABLE only with a stated
//     rationale. Nothing here ever defaults a verification entry's state —
//     every entry must name its own state explicitly. "Not checked" can
//     never silently become "passed".
//   - Never writes secrets or conversation transcripts: this file only
//     stores objective/scope/file-path/command/result strings the caller
//     supplies on the command line; it does not read environment
//     variables, credentials, or session transcripts.
//
// Usage:
//   node tools/control-plane/handoff.mjs init [--out <file>] [--objective <text>] [--branch <name>] [--force]
//   node tools/control-plane/handoff.mjs validate [<file>]
//   node tools/control-plane/handoff.mjs show [<file>]
//   node tools/control-plane/handoff.mjs update [<file>] [--set <dotted.path>=<value>] [--add-scope <text>]
//       [--add-change <path>] [--add-failure <text>] [--add-risk <text>] [--add-nongoal <text>]
//       [--add-next <text>] [--add-verification id=<id>,state=<STATE>[,command=<cmd>][,result=<r>][,rationale=<r>]]
//       [--remove-verification <id>] [--production-impact true|false] [--touch]
//   node tools/control-plane/handoff.mjs promote <file> --to <docs/control-plane/evidence/name.json>
//
// Exit code: non-zero on a usage error, a failed validation (`validate` and
// `update`), or an I/O failure. `show` never fails on a merely-stale or
// merely-invalid file — it reports the problem instead, since summarizing
// without blindly trusting is exactly its job.

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_HANDOFF_PATH = path.join(REPO_ROOT, 'tools', 'control-plane', 'generated', 'handoff.json');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'docs', 'control-plane', 'templates', 'handoff.template.json');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'docs', 'control-plane', 'evidence');
const SCHEMA_NAME = 'freeforge-handoff';
const SCHEMA_VERSION = 1;
const VALID_STATES = new Set(['PASSED', 'FAILED', 'UNAVAILABLE', 'NOT_APPLICABLE']);

// ---------------------------------------------------------------------------
// Small shared utilities
// ---------------------------------------------------------------------------

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDateTime(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function git(args, cwd = REPO_ROOT) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

// Atomic write: write to a sibling temp file, then rename over the target.
// Rename is atomic on the same filesystem, so a crash mid-write leaves
// either the old file or the new one intact, never a half-written file.
function atomicWriteFile(targetPath, contents) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmpPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.tmp-${randomBytes(6).toString('hex')}`);
  writeFileSync(tmpPath, contents);
  try {
    renameSync(tmpPath, targetPath);
  } catch (error) {
    try { unlinkSync(tmpPath); } catch { /* best-effort cleanup */ }
    throw error;
  }
}

function readHandoff(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeHandoff(filePath, record) {
  atomicWriteFile(filePath, `${JSON.stringify(record, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// Validation — hand-written against docs/control-plane/schema/handoff.schema.json.
// No JSON Schema library dependency (repository is zero-install); this
// enforces exactly the same constraints the schema file documents, plus the
// evidence-semantics rules a plain JSON Schema cannot express (the
// state-conditional required fields on each verification entry).
// ---------------------------------------------------------------------------

const TOP_LEVEL_KEYS = new Set([
  'schema', 'objective', 'baselineSha', 'worktree', 'intendedScope', 'changedFiles',
  'verification', 'unresolvedFailures', 'openRisks', 'nonGoals', 'nextActions',
  'productionImpact', 'updatedAt',
]);
const STRING_ARRAY_FIELDS = ['intendedScope', 'changedFiles', 'unresolvedFailures', 'openRisks', 'nonGoals', 'nextActions'];

function validateHandoff(record) {
  const errors = [];
  const err = (msg) => errors.push(msg);

  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    return { ok: false, errors: ['top-level value must be a JSON object'] };
  }

  for (const key of Object.keys(record)) {
    if (!TOP_LEVEL_KEYS.has(key)) err(`unknown top-level field: "${key}"`);
  }

  if (!record.schema || typeof record.schema !== 'object') {
    err('schema: required object { name, schemaVersion } is missing');
  } else {
    if (record.schema.name !== SCHEMA_NAME) err(`schema.name must be "${SCHEMA_NAME}"`);
    if (!Number.isInteger(record.schema.schemaVersion) || record.schema.schemaVersion < 1) {
      err('schema.schemaVersion must be an integer >= 1');
    }
  }

  if (!isNonEmptyString(record.objective)) err('objective must be a non-empty string');

  if (typeof record.baselineSha !== 'string' || !/^[0-9a-f]{40}$/.test(record.baselineSha)) {
    err('baselineSha must be a 40-character lowercase hex Git commit SHA');
  }

  if (!record.worktree || typeof record.worktree !== 'object' || Array.isArray(record.worktree)) {
    err('worktree must be an object with at least "branch"');
  } else {
    if (!isNonEmptyString(record.worktree.branch)) err('worktree.branch must be a non-empty string');
    for (const key of Object.keys(record.worktree)) {
      if (key !== 'branch' && key !== 'path') err(`unknown field worktree.${key}`);
    }
  }

  for (const field of STRING_ARRAY_FIELDS) {
    const value = record[field];
    if (!Array.isArray(value)) {
      err(`${field} must be an array`);
      continue;
    }
    value.forEach((item, i) => {
      if (!isNonEmptyString(item)) err(`${field}[${i}] must be a non-empty string`);
    });
  }

  if (!Array.isArray(record.verification)) {
    err('verification must be an array');
  } else {
    record.verification.forEach((entry, i) => {
      const prefix = `verification[${i}]`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        err(`${prefix} must be an object`);
        return;
      }
      for (const key of Object.keys(entry)) {
        if (!['id', 'command', 'result', 'rationale', 'state', 'ranAt'].includes(key)) {
          err(`unknown field ${prefix}.${key}`);
        }
      }
      if (!isNonEmptyString(entry.id)) err(`${prefix}.id must be a non-empty string`);
      if (!VALID_STATES.has(entry.state)) {
        err(`${prefix}.state must be one of ${[...VALID_STATES].join(', ')} — states are never defaulted, only explicitly set`);
        return;
      }
      // Evidence semantics: what each state is allowed to claim.
      if (entry.state === 'PASSED') {
        if (!isNonEmptyString(entry.command)) err(`${prefix}: state PASSED requires a non-empty "command" (only executed evidence may be PASSED)`);
        if (!isNonEmptyString(entry.result)) err(`${prefix}: state PASSED requires a non-empty "result" (only executed evidence may be PASSED)`);
      } else if (entry.state === 'FAILED') {
        if (!isNonEmptyString(entry.command)) err(`${prefix}: state FAILED requires a non-empty "command" (only an executed command can have failed)`);
      } else if (entry.state === 'NOT_APPLICABLE') {
        if (!isNonEmptyString(entry.rationale)) err(`${prefix}: state NOT_APPLICABLE requires a non-empty "rationale"`);
      }
      // UNAVAILABLE has no additional requirement: "not run" or "capability
      // missing" needs no command/result to already exist.
      if (entry.ranAt !== undefined && entry.ranAt !== null && !isIsoDateTime(entry.ranAt)) {
        err(`${prefix}.ranAt must be a valid ISO 8601 date-time or null`);
      }
    });
  }

  if (typeof record.productionImpact !== 'boolean') err('productionImpact must be a boolean');
  if (!isIsoDateTime(record.updatedAt)) err('updatedAt must be a valid ISO 8601 date-time');

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Staleness — a valid handoff can still describe a tree that has since
// moved on. This is distinct from schema validity: a summarizer must never
// blindly trust that baselineSha still matches HEAD.
// ---------------------------------------------------------------------------

function staleness(record, root = REPO_ROOT) {
  const head = git(['rev-parse', 'HEAD'], root);
  if (!head) return { checked: false, stale: null, currentSha: null, note: 'could not resolve current HEAD (not a git repository, or git unavailable)' };
  if (typeof record.baselineSha !== 'string') return { checked: false, stale: null, currentSha: head, note: 'record has no valid baselineSha to compare' };
  return { checked: true, stale: record.baselineSha !== head, currentSha: head, note: null };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usageError(message) {
  process.stderr.write(`handoff.mjs: ${message}\n`);
  process.exitCode = 1;
}

function loadTemplate() {
  return JSON.parse(readFileSync(TEMPLATE_PATH, 'utf8'));
}

function cmdInit(argv) {
  const args = { out: DEFAULT_HANDOFF_PATH, objective: '', branch: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = path.resolve(argv[++i]);
    else if (a === '--objective') args.objective = argv[++i];
    else if (a === '--branch') args.branch = argv[++i];
    else if (a === '--force') args.force = true;
    else return usageError(`init: unknown argument "${a}"`);
  }
  if (existsSync(args.out) && !args.force) {
    return usageError(`init: ${args.out} already exists (pass --force to overwrite)`);
  }
  const record = loadTemplate();
  record.objective = args.objective || 'unspecified — set with: handoff.mjs update --set objective="..."';
  record.baselineSha = git(['rev-parse', 'HEAD']) || record.baselineSha;
  record.worktree.branch = args.branch || git(['rev-parse', '--abbrev-ref', 'HEAD']) || '';
  record.updatedAt = new Date().toISOString();

  const { ok, errors } = validateHandoff(record);
  if (!ok) {
    process.stderr.write(`handoff.mjs init: generated record failed validation:\n${errors.map((e) => `  - ${e}`).join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  writeHandoff(args.out, record);
  process.stdout.write(`wrote ${args.out}\n`);
}

function resolveTargetPath(positional) {
  return positional ? path.resolve(positional) : DEFAULT_HANDOFF_PATH;
}

function cmdValidate(argv) {
  const filePath = resolveTargetPath(argv[0]);
  if (!existsSync(filePath)) {
    process.stderr.write(`handoff.mjs validate: no such file: ${filePath}\n`);
    process.exitCode = 1;
    return;
  }
  let record;
  try {
    record = readHandoff(filePath);
  } catch (error) {
    process.stderr.write(`handoff.mjs validate: ${filePath} is not valid JSON: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  const { ok, errors } = validateHandoff(record);
  if (ok) {
    process.stdout.write(`${filePath}: valid\n`);
  } else {
    process.stdout.write(`${filePath}: INVALID\n${errors.map((e) => `  - ${e}`).join('\n')}\n`);
    process.exitCode = 1;
  }
}

function cmdShow(argv) {
  const filePath = resolveTargetPath(argv[0]);
  if (!existsSync(filePath)) {
    process.stdout.write(`No handoff record at ${filePath}. Nothing to summarize.\n`);
    return;
  }
  let record;
  try {
    record = readHandoff(filePath);
  } catch (error) {
    process.stdout.write(`${filePath} exists but is not valid JSON (${error.message}). Not trusting its contents.\n`);
    process.exitCode = 1;
    return;
  }
  const { ok, errors } = validateHandoff(record);
  const lines = [];
  lines.push(`Handoff: ${filePath}`);
  if (!ok) {
    lines.push('SCHEMA INVALID — summarizing on a best-effort basis only, do not treat this as trustworthy:');
    for (const e of errors) lines.push(`  - ${e}`);
  }
  const st = staleness(record);
  if (st.checked && st.stale) {
    lines.push(`STALE: recorded baselineSha ${record.baselineSha} does not match current HEAD ${st.currentSha}. Verification/changedFiles below may no longer describe the working tree — re-verify before acting on them.`);
  } else if (st.checked) {
    lines.push(`Baseline matches current HEAD (${st.currentSha}).`);
  } else {
    lines.push(`Could not check staleness: ${st.note}`);
  }
  lines.push(`Objective: ${record.objective ?? '(none)'}`);
  lines.push(`Branch: ${record.worktree?.branch ?? '(unknown)'}`);
  lines.push(`Production impact: ${record.productionImpact === true ? 'YES' : record.productionImpact === false ? 'no' : '(unknown)'}`);
  lines.push(`Updated: ${record.updatedAt ?? '(unknown)'}`);

  const listSection = (label, items) => {
    if (!Array.isArray(items) || items.length === 0) return;
    lines.push(`${label} (${items.length}):`);
    for (const item of items) lines.push(`  - ${item}`);
  };
  listSection('Intended scope', record.intendedScope);
  listSection('Changed files', record.changedFiles);
  if (Array.isArray(record.verification) && record.verification.length > 0) {
    lines.push(`Verification (${record.verification.length}):`);
    for (const v of record.verification) {
      lines.push(`  - [${v.state}] ${v.id}${v.command ? ` :: ${v.command}` : ''}${v.result ? ` -> ${v.result}` : ''}${v.rationale ? ` (${v.rationale})` : ''}`);
    }
    const unavailable = record.verification.filter((v) => v.state === 'UNAVAILABLE').length;
    if (unavailable > 0) lines.push(`  NOTE: ${unavailable} check(s) are UNAVAILABLE — not run, not passed. Do not treat as evidence of correctness.`);
  }
  listSection('Unresolved failures', record.unresolvedFailures);
  listSection('Open risks', record.openRisks);
  listSection('Non-goals', record.nonGoals);
  listSection('Next actions', record.nextActions);

  process.stdout.write(`${lines.join('\n')}\n`);
  if (!ok) process.exitCode = 1;
}

function parseKeyValueList(spec) {
  const out = {};
  for (const pair of spec.split(',')) {
    const idx = pair.indexOf('=');
    if (idx === -1) throw new Error(`malformed key=value pair: "${pair}"`);
    out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return out;
}

function setDottedPath(record, dottedPath, value) {
  const parts = dottedPath.split('.');
  let cursor = record;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cursor[parts[i]] !== 'object' || cursor[parts[i]] === null) {
      throw new Error(`cannot set "${dottedPath}": "${parts.slice(0, i + 1).join('.')}" is not an object`);
    }
    cursor = cursor[parts[i]];
  }
  const lastKey = parts[parts.length - 1];
  if (value === 'true') cursor[lastKey] = true;
  else if (value === 'false') cursor[lastKey] = false;
  else cursor[lastKey] = value;
}

function cmdUpdate(argv) {
  let filePath = DEFAULT_HANDOFF_PATH;
  let restArgv = argv;
  if (argv.length > 0 && !argv[0].startsWith('--')) {
    filePath = path.resolve(argv[0]);
    restArgv = argv.slice(1);
  }
  if (!existsSync(filePath)) {
    return usageError(`update: no such file: ${filePath} (run "init" first)`);
  }
  const record = readHandoff(filePath);
  let touched = false;

  for (let i = 0; i < restArgv.length; i++) {
    const a = restArgv[i];
    try {
      if (a === '--set') {
        const [key, ...rest] = restArgv[++i].split('=');
        setDottedPath(record, key, rest.join('='));
        touched = true;
      } else if (a === '--add-scope') { record.intendedScope.push(restArgv[++i]); touched = true; }
      else if (a === '--add-change') { record.changedFiles.push(restArgv[++i]); touched = true; }
      else if (a === '--add-failure') { record.unresolvedFailures.push(restArgv[++i]); touched = true; }
      else if (a === '--add-risk') { record.openRisks.push(restArgv[++i]); touched = true; }
      else if (a === '--add-nongoal') { record.nonGoals.push(restArgv[++i]); touched = true; }
      else if (a === '--add-next') { record.nextActions.push(restArgv[++i]); touched = true; }
      else if (a === '--add-verification') {
        const fields = parseKeyValueList(restArgv[++i]);
        if (!fields.id || !fields.state) throw new Error('--add-verification requires at least id=... and state=...');
        record.verification = record.verification.filter((v) => v.id !== fields.id);
        record.verification.push({
          id: fields.id,
          state: fields.state,
          command: fields.command ?? null,
          result: fields.result ?? null,
          rationale: fields.rationale ?? null,
          ranAt: fields.ranAt ?? (fields.state === 'PASSED' || fields.state === 'FAILED' ? new Date().toISOString() : null),
        });
        touched = true;
      } else if (a === '--remove-verification') {
        const id = restArgv[++i];
        record.verification = record.verification.filter((v) => v.id !== id);
        touched = true;
      } else if (a === '--production-impact') {
        record.productionImpact = restArgv[++i] === 'true';
        touched = true;
      } else if (a === '--touch') {
        touched = true;
      } else {
        return usageError(`update: unknown argument "${a}"`);
      }
    } catch (error) {
      return usageError(`update: ${error.message}`);
    }
  }

  if (!touched) {
    return usageError('update: no mutating flag given — nothing to do');
  }

  record.updatedAt = new Date().toISOString();
  const { ok, errors } = validateHandoff(record);
  if (!ok) {
    process.stderr.write(`handoff.mjs update: refusing to write — resulting record is invalid:\n${errors.map((e) => `  - ${e}`).join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  writeHandoff(filePath, record);
  process.stdout.write(`updated ${filePath}\n`);
}

function cmdPromote(argv) {
  const source = argv[0];
  if (!source || source.startsWith('--')) return usageError('promote: usage: promote <file> --to <docs/control-plane/evidence/name.json>');
  let to = null;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--to') to = argv[++i];
  }
  if (!to) return usageError('promote: missing required --to <path>');

  const sourceAbs = path.resolve(source);
  if (!existsSync(sourceAbs)) return usageError(`promote: no such file: ${sourceAbs}`);

  const targetAbs = path.resolve(REPO_ROOT, to);
  const evidenceDirResolved = path.resolve(EVIDENCE_DIR);
  if (!targetAbs.startsWith(evidenceDirResolved + path.sep)) {
    return usageError(`promote: --to must be a path under ${path.relative(REPO_ROOT, evidenceDirResolved)}/ (got "${to}") — promotion only ever targets tracked evidence, never an arbitrary path`);
  }

  const record = readHandoff(sourceAbs);
  const { ok, errors } = validateHandoff(record);
  if (!ok) {
    process.stderr.write(`handoff.mjs promote: refusing to promote an invalid record:\n${errors.map((e) => `  - ${e}`).join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  const st = staleness(record);
  if (st.checked && st.stale) {
    process.stderr.write(`handoff.mjs promote: refusing to promote a stale record (baselineSha ${record.baselineSha} != current HEAD ${st.currentSha}). Re-run "update"/"init" against current HEAD first.\n`);
    process.exitCode = 1;
    return;
  }

  atomicWriteFile(targetAbs, `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(`promoted ${sourceAbs} -> ${targetAbs}\nThis is now tracked evidence — commit it deliberately, like any other reviewed change.\n`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case 'init': return cmdInit(rest);
    case 'validate': return cmdValidate(rest);
    case 'show': return cmdShow(rest);
    case 'update': return cmdUpdate(rest);
    case 'promote': return cmdPromote(rest);
    default:
      process.stderr.write(
        'handoff.mjs: usage: node tools/control-plane/handoff.mjs <init|validate|show|update|promote> [...args]\n',
      );
      process.exitCode = command ? 1 : 0;
  }
}

const isMainModule = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMainModule) {
  main();
}

export { validateHandoff, staleness, atomicWriteFile, DEFAULT_HANDOFF_PATH, EVIDENCE_DIR, TEMPLATE_PATH };
