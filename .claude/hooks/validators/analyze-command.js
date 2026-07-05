#!/usr/bin/env node
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input || '{}');
    const cmd = String(payload.tool_input?.command || payload.toolInput?.command || '');
    const normalized = cmd.replace(/\s+/g, ' ').trim();

    const deny = [
      /\brm\s+-rf\s+(\/|~|\*|\.\.)/i,
      /\b(remove-item|ri|del|erase)\b.*\b(-recurse|-force|\/s|\/q)\b/i,
      /\bformat-volume\b|\bformat\s+[a-z]:/i,
      /\bsudo\b/i,
      /\bchmod\s+-R\s+777\b/i,
      /\bchown\s+-R\b/i,
      /\b(git\s+push\s+--force|git\s+push\s+-f)\b/i,
      /\bgit\s+reset\s+--hard\b/i,
      /\bgit\s+clean\b.*\b-f\b/i,
      /(curl|wget)\b.*\|\s*(sh|bash|zsh)/i,
      /\bnpm\s+publish\b|\bpnpm\s+publish\b|\byarn\s+npm\s+publish\b/i,
      /\bbun\s+publish\b/i,
      /\bkubectl\s+(delete|apply|replace|patch)\b/i,
      /\bterraform\s+apply\b/i,
      /\bdrop\s+(database|schema|table)\b/i,
      /\btruncate\s+table\b/i
    ];
    const writesProtectedFiles = /\b(?:cp|mv|copy-item|set-content|out-file|tee|sed\s+-i)\b|(?:>>?|>\|)/i;
    const hardProtectedPaths = [
      /\.env(?:\.|$)/i,
      /\.git\//i,
      /(?:secrets|private|credentials)\//i,
      /id_rsa|id_ed25519|\.pem|\.key/i,
      /(?:^|[^a-z0-9-])(secret|private-key|credential)(?:$|[^a-z0-9-])/i
    ];
    const approvalProtectedPaths = [
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

    for (const pattern of deny) {
      if (pattern.test(normalized)) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `Blocked dangerous command by swarm policy: ${normalized}`
          }
        }));
        process.exit(2);
      }
    }

    if (writesProtectedFiles.test(normalized)) {
      for (const pattern of hardProtectedPaths) {
        if (pattern.test(normalized)) {
          process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: `Blocked protected file write by swarm policy: ${normalized}`
            }
          }));
          process.exit(2);
        }
      }

      for (const pattern of approvalProtectedPaths) {
        if (pattern.test(normalized)) {
          process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'ask',
              permissionDecisionReason: `Settings change requires human approval by swarm policy: ${normalized}`
            }
          }));
          process.exit(0);
        }
      }
    }

    const needsApproval = /\b(deploy|migration|migrate|db:push|prisma\s+migrate|gh\s+pr\s+merge|npm\s+ci|npm\s+install|npm\s+add|pnpm\s+install|pnpm\s+add|yarn\s+add|yarn\s+install|bun\s+add|bun\s+install|uv\s+add|uv\s+sync|pip\s+install|poetry\s+add|cargo\s+add|go\s+get|docker\s+compose\s+(up|down)|kubectl\s+(create|rollout|scale)|terraform\s+plan|git\s+(rebase|cherry-pick|reset))\b/i;
    if (needsApproval.test(normalized)) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: `Command requires human approval by swarm policy: ${normalized}`
        }
      }));
      process.exit(0);
    }

    process.exit(0);
  } catch (err) {
    process.stderr.write(`analyze-command hook failed: ${err.message}\n`);
    process.exit(1);
  }
});
