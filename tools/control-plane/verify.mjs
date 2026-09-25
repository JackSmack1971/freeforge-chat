#!/usr/bin/env node
// tools/control-plane/verify.mjs
//
// Authoritative, cross-runtime control-plane verifier for freeforge-chat.
//
// This replaces `.claude/hooks/validators/control-plane-check.js` as the
// thing CI/humans run to prove the control plane is structurally sound.
// That old script is Claude-Code-specific (it only understands
// `.claude/**` shapes: agent frontmatter, slash commands, output styles)
// and is no longer authoritative for this repository, which is migrating to
// a Codex-native/cross-runtime control plane (see
// docs/control-plane/MIGRATION_CONTRACT.md). Its logic is preserved here,
// condensed, as `runClaudeCompatibilityCheck()` — a strictly informational,
// non-authoritative check that never affects the exit code. Everything else
// in this file inspects real on-disk state and is authoritative: a FAIL in
// an authoritative check makes this script exit non-zero.
//
// Design rules this file follows (see docs/control-plane/MIGRATION_CONTRACT.md
// invariant 3.6, "git diff is authoritative"):
//   - Every check reads actual files on disk, never assumes prior state.
//   - PASS / FAIL / SKIPPED are distinct outcomes. A check that could not
//     run (missing binary, missing optional directory) is SKIPPED, never
//     silently reported as PASS.
//   - No network access, no mutation. Read-only by construction.
//   - Zero third-party dependencies, matching this repo's zero-install
//     policy (see AGENTS.md, tests/AGENTS.md).
//
// Usage:
//   node tools/control-plane/verify.mjs [--root <path>] [--json]
//
// Output: a concise human-readable summary on stdout, followed by a
// `===JSON===` delimiter line and a single machine-readable JSON object
// (also on stdout) with the full check list, statuses, and the source
// commit this run was evaluated against. `--json` suppresses the
// human-readable summary and prints only the JSON object.
//
// Exit code: non-zero iff at least one *authoritative* check FAILed.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Small shared utilities
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { root: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') args.root = argv[++i];
    else if (arg === '--json') args.json = true;
  }
  return args;
}

class Report {
  constructor() {
    this.checks = [];
  }

  add(id, description, status, detail, { authoritative = true } = {}) {
    this.checks.push({ id, description, status, detail: detail ?? null, authoritative });
  }

  pass(id, description, detail) {
    this.add(id, description, 'PASS', detail);
  }

  fail(id, description, detail) {
    this.add(id, description, 'FAIL', detail);
  }

  skip(id, description, reason) {
    this.add(id, description, 'SKIPPED', reason);
  }

  // For the Claude-compatibility check only: reports a real outcome that is
  // explicitly excluded from the authoritative pass/fail decision.
  addInformational(id, description, status, detail) {
    this.add(id, description, status, detail, { authoritative: false });
  }
}

function isGitRepo(root) {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, encoding: 'utf8' });
  return !result.error && result.status === 0 && result.stdout.trim() === 'true';
}

function gitCheckIgnored(root, relativePath) {
  // -q, no -v: documented unambiguous exit code (0 = ignored, 1 = not ignored).
  // --no-index: match .gitignore patterns even for tracked files, so a
  // required file that is tracked but pattern-matched still fails.
  const result = spawnSync('git', ['check-ignore', '-q', '--no-index', relativePath], { cwd: root });
  if (result.error) return null; // git unavailable
  return result.status === 0;
}

function sourceCommit(root) {
  if (!isGitRepo(root)) return null;
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

function readTextFile(absolutePath) {
  return readFileSync(absolutePath, 'utf8');
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

function toPosixRelative(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// Minimal TOML reader — covers the grammar actually used by .codex/config.toml
// and .codex/agents/*.toml: comments, top-level key = value pairs, [table]
// headers, booleans, quoted strings, integers, and triple-quoted
// (`"""..."""`) multi-line basic strings (needed for a standalone agent
// file's `developer_instructions`). Intentionally throws on anything outside
// that grammar so a config file that grows beyond it fails loudly instead of
// being silently mis-parsed. Mirrors tests/security/codex-config.test.mjs's
// reader for the single-line subset.
// ---------------------------------------------------------------------------

function parseTomlValue(raw) {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^"(?:[^"\\]|\\.)*"$/.test(value)) {
    return value.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  throw new Error(`Unsupported TOML value grammar: ${raw}`);
}

function stripTomlComment(line) {
  const idx = line.indexOf('#');
  return idx === -1 ? line : line.slice(0, idx);
}

function parseSimpleToml(text) {
  const tables = { '': {} };
  let current = '';
  const rawLines = text.split(/\r?\n/);
  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const line = stripTomlComment(rawLine).trim();
    if (line === '') continue;

    const tableMatch = line.match(/^\[([A-Za-z0-9_.]+)\]$/);
    if (tableMatch) {
      current = tableMatch[1];
      if (!(current in tables)) tables[current] = {};
      continue;
    }

    // Triple-quoted multi-line basic string: `key = """`, optionally with
    // content and/or the closing `"""` on the same line. Comments are never
    // stripped from the string body itself — only from the lines outside it.
    const multilineStart = rawLine.match(/^([A-Za-z0-9_]+)\s*=\s*"""(.*)$/);
    if (multilineStart) {
      const [, key, afterOpen] = multilineStart;
      const sameLineClose = afterOpen.indexOf('"""');
      if (sameLineClose !== -1) {
        tables[current][key] = afterOpen.slice(0, sameLineClose);
        continue;
      }
      const collected = afterOpen.length > 0 ? [afterOpen] : [];
      let closed = false;
      for (i += 1; i < rawLines.length; i++) {
        const closeIdx = rawLines[i].indexOf('"""');
        if (closeIdx !== -1) {
          collected.push(rawLines[i].slice(0, closeIdx));
          closed = true;
          break;
        }
        collected.push(rawLines[i]);
      }
      if (!closed) {
        throw new Error(`Unterminated triple-quoted string for key "${key}"`);
      }
      tables[current][key] = collected.join('\n');
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!kvMatch) {
      throw new Error(`Unparseable TOML line: ${rawLine}`);
    }
    const [, key, rawValue] = kvMatch;
    tables[current][key] = parseTomlValue(rawValue);
  }
  return tables;
}

