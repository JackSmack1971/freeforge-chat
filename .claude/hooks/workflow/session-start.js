#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
function sh(cmd, cwd) {
  try { return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return 'unavailable'; }
}
function readHandoff(projectDir) {
  const handoffPath = path.join(projectDir, '.claude', 'handoff', 'current-task.json');
  if (!fs.existsSync(handoffPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(handoffPath, 'utf8'));
  } catch {
    return { invalid: true };
  }
}
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const branch = sh('git branch --show-current', projectDir);
const status = sh('git status --short', projectDir);
const repoRoot = sh('git rev-parse --show-toplevel', projectDir);
const handoff = readHandoff(projectDir);
const lines = ['Swarm session initialized.'];

if (branch !== 'unavailable') {
  lines.push(`Branch: ${branch}`);
}

if (status === 'unavailable') {
  lines.push('Workspace status unavailable. Initialize git or restart Claude from the intended repository root.');
} else if (status) {
  lines.push(`Dirty workspace:\n${status}`);
} else {
  lines.push('Workspace clean.');
}

if (repoRoot !== 'unavailable' && path.resolve(repoRoot) !== path.resolve(projectDir)) {
  lines.push(`Launch warning: Claude started from ${projectDir}, but git root is ${repoRoot}. Restart from the repository root so local settings, hooks, and path-scoped rules apply predictably.`);
}

if (handoff?.invalid) {
  lines.push('Saved handoff state is invalid JSON. Repair `.claude/handoff/current-task.json` before relying on it.');
} else if (handoff?.objective) {
  lines.push(`Saved objective: ${handoff.objective}`);
  if (typeof handoff.updated_at === 'string' && handoff.updated_at) {
    lines.push(`Saved at: ${handoff.updated_at}`);
  }
  if (Array.isArray(handoff.next_actions) && handoff.next_actions.length > 0) {
    lines.push(`Next actions: ${handoff.next_actions.slice(0, 3).join(' | ')}`);
  }
  if (Array.isArray(handoff.open_risks) && handoff.open_risks.length > 0) {
    lines.push(`Open risks: ${handoff.open_risks.slice(0, 2).join(' | ')}`);
  }
  lines.push('Use /resume-handoff to load the saved state into the next work cycle.');
}

lines.push('Use /swarm for complex work and /quality-gate before commit.');
process.stdout.write(lines.join('\n'));
