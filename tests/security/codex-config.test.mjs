// Validates .codex/config.toml: proves it parses as TOML, and that no
// obsolete/dangerous Codex CLI settings are present. See
// docs/control-plane/policy-map.md for the full setting-by-setting
// rationale this test is checking against.
//
// This implements a minimal TOML reader rather than depending on a TOML
// library: the repository is zero-install (see AGENTS.md, tests/AGENTS.md —
// "no test framework install required") and has no TOML parser available.
// The reader only needs to cover this file's grammar: comments, top-level
// key = value pairs, [table] headers, booleans, quoted strings, and
// integers. It intentionally throws on anything it does not recognize
// (arrays, nested/dotted tables, multi-line strings, etc.) so a config file
// that grows beyond this grammar fails the test loudly instead of being
// silently mis-parsed.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', '..', '.codex', 'config.toml');

function parseValue(raw) {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^"(?:[^"\\]|\\.)*"$/.test(v)) {
    return v.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  throw new Error(`Unsupported TOML value grammar: ${raw}`);
}

// Minimal TOML reader for flat tables of scalar key = value pairs.
// Returns { "": {...top-level...}, "table.name": {...} }.
function parseSimpleToml(text) {
  const tables = { '': {} };
  let current = '';
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = stripComment(rawLine).trim();
    if (line === '') continue;

    const tableMatch = line.match(/^\[([A-Za-z0-9_.]+)\]$/);
    if (tableMatch) {
      current = tableMatch[1];
      if (!(current in tables)) tables[current] = {};
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!kvMatch) {
      throw new Error(`Unparseable TOML line: ${rawLine}`);
    }
    const [, key, rawValue] = kvMatch;
    tables[current][key] = parseValue(rawValue);
  }

  return tables;
}

function stripComment(line) {
  // No strings in this file contain '#', so a plain split is safe here.
  const idx = line.indexOf('#');
  return idx === -1 ? line : line.slice(0, idx);
}

test('.codex/config.toml parses as valid TOML', () => {
  const text = readFileSync(CONFIG_PATH, 'utf8');
  const tables = parseSimpleToml(text);
  assert.ok(tables[''], 'expected a top-level table');
});

test('.codex/config.toml does not set approval_policy to a retired or dangerous value', () => {
  const text = readFileSync(CONFIG_PATH, 'utf8');
  const tables = parseSimpleToml(text);
  const value = tables['']?.approval_policy;
  const forbidden = ['untrusted', 'on-failure', 'full-auto', 'suggest', 'auto-edit', 'never'];
  if (value !== undefined) {
    assert.ok(
      !forbidden.includes(value),
      `approval_policy must not be a retired/dangerous value, got: ${value}`,
    );
  }
});

test('.codex/config.toml does not force danger-full-access sandbox mode', () => {
  const text = readFileSync(CONFIG_PATH, 'utf8');
  const tables = parseSimpleToml(text);
  const value = tables['']?.sandbox_mode;
  assert.notEqual(value, 'danger-full-access');
});

test('.codex/config.toml keeps the workspace-write sandbox network-isolated', () => {
  const text = readFileSync(CONFIG_PATH, 'utf8');
  const tables = parseSimpleToml(text);
  const sandboxTable = tables.sandbox_workspace_write;
  assert.ok(sandboxTable, 'expected a [sandbox_workspace_write] table');
  assert.equal(sandboxTable.network_access, false);
});

test('.codex/config.toml hardens login-shell semantics', () => {
  const text = readFileSync(CONFIG_PATH, 'utf8');
  const tables = parseSimpleToml(text);
  assert.equal(tables['']?.allow_login_shell, false);
});

test('.codex/config.toml bounds multi-agent concurrency', () => {
  const text = readFileSync(CONFIG_PATH, 'utf8');
  const tables = parseSimpleToml(text);
  const agentsTable = tables.agents;
  assert.ok(agentsTable, 'expected an [agents] table');
  assert.equal(typeof agentsTable.max_concurrent_threads_per_session, 'number');
  assert.ok(
    agentsTable.max_concurrent_threads_per_session > 0 &&
      agentsTable.max_concurrent_threads_per_session <= 8,
    'max_concurrent_threads_per_session should be small and bounded for a small JS repo',
  );
});

test('.codex/config.toml declares no external MCP servers', () => {
  const text = readFileSync(CONFIG_PATH, 'utf8');
  const tables = parseSimpleToml(text);
  const mcpTables = Object.keys(tables).filter((name) => name.startsWith('mcp_servers'));
  assert.equal(mcpTables.length, 0, 'no mcp_servers.* tables should be configured');
});

test('.codex/config.toml does not set model/provider or trust keys (left to inheritance)', () => {
  const text = readFileSync(CONFIG_PATH, 'utf8');
  const tables = parseSimpleToml(text);
  assert.equal(tables['']?.model, undefined);
  assert.equal(tables['']?.sandbox_mode, undefined);
  assert.equal(tables['']?.approval_policy, undefined);
  const projectTrustTables = Object.keys(tables).filter((name) => name.startsWith('projects.'));
  assert.equal(projectTrustTables.length, 0, 'trust_level must not be self-declared in-repo');
});