// ---------------------------------------------------------------------------
// Minimal YAML-ish frontmatter reader (flat scalars + simple `- item` lists),
// matching what .agents/skills/*/SKILL.md and AGENTS.md-adjacent frontmatter
// actually use.
// ---------------------------------------------------------------------------

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const result = {};
  let currentKey = null;
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentKey) {
      result[currentKey] ||= [];
      result[currentKey].push(listMatch[1].trim());
      continue;
    }
    const fieldMatch = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!fieldMatch) continue;
    currentKey = fieldMatch[1];
    const value = fieldMatch[2].trim();
    result[currentKey] = value === '' ? [] : value.replace(/^["']|["']$/g, '');
  }
  return result;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkAgentsMdTopology(root, report) {
  const required = ['AGENTS.md', 'tests/AGENTS.md', '.agents/AGENTS.md'];
  let allExist = true;
  for (const rel of required) {
    const abs = path.join(root, rel);
    if (existsSync(abs)) {
      report.pass(`agents-md:${rel}`, `${rel} exists`);
    } else {
      report.fail(`agents-md:${rel}`, `${rel} exists`, `missing required file: ${rel}`);
      allExist = false;
    }
  }

  if (!existsSync(path.join(root, 'AGENTS.md'))) return;
  const rootAgents = readTextFile(path.join(root, 'AGENTS.md'));
  for (const rel of ['tests/AGENTS.md', '.agents/AGENTS.md']) {
    if (rootAgents.includes(rel)) {
      report.pass(`agents-md:root-references:${rel}`, `root AGENTS.md references ${rel}`);
    } else {
      report.fail(
        `agents-md:root-references:${rel}`,
        `root AGENTS.md references ${rel}`,
        `root AGENTS.md never mentions ${rel} as a child instruction node`,
      );
    }
  }

  // Every nested AGENTS.md found on disk must be non-empty (a dangling/empty
  // scope file is worse than no file: it silently governs nothing).
  const allAgentsMd = walkFiles(root, {
    skipDirNames: new Set(['node_modules', '.git', 'coverage', '.worktrees']),
  }).filter((p) => path.basename(p) === 'AGENTS.md');
  for (const abs of allAgentsMd) {
    const rel = toPosixRelative(root, abs);
    const text = readTextFile(abs).trim();
    if (text.length > 0) {
      report.pass(`agents-md:non-empty:${rel}`, `${rel} is non-empty`);
    } else {
      report.fail(`agents-md:non-empty:${rel}`, `${rel} is non-empty`, `${rel} is empty`);
    }
  }
}

function checkCodexConfigToml(root, report) {
  const rel = '.codex/config.toml';
  const abs = path.join(root, rel);
  if (!existsSync(abs)) {
    report.fail(`codex-config:parses`, `${rel} parses as TOML`, `missing ${rel}`);
    return;
  }
  try {
    const tables = parseSimpleToml(readTextFile(abs));
    if (!tables['']) throw new Error('expected a top-level table');
    report.pass(`codex-config:parses`, `${rel} parses as TOML`);
  } catch (error) {
    report.fail(`codex-config:parses`, `${rel} parses as TOML`, error.message);
  }
}

function checkCodexAgentsToml(root, report) {
  const relDir = '.codex/agents';
  const absDir = path.join(root, relDir);
  if (!existsSync(absDir)) {
    report.skip(`codex-agents-toml`, `every ${relDir}/*.toml parses and has required fields`, `${relDir} does not exist yet`);
    return;
  }
  const files = readdirSync(absDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.toml'))
    .map((e) => e.name);
  if (files.length === 0) {
    report.skip(`codex-agents-toml`, `every ${relDir}/*.toml parses and has required fields`, `${relDir} exists but contains no .toml files`);
    return;
  }
  const REQUIRED_FIELDS = ['name', 'description', 'developer_instructions'];
  const VALID_SANDBOX_MODES = new Set(['read-only', 'workspace-write', 'danger-full-access']);
  let allOk = true;
  const filesByName = new Map();
  for (const file of files) {
    const rel = `${relDir}/${file}`;
    const abs = path.join(absDir, file);
    let tables;
    try {
      tables = parseSimpleToml(readTextFile(abs));
    } catch (error) {
      report.fail(`codex-agents-toml:${rel}`, `${rel} parses and has required fields`, `parse error: ${error.message}`);
      allOk = false;
      continue;
    }
    const top = tables[''] ?? {};
    const missing = REQUIRED_FIELDS.filter((field) => typeof top[field] !== 'string' || top[field].trim() === '');
    if (missing.length > 0) {
      report.fail(`codex-agents-toml:${rel}`, `${rel} parses and has required fields`, `missing/empty field(s): ${missing.join(', ')}`);
      allOk = false;
    } else {
      report.pass(`codex-agents-toml:${rel}`, `${rel} parses and has required fields`);
    }

    if ('sandbox_mode' in top) {
      if (VALID_SANDBOX_MODES.has(top.sandbox_mode)) {
        report.pass(`codex-agents-toml:${rel}:sandbox-mode`, `${rel} sandbox_mode is a valid enum value`);
      } else {
        report.fail(
          `codex-agents-toml:${rel}:sandbox-mode`,
          `${rel} sandbox_mode is a valid enum value`,
          `sandbox_mode = "${top.sandbox_mode}" is not one of read-only|workspace-write|danger-full-access`,
        );
        allOk = false;
      }
    }

    if (typeof top.name === 'string' && top.name.trim() !== '') {
      const owners = filesByName.get(top.name) ?? [];
      owners.push(rel);
      filesByName.set(top.name, owners);
    }
  }

  const duplicateNames = [...filesByName.entries()].filter(([, owners]) => owners.length > 1);
  if (duplicateNames.length === 0) {
    report.pass(`codex-agents-toml:unique-names`, `every ${relDir}/*.toml "name" is unique`, `${filesByName.size} distinct name(s)`);
  } else {
    report.fail(
      `codex-agents-toml:unique-names`,
      `every ${relDir}/*.toml "name" is unique`,
      duplicateNames.map(([name, owners]) => `"${name}" used by ${owners.join(', ')}`).join('; '),
    );
    allOk = false;
  }

  if (allOk) {
    report.pass(`codex-agents-toml`, `every ${relDir}/*.toml parses and has required fields`, `${files.length} file(s) checked`);
  }
}

// A role that declares itself, in its own description text, as a "writer"
// must not be sandboxed read-only (it could never do its stated job); a role
// that declares itself "read-only" must not carry write authority (a
// misconfiguration that silently grants a reviewer/verifier the ability to
// mutate the workspace). This is deliberately keyed off self-declared role
// text, not agent name/filename, so it works for any repository's agent set,
// not just this one's specific file names.
const WRITER_ROLE_PATTERN = /\bwriter\b/i;
const READ_ONLY_ROLE_PATTERN = /\bread-only\b/i;

function checkAgentRoleSandboxConsistency(root, report) {
  const relDir = '.codex/agents';
  const absDir = path.join(root, relDir);
  if (!existsSync(absDir)) {
    report.skip(`codex-agents-toml:role-sandbox-consistency`, `every self-declared agent role matches its sandbox_mode`, `${relDir} does not exist`);
    return;
  }
  const files = readdirSync(absDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.toml'))
    .map((e) => e.name);
  if (files.length === 0) {
    report.skip(`codex-agents-toml:role-sandbox-consistency`, `every self-declared agent role matches its sandbox_mode`, `${relDir} contains no .toml files`);
    return;
  }

  let anyChecked = false;
  let allOk = true;
  for (const file of files) {
    const rel = `${relDir}/${file}`;
    const abs = path.join(absDir, file);
    let tables;
    try {
      tables = parseSimpleToml(readTextFile(abs));
    } catch {
      continue; // already reported by checkCodexAgentsToml
    }
    const top = tables[''] ?? {};
    const description = typeof top.description === 'string' ? top.description : '';
    const name = typeof top.name === 'string' ? top.name : '';
    const roleText = `${name} ${description}`;
    const sandboxMode = top.sandbox_mode;
    if (typeof sandboxMode !== 'string') continue; // enum validity is checked elsewhere; nothing to compare here

    const declaresWriter = WRITER_ROLE_PATTERN.test(roleText);
    const declaresReadOnly = READ_ONLY_ROLE_PATTERN.test(roleText);

    if (declaresWriter && sandboxMode === 'read-only') {
      anyChecked = true;
      report.fail(
        `codex-agents-toml:${rel}:role-sandbox-consistency`,
        `${rel}'s self-declared role matches its sandbox_mode`,
        `${rel} describes itself as a "writer" role but is sandboxed read-only, so it cannot perform its stated job`,
      );
      allOk = false;
    } else if (declaresReadOnly && sandboxMode !== 'read-only') {
      anyChecked = true;
      report.fail(
        `codex-agents-toml:${rel}:role-sandbox-consistency`,
        `${rel}'s self-declared role matches its sandbox_mode`,
        `${rel} describes itself as "read-only" but sandbox_mode = "${sandboxMode}" grants write authority`,
      );
      allOk = false;
    } else if (declaresWriter || declaresReadOnly) {
      anyChecked = true;
      report.pass(`codex-agents-toml:${rel}:role-sandbox-consistency`, `${rel}'s self-declared role matches its sandbox_mode`);
    }
  }

  if (!anyChecked) {
    report.skip(`codex-agents-toml:role-sandbox-consistency`, `every self-declared agent role matches its sandbox_mode`, 'no agent declared a "writer" or "read-only" role in its name/description');
  } else if (allOk) {
    report.pass(`codex-agents-toml:role-sandbox-consistency`, `every self-declared agent role matches its sandbox_mode`);
  }
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
          if (match) targets.push({ field, path: match[1] });
        }
      }
    }
  }
  return targets;
}

