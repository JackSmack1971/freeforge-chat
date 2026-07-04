#!/usr/bin/env node
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input || '{}');
    const toolName = String(payload.tool_name || payload.toolName || '').toLowerCase();
    const path = String(
      payload.tool_input?.file_path ||
      payload.toolInput?.file_path ||
      payload.tool_input?.path ||
      payload.toolInput?.path ||
      ''
    );
    const command = String(
      payload.tool_input?.command ||
      payload.toolInput?.command ||
      ''
    );
    const normalizedPath = path.replace(/\\/g, '/');
    const normalizedCommand = command.replace(/\s+/g, ' ').trim();
    const writesProtectedFiles = /\b(?:cp|mv|copy-item|set-content|out-file|tee|sed\s+-i)\b|(?:>>?|>\|)/i;
    const subject = toolName === 'bash' ? normalizedCommand : normalizedPath;

    const denyPatterns = [
      /\.env(?:\.|$)/i,
      /\.git\//i,
      /(?:secrets|private|credentials)\//i,
      /id_rsa|id_ed25519|\.pem|\.key/i,
      /(?:^|[^a-z0-9-])(secret|private-key|credential)(?:$|[^a-z0-9-])/i
    ];
    const askPatterns = [
      /\.mcp\.json/i,
      /managed-settings\.json/i,
      /\.claude\/settings\.json/i,
      /\.claude\/settings\.local\.json/i,
      /\.claude\/agents\/.+\.md/i,
      /\.claude\/commands\/.+\.md/i,
      /\.claude\/hooks\/.+\.(js|ts)/i,
      /\.claude\/output-styles\/.+\.md/i,
      /\.claude\/rules\/.+\.md/i,
      /\.claude\/skills\/[^/\s"'`]+\/SKILL\.md/i,
      /\.claude\/workflows\/.+\.(js|ts)/i,
      /\b(?:CLAUDE|AGENTS)\.md\b/i
    ];

    if (toolName === 'bash' && !writesProtectedFiles.test(normalizedCommand)) {
      process.exit(0);
    }

    if (denyPatterns.some(rx => rx.test(subject))) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Protected file write blocked by swarm policy: ${subject}`
        }
      }));
      process.exit(2);
    }

    if (askPatterns.some(rx => rx.test(subject))) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: `Settings change requires human approval by swarm policy: ${subject}`
        }
      }));
      process.exit(0);
    }
    process.exit(0);
  } catch (err) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `protect-files hook failed closed: ${err.message}`
      }
    }));
    process.exit(2);
  }
});
