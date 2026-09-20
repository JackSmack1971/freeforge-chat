#!/usr/bin/env node
// tools/control-plane/snapshot.mjs
//
// Deterministic control-plane snapshot compiler for freeforge-chat.
//
// Produces a canonical JSON record of what governs agent/CI behavior in this
// repository right now: which control-plane sources exist, their content
// digests, the Git commit and dirty-state this was compiled against, and
// diagnostics for anything missing, invalid, or excluded. It reads real
// on-disk state only — never `.planning/**`, prior summaries, or memory.
//
// This is NOT a built-in Codex CLI snapshot object and does not claim to be
// one. It is repository governance evidence produced by this script, for
// humans and agents auditing what control-plane content is actually in
// force, and for detecting drift between runs.
//
// Design rules (matching tools/control-plane/verify.mjs):
//   - Read-only, no mutation of application or control-plane files.
//   - Zero third-party dependencies.
//   - Deterministic ordering and canonical serialization: identical
//     repository/config inputs must yield an identical `digest`.
//   - Generated output is never written into a tracked location unless the
//     caller explicitly names one with --out; the default --out target is
//     tools/control-plane/generated/, which is gitignored.
//
// Usage:
//   node tools/control-plane/snapshot.mjs [--root <path>] [--out <file>] [--pretty]
//   node tools/control-plane/snapshot.mjs show [--root <path>]
//   node tools/control-plane/snapshot.mjs explain <path> [--root <path>]
//
// Exit code: 0 once the snapshot is compiled (compiling a snapshot that
// contains diagnostics is not itself a failure — use verify.mjs for
// pass/fail policy checks). Non-zero only on a usage error or a compiler
// crash (e.g. --root does not exist).

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_NAME = 'freeforge-control-plane-snapshot';
const SCHEMA_VERSION = 1;
const COMPILER_VERSION = '1.0.0';
const DISCLAIMER =
  'This is repository governance evidence produced by tools/control-plane/snapshot.mjs. ' +
  'It is not a built-in Codex CLI snapshot object.';

// ---------------------------------------------------------------------------
// Small shared utilities
// ---------------------------------------------------------------------------

function toPosixRelative(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function digestFile(absPath) {
  return sha256Hex(readFileSync(absPath));
}

function walkFiles(absoluteDir, { skipDirNames = new Set(['node_modules', '.git']) } = {}) {
  const out = [];
  if (!existsSync(absoluteDir)) return out;
  const stack = [absoluteDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (skipDirNames.has(entry.name)) continue;
        stack.push(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        out.push(path.join(dir, entry.name));
      }
    }
  }
  return out;
}

function isGitRepo(root) {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, encoding: 'utf8' });
  return !result.error && result.status === 0 && result.stdout.trim() === 'true';
}

function gitState(root) {
  if (!isGitRepo(root)) {
    return { commit: null, dirty: null, dirtyFileCount: null, note: 'not a git repository' };
  }
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const commit = !head.error && head.status === 0 ? head.stdout.trim() : null;
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (status.error || status.status !== 0) {
    return { commit, dirty: null, dirtyFileCount: null, note: 'git status failed' };
  }
  const dirtyLines = status.stdout.split(/\r?\n/).filter((line) => line.trim() !== '');
  return { commit, dirty: dirtyLines.length > 0, dirtyFileCount: dirtyLines.length, note: null };
}