function checkCodexHooksJson(root, report) {
  const rel = '.codex/hooks.json';
  const abs = path.join(root, rel);
  if (!existsSync(abs)) {
    report.fail(`codex-hooks-json:parses`, `${rel} parses as JSON`, `missing ${rel}`);
    return;
  }
  let payload;
  try {
    payload = JSON.parse(readTextFile(abs));
  } catch (error) {
    report.fail(`codex-hooks-json:parses`, `${rel} parses as JSON`, error.message);
    return;
  }
  report.pass(`codex-hooks-json:parses`, `${rel} parses as JSON`);

  const targets = extractHookCommandTargets(payload);
  if (targets.length === 0) {
    report.skip(`codex-hooks-json:targets-exist`, `every ${rel} command target exists`, 'no command targets found to check');
    return;
  }
  let allExist = true;
  const seen = new Set();
  for (const { path: targetPath } of targets) {
    const normalized = targetPath.replace(/\\/g, '/');
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const targetAbs = path.join(root, normalized);
    if (existsSync(targetAbs)) {
      report.pass(`codex-hooks-json:target:${normalized}`, `hook command target ${normalized} exists`);
    } else {
      report.fail(`codex-hooks-json:target:${normalized}`, `hook command target ${normalized} exists`, `referenced from ${rel} but not found on disk`);
      allExist = false;
    }
  }
  if (allExist) {
    report.pass(`codex-hooks-json:targets-exist`, `every ${rel} command target exists`, `${seen.size} target(s) checked`);
  }
}

