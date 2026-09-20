#!/usr/bin/env node
// Shared helpers for freeforge-chat's Codex CLI hooks (.codex/hooks/*.js).
//
// Deliberately dependency-free (repository is zero-install) and uses
// execFileSync (never a shell) for every git call, so nothing here is
// vulnerable to command-injection via hook input.
'use strict';

const { execFileSync } = require('child_process');

function readStdinJson() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error(`invalid JSON on stdin: ${err.message}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

// Normalizes Windows-style backslash paths to forward slashes so a single
// set of regexes can match both `secrets\keys.pem` and `secrets/keys.pem`.
function normalizeSlashes(value) {
  return String(value).replace(/\\/g, '/');
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

// Resolves the Git repository root from a starting directory. Never trusts
// an env var (no $CLAUDE_PROJECT_DIR equivalent) or an absolute path baked
// into config — always derived from the session's own `cwd`.
function resolveRepoRoot(startDir) {
  return git(['rev-parse', '--show-toplevel'], startDir);
}

// Extracts file targets from a Codex `apply_patch` payload body, e.g.:
//   *** Add File: path/to/new.txt
//   *** Update File: path/to/existing.txt
//   *** Move to: path/to/renamed.txt
//   *** Delete File: path/to/gone.txt
function extractApplyPatchPaths(patchText) {
  const paths = [];
  const re = /^\*\*\* (Add File|Update File|Delete File|Move to):\s*(.+)$/gm;
  let match;
  while ((match = re.exec(String(patchText))) !== null) {
    paths.push(match[2].trim());
  }
  return paths;
}

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj));
}

module.exports = {
  readStdinJson,
  normalizeSlashes,
  git,
  resolveRepoRoot,
  extractApplyPatchPaths,
  writeJson,
};