// Canonical JSON: object keys sorted recursively, arrays kept in the order
// the caller already sorted them into (callers sort arrays of records by
// `id` before this is invoked). No whitespace, so the string is stable
// input for hashing.
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const sortedKeys = Object.keys(value).sort();
    const out = {};
    for (const key of sortedKeys) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function byId(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

function makeDiagnostics() {
  const list = [];
  return {
    list,
    add(severity, category, sourcePath, message) {
      list.push({ severity, category, path: sourcePath ?? null, message });
    },
  };
}

// ---------------------------------------------------------------------------
// Source collectors — each returns a plain record set plus pushes any
// diagnostics for that category (missing directory, invalid content,
// excluded file).
// ---------------------------------------------------------------------------

function collectAgentsMd(root, diagnostics) {
  const rootRel = 'AGENTS.md';
  const rootAbs = path.join(root, rootRel);
  if (!existsSync(rootAbs)) {
    diagnostics.add('error', 'agents-md', rootRel, 'missing required root AGENTS.md');
    return [];
  }
  const rootText = readFileSync(rootAbs, 'utf8');

  const allAgentsMd = walkFiles(root, {
    skipDirNames: new Set(['node_modules', '.git', 'coverage', '.worktrees']),
  }).filter((abs) => path.basename(abs) === 'AGENTS.md');

  const entries = [];
  for (const abs of allAgentsMd) {
    const rel = toPosixRelative(root, abs);
    const active = rel === rootRel || rootText.includes(rel);
    if (!active) {
      diagnostics.add('info', 'agents-md', rel, 'excluded: nested AGENTS.md is not referenced from root AGENTS.md');
    }
    entries.push({ id: rel, path: rel, active, digest: digestFile(abs) });
  }
  entries.sort(byId);
  return entries;
}

function collectCodexConfig(root, diagnostics) {
  const rel = '.codex/config.toml';
  const abs = path.join(root, rel);
  if (!existsSync(abs)) {
    diagnostics.add('error', 'codex-config', rel, 'missing .codex/config.toml');
    return null;
  }
  return { id: rel, path: rel, digest: digestFile(abs) };
}

function collectCodexRules(root, diagnostics) {
  const relDir = '.codex/rules';
  const absDir = path.join(root, relDir);
  if (!existsSync(absDir)) {
    diagnostics.add('error', 'codex-rules', relDir, 'missing .codex/rules directory');
    return [];
  }
  const files = readdirSync(absDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.rules'))
    .map((e) => e.name)
    .sort();
  if (files.length === 0) {
    diagnostics.add('error', 'codex-rules', relDir, '.codex/rules contains no .rules files');
  }
  return files.map((file) => {
    const rel = `${relDir}/${file}`;
    return { id: rel, path: rel, digest: digestFile(path.join(absDir, file)) };
  });
}

function extractHookCommandTargets(hooksJson) {
  const targets = [];
  const events = hooksJson?.hooks;
  if (!events || typeof events !== 'object') return targets;
  for (const matcherList of Object.values(events)) {
    if (!Array.isArray(matcherList)) continue;
    for (const matcherEntry of matcherList) {
      const hooks = matcherEntry?.hooks;
      if (!Array.isArray(hooks)) continue;
      for (const hook of hooks) {
        for (const field of ['command', 'commandWindows']) {
          const commandString = hook?.[field];
          if (typeof commandString !== 'string') continue;
          const match = commandString.match(/([.\w/\\-]+\.js)\b/);
          if (match) targets.push(match[1].replace(/\\/g, '/'));
        }
      }
    }
  }
  return targets;
}

function collectCodexHooks(root, diagnostics) {
  const rel = '.codex/hooks.json';
  const abs = path.join(root, rel);
  if (!existsSync(abs)) {
    diagnostics.add('error', 'codex-hooks', rel, 'missing .codex/hooks.json');
    return { hooksJson: null, scripts: [] };
  }
  const raw = readFileSync(abs, 'utf8');
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    diagnostics.add('error', 'codex-hooks', rel, `invalid JSON: ${error.message}`);
    return { hooksJson: { id: rel, path: rel, digest: sha256Hex(Buffer.from(raw)) }, scripts: [] };
  }

  const hooksJson = { id: rel, path: rel, digest: digestFile(abs) };
  const targetRels = [...new Set(extractHookCommandTargets(parsed))].sort();
  const scripts = [];
  for (const targetRel of targetRels) {
    const targetAbs = path.join(root, targetRel);
    if (!existsSync(targetAbs)) {
      diagnostics.add('error', 'codex-hooks', targetRel, `referenced from ${rel} but does not exist on disk`);
      continue;
    }
    scripts.push({ id: targetRel, path: targetRel, digest: digestFile(targetAbs) });
  }
  scripts.sort(byId);
  return { hooksJson, scripts };
}

function collectCodexAgents(root, diagnostics) {
  const relDir = '.codex/agents';
  const absDir = path.join(root, relDir);
  if (!existsSync(absDir)) {
    diagnostics.add('info', 'codex-agents', relDir, 'excluded: .codex/agents does not exist');
    return [];
  }
  const files = readdirSync(absDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.toml'))
    .map((e) => e.name)
    .sort();
  if (files.length === 0) {
    diagnostics.add('info', 'codex-agents', relDir, 'excluded: .codex/agents contains no .toml files');
  }
  return files.map((file) => {
    const rel = `${relDir}/${file}`;
    return { id: rel, path: rel, digest: digestFile(path.join(absDir, file)) };
  });
}

function collectAgentSkills(root, diagnostics) {
  const relDir = '.agents/skills';
  const absDir = path.join(root, relDir);
  if (!existsSync(absDir)) {
    diagnostics.add('info', 'agent-skills', relDir, 'excluded: .agents/skills does not exist');
    return [];
  }
  const skillDirs = readdirSync(absDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const entries = [];
  for (const name of skillDirs) {
    const rel = `${relDir}/${name}/SKILL.md`;
    const abs = path.join(absDir, name, 'SKILL.md');
    if (!existsSync(abs)) {
      diagnostics.add('error', 'agent-skills', rel, `skill directory "${name}" has no SKILL.md`);
      continue;
    }
    entries.push({ id: rel, path: rel, digest: digestFile(abs) });
  }
  entries.sort(byId);
  return entries;
}

function collectSecurityConstitution(root, diagnostics) {
  const rel = 'security/constitution.md';
  const abs = path.join(root, rel);
  if (!existsSync(abs)) {
    diagnostics.add('error', 'security-constitution', rel, 'missing security/constitution.md');
    return null;
  }
  return { id: rel, path: rel, digest: digestFile(abs) };
}

function collectCiWorkflows(root, diagnostics) {
  const relDir = '.github/workflows';
  const absDir = path.join(root, relDir);
  if (!existsSync(absDir)) {
    diagnostics.add('error', 'ci-workflows', relDir, 'missing .github/workflows directory');
    return [];
  }
  const files = readdirSync(absDir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.ya?ml$/.test(e.name))
    .map((e) => e.name)
    .sort();
  if (files.length === 0) {
    diagnostics.add('error', 'ci-workflows', relDir, '.github/workflows contains no workflow files');
  }
  return files.map((file) => {
    const rel = `${relDir}/${file}`;
    return { id: rel, path: rel, digest: digestFile(path.join(absDir, file)) };
  });
}

// ---------------------------------------------------------------------------
// Compiler
// ---------------------------------------------------------------------------

export function compileSnapshot(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`--root does not exist or is not a directory: ${root}`);
  }

  const diagnostics = makeDiagnostics();

  const sources = {
    agentsMd: collectAgentsMd(root, diagnostics),
    codexConfig: collectCodexConfig(root, diagnostics),
    codexRules: collectCodexRules(root, diagnostics),
    codexHooks: collectCodexHooks(root, diagnostics),
    codexAgents: collectCodexAgents(root, diagnostics),
    agentSkills: collectAgentSkills(root, diagnostics),
    securityConstitution: collectSecurityConstitution(root, diagnostics),
    ciWorkflows: collectCiWorkflows(root, diagnostics),
  };

  const git = gitState(root);
  diagnostics.list.sort((a, b) => (a.path ?? '').localeCompare(b.path ?? '') || a.category.localeCompare(b.category));

  // Everything that participates in the digest: content-derived, portable
  // across machines/clones (no absolute paths, no wall-clock timestamp).
  const digestInput = {
    schema: { name: SCHEMA_NAME, schemaVersion: SCHEMA_VERSION, compilerVersion: COMPILER_VERSION },
    git,
    sources,
    diagnostics: diagnostics.list,
  };
  const digest = sha256Hex(Buffer.from(canonicalStringify(digestInput)));

  return {
    schema: { name: SCHEMA_NAME, schemaVersion: SCHEMA_VERSION, compilerVersion: COMPILER_VERSION },
    disclaimer: DISCLAIMER,
    generatedAt: new Date().toISOString(),
    repositoryRoot: root,
    git,
    sources,
    diagnostics: diagnostics.list,
    digest,
  };
}

// ---------------------------------------------------------------------------
// explain — answers "why is this file (not) in the snapshot"
// ---------------------------------------------------------------------------

function flattenEntries(sources) {
  const flat = [];
  const pushAll = (category, list) => {
    for (const entry of list ?? []) flat.push({ category, ...entry });
  };
  pushAll('agents-md', sources.agentsMd);
  if (sources.codexConfig) flat.push({ category: 'codex-config', ...sources.codexConfig });
  pushAll('codex-rules', sources.codexRules);
  if (sources.codexHooks.hooksJson) flat.push({ category: 'codex-hooks', ...sources.codexHooks.hooksJson });
  pushAll('codex-hooks', sources.codexHooks.scripts);
  pushAll('codex-agents', sources.codexAgents);
  pushAll('agent-skills', sources.agentSkills);
  if (sources.securityConstitution) flat.push({ category: 'security-constitution', ...sources.securityConstitution });
  pushAll('ci-workflows', sources.ciWorkflows);
  return flat;
}

export function explainPath(snapshot, relPath) {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  const entry = flattenEntries(snapshot.sources).find((e) => e.path === normalized);
  if (entry) {
    return {
      path: normalized,
      inSnapshot: true,
      category: entry.category,
      digest: entry.digest,
      active: 'active' in entry ? entry.active : true,
      reason:
        'active' in entry && entry.active === false
          ? `matched category "${entry.category}" but is excluded (see diagnostics for this path)`
          : `matched category "${entry.category}"; its content digest contributes to the snapshot digest`,
    };
  }
  const diagnostic = snapshot.diagnostics.find((d) => d.path === normalized);
  if (diagnostic) {
    return {
      path: normalized,
      inSnapshot: false,
      category: diagnostic.category,
      reason: `not in snapshot — ${diagnostic.severity}: ${diagnostic.message}`,
    };
  }
  return {
    path: normalized,
    inSnapshot: false,
    category: null,
    reason: 'not in snapshot — path does not belong to any tracked control-plane source category',
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { command: 'generate', root: null, out: null, pretty: false, target: null };
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') args.root = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--pretty') args.pretty = true;
    else positionals.push(arg);
  }
  if (positionals[0] === 'show' || positionals[0] === 'explain') {
    args.command = positionals[0];
    args.target = positionals[1] ?? null;
  }
  return args;
}