function checkAgentsSkills(root, report) {
  const relDir = '.agents/skills';
  const absDir = path.join(root, relDir);
  if (!existsSync(absDir)) {
    report.skip(`agents-skills`, `every ${relDir}/<name>/SKILL.md exists and has valid name/description`, `${relDir} does not exist`);
    return;
  }
  const skillDirs = readdirSync(absDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (skillDirs.length === 0) {
    report.skip(`agents-skills`, `every ${relDir}/<name>/SKILL.md exists and has valid name/description`, `${relDir} contains no skill directories`);
    return;
  }
  let allOk = true;
  for (const entry of skillDirs) {
    const rel = `${relDir}/${entry.name}/SKILL.md`;
    const abs = path.join(absDir, entry.name, 'SKILL.md');
    if (!existsSync(abs)) {
      report.fail(`agents-skills:${entry.name}`, `${rel} exists and has valid name/description`, `missing ${rel}`);
      allOk = false;
      continue;
    }
    const frontmatter = parseFrontmatter(readTextFile(abs));
    if (!frontmatter) {
      report.fail(`agents-skills:${entry.name}`, `${rel} exists and has valid name/description`, `missing frontmatter block`);
      allOk = false;
      continue;
    }
    const name = frontmatter.name;
    const description = frontmatter.description;
    const nameValid = typeof name === 'string' && name.trim().length > 0;
    const descriptionValid = typeof description === 'string' && description.trim().length > 0;
    if (nameValid && descriptionValid) {
      report.pass(`agents-skills:${entry.name}`, `${rel} exists and has valid name/description`);
    } else {
      const missing = [!nameValid && 'name', !descriptionValid && 'description'].filter(Boolean).join(', ');
      report.fail(`agents-skills:${entry.name}`, `${rel} exists and has valid name/description`, `missing/empty: ${missing}`);
      allOk = false;
    }
  }
  if (allOk) {
    report.pass(`agents-skills`, `every ${relDir}/<name>/SKILL.md exists and has valid name/description`, `${skillDirs.length} skill(s) checked`);
  }
}

function extractPrefixRuleBlocks(rawText) {
  const text = rawText
    .split(/\r?\n/)
    .map((line) => (line.trim().startsWith('#') ? '' : line))
    .join('\n');
  const blocks = [];
  const marker = 'prefix_rule(';
  let searchFrom = 0;
  for (;;) {
    const start = text.indexOf(marker, searchFrom);
    if (start === -1) break;
    let depth = 0;
    let end = -1;
    for (let i = start + marker.length - 1; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) throw new Error(`unbalanced parentheses in prefix_rule() starting at offset ${start}`);
    blocks.push(text.slice(start, end + 1));
    searchFrom = end + 1;
  }
  return blocks;
}

function codexBinaryAvailable() {
  const probe = spawnSync('codex', ['--version'], { encoding: 'utf8', shell: true });
  return !probe.error && probe.status === 0;
}

function checkWithCodexExecpolicy(rulesAbsPath, commandTokens) {
  const result = spawnSync(
    'codex',
    ['execpolicy', 'check', '-r', rulesAbsPath, '--', ...commandTokens],
    { encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) throw new Error(result.stderr || `codex execpolicy check exited ${result.status}`);
  return JSON.parse(result.stdout).decision;
}

function checkCodexRules(root, report) {
  const relDir = '.codex/rules';
  const absDir = path.join(root, relDir);
  if (!existsSync(absDir)) {
    report.fail(`codex-rules:exist`, `${relDir}/*.rules exist`, `missing directory ${relDir}`);
    return;
  }
  const files = readdirSync(absDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.rules'))
    .map((e) => e.name);
  if (files.length === 0) {
    report.fail(`codex-rules:exist`, `${relDir}/*.rules exist`, `${relDir} contains no .rules files`);
    return;
  }
  report.pass(`codex-rules:exist`, `${relDir}/*.rules exist`, `${files.length} file(s) found`);

  const liveCodexAvailable = codexBinaryAvailable();
  for (const file of files) {
    const rel = `${relDir}/${file}`;
    const abs = path.join(absDir, file);
    const text = readTextFile(abs);
    let blocks;
    try {
      blocks = extractPrefixRuleBlocks(text);
    } catch (error) {
      report.fail(`codex-rules:structural:${file}`, `${rel} is a well-formed execpolicy file`, error.message);
      continue;
    }
    if (blocks.length === 0) {
      report.fail(`codex-rules:structural:${file}`, `${rel} is a well-formed execpolicy file`, 'no prefix_rule() entries found');
      continue;
    }
    report.pass(`codex-rules:structural:${file}`, `${rel} is a well-formed execpolicy file`, `${blocks.length} prefix_rule() entrie(s)`);

    if (!liveCodexAvailable) {
      report.skip(`codex-rules:live:${file}`, `${rel} verified through the real codex execpolicy checker`, 'codex CLI is not installed in this environment');
      continue;
    }
    const CASES = [
      { tokens: ['git', 'push', '--force', 'origin', 'main'], expect: 'forbidden' },
      { tokens: ['git', 'status'], expect: 'allow' },
      { tokens: ['git', 'commit', '-m', 'x'], expect: 'prompt' },
    ];
    let liveOk = true;
    for (const { tokens, expect } of CASES) {
      try {
        const decision = checkWithCodexExecpolicy(abs, tokens);
        if (decision !== expect) {
          report.fail(
            `codex-rules:live:${file}:${tokens.join(' ')}`,
            `codex execpolicy decides "${expect}" for: ${tokens.join(' ')}`,
            `codex execpolicy returned "${decision}"`,
          );
          liveOk = false;
        }
      } catch (error) {
        report.fail(`codex-rules:live:${file}:${tokens.join(' ')}`, `codex execpolicy decides "${expect}" for: ${tokens.join(' ')}`, error.message);
        liveOk = false;
      }
    }
    if (liveOk) {
      report.pass(`codex-rules:live:${file}`, `${rel} verified through the real codex execpolicy checker`, `${CASES.length} case(s) checked`);
    }
  }
}

const CLAUDE_SDK_PATTERNS = [
  { name: '@anthropic-ai import/require', regex: /@anthropic-ai\/[\w-]+/ },
  { name: 'claude_agent_sdk import', regex: /claude[_-]agent[_-]sdk/i },
  { name: 'ClaudeSDK invocation', regex: /\bClaudeSDK\b/ },
  { name: 'anthropic.Anthropic( client construction', regex: /\banthropic\.Anthropic\s*\(/ },
  { name: 'Claude Code slash-command frontmatter', regex: /allowed-tools\s*:/ },
];

function checkNoClaudeSdkUnderCodex(root, report) {
  const relDir = '.codex';
  const absDir = path.join(root, relDir);
  if (!existsSync(absDir)) {
    report.skip(`no-claude-sdk-under-codex`, `no Claude SDK/import/invocation appears under ${relDir}/**`, `${relDir} does not exist`);
    return;
  }
  const files = walkFiles(absDir);
  const findings = [];
  for (const abs of files) {
    let text;
    try {
      text = readTextFile(abs);
    } catch {
      continue; // binary/unreadable file, not a text-based SDK reference
    }
    for (const { name, regex } of CLAUDE_SDK_PATTERNS) {
      if (regex.test(text)) {
        findings.push(`${toPosixRelative(root, abs)} :: ${name}`);
      }
    }
  }
  if (findings.length === 0) {
    report.pass(`no-claude-sdk-under-codex`, `no Claude SDK/import/invocation appears under ${relDir}/**`, `${files.length} file(s) scanned`);
  } else {
    report.fail(`no-claude-sdk-under-codex`, `no Claude SDK/import/invocation appears under ${relDir}/**`, findings.join('; '));
  }
}

const STALE_IDENTIFIER_PATTERNS = [
  { name: 'desktop-ai-client project identifier', regex: /desktop-ai-client/i },
  { name: 'Tauri/Rust-only path or artifact', regex: /src-tauri\/|tauri\.conf\.json|\bcargo\.toml\b/i },
  { name: 'unrelated memory-engine contract', regex: /memory-engine/i },
];

function checkNoStaleIdentifiersUnderCodex(root, report) {
  const relDir = '.codex';
  const absDir = path.join(root, relDir);
  if (!existsSync(absDir)) {
    report.skip(`no-stale-identifiers-under-codex`, `no stale project identifiers appear in active Codex policy (${relDir}/**)`, `${relDir} does not exist`);
    return;
  }
  const files = walkFiles(absDir);
  const findings = [];
  for (const abs of files) {
    let text;
    try {
      text = readTextFile(abs);
    } catch {
      continue;
    }
    for (const { name, regex } of STALE_IDENTIFIER_PATTERNS) {
      if (regex.test(text)) {
        findings.push(`${toPosixRelative(root, abs)} :: ${name}`);
      }
    }
  }
  if (findings.length === 0) {
    report.pass(`no-stale-identifiers-under-codex`, `no stale project identifiers appear in active Codex policy (${relDir}/**)`, `${files.length} file(s) scanned`);
  } else {
    report.fail(`no-stale-identifiers-under-codex`, `no stale project identifiers appear in active Codex policy (${relDir}/**)`, findings.join('; '));
  }
}

function checkRequiredControlPlaneFilesNotIgnored(root, report) {
  if (!isGitRepo(root)) {
    report.skip(`control-plane-not-ignored`, `no required control-plane file is ignored`, 'not a git repository');
    return;
  }
  const required = [
    'AGENTS.md',
    'tests/AGENTS.md',
    '.agents/AGENTS.md',
    '.codex/config.toml',
    '.codex/hooks.json',
  ];
  const absDirsToGlob = [
    ['.codex/rules', /\.rules$/],
    ['.codex/hooks', /\.js$/],
  ];
  for (const [relDir, matcher] of absDirsToGlob) {
    const absDir = path.join(root, relDir);
    if (!existsSync(absDir)) continue;
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      if (entry.isFile() && matcher.test(entry.name)) required.push(`${relDir}/${entry.name}`);
    }
  }
  const skillsDir = path.join(root, '.agents/skills');
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const skillMd = `.agents/skills/${entry.name}/SKILL.md`;
        if (existsSync(path.join(root, skillMd))) required.push(skillMd);
      }
    }
  }

  let allOk = true;
  let checkedAny = false;
  for (const rel of required) {
    if (!existsSync(path.join(root, rel))) continue; // existence is asserted by its own check
    const ignored = gitCheckIgnored(root, rel);
    if (ignored === null) continue; // git unavailable mid-loop; treated as skip below
    checkedAny = true;
    if (ignored) {
      report.fail(`control-plane-not-ignored:${rel}`, `${rel} is not hidden by .gitignore`, `${rel} is matched by a .gitignore pattern`);
      allOk = false;
    } else {
      report.pass(`control-plane-not-ignored:${rel}`, `${rel} is not hidden by .gitignore`);
    }
  }
  if (!checkedAny) {
    report.skip(`control-plane-not-ignored`, `no required control-plane file is ignored`, 'no required files present to check, or git check-ignore unavailable');
  } else if (allOk) {
    report.pass(`control-plane-not-ignored`, `no required control-plane file is ignored`, `${required.length} path(s) checked`);
  }
}

