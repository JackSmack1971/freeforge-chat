#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function extractBashWriteTargets(command) {
  const targets = [];
  const patterns = [
    /(?:^|[\s;|&])(?:\d+?>|>>|>\|)\s*(?:"([^"]+)"|'([^']+)'|([^\s;|&]+))/g,
    /(?:^|[\s;|&])tee(?:\s+-a)?\s+(?:"([^"]+)"|'([^']+)'|([^\s;|&]+))/g
  ];

  for (const pattern of patterns) {
    for (const match of command.matchAll(pattern)) {
      const target = match[1] || match[2] || match[3] || '';
      if (target) {
        targets.push(target.replace(/[)"'`]+$/g, ''));
      }
    }
  }

  return targets;
}

function findLocalPrettier(projectDir) {
  const binName = process.platform === 'win32' ? 'prettier.cmd' : 'prettier';
  const direct = path.join(projectDir, 'node_modules', '.bin', binName);
  return fs.existsSync(direct) ? direct : null;
}

let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input || '{}');
    const toolName = String(payload.tool_name || payload.toolName || '').toLowerCase();
    const command = String(payload.tool_input?.command || payload.toolInput?.command || '');
    const file = String(
      payload.tool_input?.file_path ||
      payload.toolInput?.file_path ||
      payload.tool_input?.path ||
      payload.toolInput?.path ||
      ''
    );
    const bashWriteTargets = toolName === 'bash' ? extractBashWriteTargets(command.replace(/\s+/g, ' ').trim()) : [];
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const prettier = findLocalPrettier(projectDir);
    if (!prettier) process.exit(0);

    // Cheap, best-effort formatting only. Full formatting belongs in /quality-gate.
    const candidateFiles = toolName === 'bash' && bashWriteTargets.length ? bashWriteTargets : [file];
    for (const candidate of [...new Set(candidateFiles.map(entry => String(entry || '').trim()).filter(Boolean))]) {
      const normalizedFile = candidate.replace(/\\/g, '/');
      if (!normalizedFile || /node_modules|dist|build|coverage|\.git/.test(normalizedFile)) continue;
      if (!/\.(ts|tsx|js|jsx|json|md|css|scss|yaml|yml)$/.test(normalizedFile)) continue;

      const absoluteFile = path.isAbsolute(candidate) ? candidate : path.join(projectDir, candidate);
      if (fs.existsSync(absoluteFile) && fs.statSync(absoluteFile).size <= 512 * 1024) {
        spawnSync(prettier, ['--write', absoluteFile], { stdio: 'ignore' });
      }
    }
    process.exit(0);
  } catch (err) {
    process.stderr.write(`format hook skipped: ${err.message}\n`);
    process.exit(0);
  }
});