function resolveOutPath(root, out) {
  if (!out) return null;
  if (out.includes('/') || out.includes(path.sep)) return path.resolve(out);
  // A bare filename is intentionally placed in the gitignored generated/
  // directory rather than the repository root, so a plain `--out
  // snapshot.json` can never accidentally land tracked output.
  return path.join(root, 'tools', 'control-plane', 'generated', out);
}

function printShow(snapshot) {
  const lines = [];
  lines.push(`Control-plane snapshot — ${snapshot.schema.name} v${snapshot.schema.schemaVersion} (compiler ${snapshot.schema.compilerVersion})`);
  lines.push(snapshot.disclaimer);
  lines.push(`root: ${snapshot.repositoryRoot}`);
  lines.push(`git commit: ${snapshot.git.commit ?? '(unknown)'}  dirty: ${snapshot.git.dirty ?? '(unknown)'}`);
  lines.push(`digest: ${snapshot.digest}`);
  lines.push('');
  const flat = flattenEntries(snapshot.sources);
  const byCategory = new Map();
  for (const entry of flat) {
    if (!byCategory.has(entry.category)) byCategory.set(entry.category, []);
    byCategory.get(entry.category).push(entry);
  }
  for (const [category, entries] of [...byCategory.entries()].sort()) {
    lines.push(`${category} (${entries.length}):`);
    for (const entry of entries) {
      const activeTag = 'active' in entry && entry.active === false ? ' [excluded]' : '';
      lines.push(`  ${entry.path}${activeTag}  ${entry.digest.slice(0, 12)}`);
    }
  }
  if (snapshot.diagnostics.length > 0) {
    lines.push('');
    lines.push(`diagnostics (${snapshot.diagnostics.length}):`);
    for (const d of snapshot.diagnostics) {
      lines.push(`  [${d.severity}] ${d.category}${d.path ? ` (${d.path})` : ''}: ${d.message}`);
    }
  }
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root ? path.resolve(args.root) : path.resolve(__dirname, '..', '..');

  let snapshot;
  try {
    snapshot = compileSnapshot(root);
  } catch (error) {
    process.stderr.write(`snapshot.mjs: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  if (args.command === 'show') {
    process.stdout.write(printShow(snapshot) + '\n');
    return;
  }

  if (args.command === 'explain') {
    if (!args.target) {
      process.stderr.write('snapshot.mjs explain <path>: missing <path> argument\n');
      process.exitCode = 1;
      return;
    }
    const explanation = explainPath(snapshot, args.target);
    process.stdout.write(JSON.stringify(explanation, null, 2) + '\n');
    return;
  }

  const json = JSON.stringify(snapshot, null, args.pretty ? 2 : 0);
  if (args.out) {
    const outAbs = resolveOutPath(root, args.out);
    mkdirSync(path.dirname(outAbs), { recursive: true });
    writeFileSync(outAbs, json + '\n');
    process.stdout.write(`wrote ${outAbs}\n`);
  } else {
    process.stdout.write(json + '\n');
  }
}

const isMainModule = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMainModule) {
  main();
}