const REFERENCE_PATTERN = /`((?:[.\w-]+\/)+[.\w-]+\.(?:md|json|toml|js|mjs|rules|py))`/g;
const REFERENCE_ALLOWLIST = new Set([
  '.claude/settings.local.json',
  '.claude/handoff/current-task.json',
  'managed-settings.json',
]);

function checkReferencedLocalFilesExist(root, report) {
  const sources = ['AGENTS.md', '.agents/AGENTS.md', 'tests/AGENTS.md'];
  let allOk = true;
  let checkedAny = false;
  for (const rel of sources) {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) continue;
    const text = readTextFile(abs);
    for (const match of text.matchAll(REFERENCE_PATTERN)) {
      const refRaw = match[1].trim();
      if (REFERENCE_ALLOWLIST.has(refRaw)) continue;
      if (refRaw.includes('<') || refRaw.includes('*')) continue;
      const refPath = refRaw.replace(/\//g, path.sep);
      // A relative reference (`../x`, `./x`) is resolved, in order, against:
      // the directory the referencing file lives in (the usual case); each
      // of that directory's immediate subdirectories (docs sometimes phrase
      // a relative import path from the perspective of a file *inside* a
      // child directory — e.g. tests/AGENTS.md's "`../helpers/mock-dom.mjs`"
      // is written for tests/security/*.test.mjs, not for tests/AGENTS.md
      // itself); and finally repo-root-relative, for paths that already read
      // as repo-rooted. First candidate that exists on disk wins.
      const sourceDir = path.dirname(abs);
      const candidates = [path.resolve(sourceDir, refPath)];
      if (existsSync(sourceDir)) {
        for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
          if (entry.isDirectory()) candidates.push(path.resolve(sourceDir, entry.name, refPath));
        }
      }
      candidates.push(path.join(root, refPath));
      const refAbs = candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
      checkedAny = true;
      if (existsSync(refAbs)) {
        report.pass(`referenced-files:${rel}:${refRaw}`, `${rel} references existing path: ${refRaw}`);
      } else {
        report.fail(`referenced-files:${rel}:${refRaw}`, `${rel} references existing path: ${refRaw}`, `${rel} references ${refRaw}, which does not exist on disk`);
        allOk = false;
      }
    }
  }
  if (!checkedAny) {
    report.skip(`referenced-local-files-exist`, `every referenced local file exists`, 'no eligible source files or no path references found');
  } else if (allOk) {
    report.pass(`referenced-local-files-exist`, `every referenced local file exists`);
  }
}

