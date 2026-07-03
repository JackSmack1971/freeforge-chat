#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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
    const file = String(payload.tool_input?.file_path || payload.toolInput?.file_path || payload.tool_input?.path || payload.toolInput?.path || '');
    const normalizedFile = file.replace(/\\/g, '/');
    if (!normalizedFile || /node_modules|dist|build|coverage|\.git/.test(normalizedFile)) process.exit(0);
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const prettier = findLocalPrettier(projectDir);
    if (!prettier) process.exit(0);

    // Cheap, best-effort formatting only. Full formatting belongs in /quality-gate.
    if (/\.(ts|tsx|js|jsx|json|md|css|scss|yaml|yml)$/.test(normalizedFile)) {
      const absoluteFile = path.isAbsolute(file) ? file : path.join(projectDir, file);
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