const COMMIT_SHA_PATTERN = /\b[0-9a-f]{40}\b/i;

function checkEvidenceIdentifiesSourceCommit(root, report, resolvedCommit) {
  if (resolvedCommit) {
    report.pass(`evidence:this-run-identifies-commit`, `this verification run's output identifies its source commit`, resolvedCommit);
  } else {
    report.fail(`evidence:this-run-identifies-commit`, `this verification run's output identifies its source commit`, 'could not resolve HEAD (not a git repository, or git unavailable)');
  }

  const evidenceFiles = ['docs/control-plane/CURRENT_STATE.md', 'docs/control-plane/MIGRATION_CONTRACT.md'];
  let anyFound = false;
  for (const rel of evidenceFiles) {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) continue;
    anyFound = true;
    const text = readTextFile(abs);
    if (COMMIT_SHA_PATTERN.test(text)) {
      report.pass(`evidence:identifies-commit:${rel}`, `${rel} identifies its source commit`);
    } else {
      report.fail(`evidence:identifies-commit:${rel}`, `${rel} identifies its source commit`, `${rel} contains no 40-character commit SHA`);
    }
  }
  if (!anyFound) {
    report.skip(`evidence:generated-docs-identify-commit`, `generated evidence documents identify their source commit`, 'no docs/control-plane/*.md evidence files found');
  }
}

function checkProductionBoundaryLanguage(root, report) {
  const rel = 'AGENTS.md';
  const abs = path.join(root, rel);
  if (!existsSync(abs)) {
    report.fail(`production-boundary-language`, `${rel} states a production-boundary policy`, `missing ${rel}`);
    return;
  }
  const text = readTextFile(abs);
  const hasProduction = /production/i.test(text);
  const hasDeployOrPublish = /\b(deploy|publish|publication)\b/i.test(text);
  const hasReleaseGate = /\b(netlify|main branch|release[- ]?operator|explicit human authorization)\b/i.test(text);
  if (hasProduction && hasDeployOrPublish && hasReleaseGate) {
    report.pass(`production-boundary-language`, `${rel} states a production-boundary policy`);
  } else {
    const missing = [!hasProduction && 'production', !hasDeployOrPublish && 'deploy/publish', !hasReleaseGate && 'release-gate language'].filter(Boolean);
    report.fail(`production-boundary-language`, `${rel} states a production-boundary policy`, `missing signal(s): ${missing.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Claude compatibility check — informational only, never authoritative.
// Condensed from the retired .claude/hooks/validators/control-plane-check.js:
// only checks that structural pieces of a Claude-Code-shaped control plane,
// if present, are internally consistent. Absence of .claude/** is not a
// failure of this repository's (Codex-native) control plane.
// ---------------------------------------------------------------------------

function runClaudeCompatibilityCheck(root, report) {
  const claudeDir = path.join(root, '.claude');
  if (!existsSync(claudeDir)) {
    report.addInformational(
      `claude-compat`,
      `Claude Code compatibility check (informational, non-authoritative)`,
      'SKIPPED',
      '.claude/ is absent from disk — legacy Claude control plane not installed',
    );
    return;
  }

  const findings = [];

  const settingsPath = path.join(claudeDir, 'settings.json');
  if (existsSync(settingsPath)) {
    try {
      JSON.parse(readTextFile(settingsPath));
    } catch (error) {
      findings.push(`.claude/settings.json :: ${error.message}`);
    }
  }

  const agentsDir = path.join(claudeDir, 'agents');
  if (existsSync(agentsDir)) {
    for (const entry of readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;
      const relPath = `.claude/agents/${entry.name}`;
      const frontmatter = parseFrontmatter(readTextFile(path.join(agentsDir, entry.name)));
      if (!frontmatter) {
        findings.push(`${relPath} :: missing frontmatter block`);
        continue;
      }
      for (const key of ['name', 'description']) {
        if (!frontmatter[key]) findings.push(`${relPath} :: missing ${key}`);
      }
    }
  }

  const commandsDir = path.join(claudeDir, 'commands');
  if (existsSync(commandsDir)) {
    for (const entry of readdirSync(commandsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;
      const relPath = `.claude/commands/${entry.name}`;
      const frontmatter = parseFrontmatter(readTextFile(path.join(commandsDir, entry.name)));
      if (!frontmatter || !frontmatter.description) {
        findings.push(`${relPath} :: missing description`);
      }
    }
  }

  if (findings.length === 0) {
    report.addInformational(`claude-compat`, `Claude Code compatibility check (informational, non-authoritative)`, 'PASS', '.claude/** found and internally consistent');
  } else {
    report.addInformational(`claude-compat`, `Claude Code compatibility check (informational, non-authoritative)`, 'FAIL', findings.join('; '));
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function runVerification(root) {
  const report = new Report();

  checkAgentsMdTopology(root, report);
  checkCodexConfigToml(root, report);
  checkCodexAgentsToml(root, report);
  checkAgentRoleSandboxConsistency(root, report);
  checkCodexHooksJson(root, report);
  checkAgentsSkills(root, report);
  checkCodexRules(root, report);
  checkNoClaudeSdkUnderCodex(root, report);
  checkNoStaleIdentifiersUnderCodex(root, report);
  checkRequiredControlPlaneFilesNotIgnored(root, report);
  checkReferencedLocalFilesExist(root, report);
  const commit = sourceCommit(root);
  checkEvidenceIdentifiesSourceCommit(root, report, commit);
  checkProductionBoundaryLanguage(root, report);
  runClaudeCompatibilityCheck(root, report);

  const authoritativeFailures = report.checks.filter((c) => c.authoritative && c.status === 'FAIL');
  const summary = {
    total: report.checks.length,
    pass: report.checks.filter((c) => c.status === 'PASS').length,
    fail: report.checks.filter((c) => c.status === 'FAIL').length,
    skipped: report.checks.filter((c) => c.status === 'SKIPPED').length,
    authoritativeFail: authoritativeFailures.length,
  };

  return {
    tool: 'tools/control-plane/verify.mjs',
    sourceCommit: commit,
    root,
    summary,
    checks: report.checks,
    ok: authoritativeFailures.length === 0,
  };
}

function printHumanSummary(result) {
  const lines = [];
  lines.push(`Control-plane verification — source commit: ${result.sourceCommit ?? '(unknown — not a git repo)'}`);
  lines.push(`root: ${result.root}`);
  lines.push('');
  for (const check of result.checks) {
    const tag = check.authoritative ? check.status : `${check.status} (informational)`;
    const line = `[${tag}] ${check.id} — ${check.description}`;
    lines.push(check.detail ? `${line}\n    ${check.detail}` : line);
  }
  lines.push('');
  lines.push(
    `Summary: ${result.summary.pass} pass, ${result.summary.fail} fail, ${result.summary.skipped} skipped ` +
      `(${result.summary.authoritativeFail} authoritative failure(s)). Overall: ${result.ok ? 'PASS' : 'FAIL'}`,
  );
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root ? path.resolve(args.root) : path.resolve(__dirname, '..', '..');
  const result = runVerification(root);

  if (!args.json) {
    process.stdout.write(printHumanSummary(result) + '\n');
    process.stdout.write('===JSON===\n');
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  process.exitCode = result.ok ? 0 : 1;
}

const isMainModule = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMainModule) {
  main();
}
