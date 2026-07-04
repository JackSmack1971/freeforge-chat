#!/usr/bin/env node
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input || '{}');
    const toolName = String(payload.tool_name || payload.toolName || '').toLowerCase();
    const url = String(
      payload.tool_input?.url ||
      payload.toolInput?.url ||
      payload.tool_input?.href ||
      payload.toolInput?.href ||
      ''
    );
    const command = String(
      payload.tool_input?.command ||
      payload.toolInput?.command ||
      ''
    );
    const normalizedCommand = command.replace(/\s+/g, ' ').trim();

    const allowlistedHosts = [
      /(^|\.)github\.com$/i,
      /(^|\.)raw\.githubusercontent\.com$/i,
      /(^|\.)docs\.github\.com$/i,
      /(^|\.)nodejs\.org$/i,
      /(^|\.)developer\.mozilla\.org$/i,
      /(^|\.)registry\.npmjs\.org$/i,
      /(^|\.)docs\.npmjs\.com$/i,
      /(^|\.)pnpm\.io$/i,
      /(^|\.)yarnpkg\.com$/i,
      /(^|\.)bun\.sh$/i,
      /(^|\.)react\.dev$/i,
      /(^|\.)nextjs\.org$/i,
      /(^|\.)tailwindcss\.com$/i,
      /(^|\.)netlify\.com$/i,
      /(^|\.)vercel\.com$/i,
      /(^|\.)openai\.com$/i,
      /(^|\.)platform\.openai\.com$/i
    ];

    if (toolName === 'webfetch') {
      let hostname = '';
      try {
        hostname = new URL(url).hostname.toLowerCase();
      } catch {
        hostname = '';
      }

      if (!hostname || !allowlistedHosts.some(rx => rx.test(hostname))) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `WebFetch host is not on the allowlist: ${url || '(missing url)'}`
          }
        }));
        process.exit(2);
      }

      process.exit(0);
    }

    if (toolName === 'bash') {
      const uploadTools = /\b(curl|wget|invoke-webrequest|iwr|irm)\b/i;
      const uploadShapes = /\b(--data(?:-binary)?|--post-data|--body-data|--form|-T|-InFile)\b|@\S+|\b(get-content|cat|type)\b/i;
      const urlMatch = normalizedCommand.match(/\bhttps?:\/\/[^\s"'`]+/i);

      if (urlMatch) {
        let hostname = '';
        try {
          hostname = new URL(urlMatch[0]).hostname.toLowerCase();
        } catch {
          hostname = '';
        }

        if (!hostname || !allowlistedHosts.some(rx => rx.test(hostname))) {
          process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: `Bash network host is not on the allowlist: ${urlMatch[0]}`
            }
          }));
          process.exit(2);
        }
      }

      if (uploadTools.test(normalizedCommand) && uploadShapes.test(normalizedCommand)) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'ask',
            permissionDecisionReason: `Outbound data transfer requires human approval by swarm policy: ${normalizedCommand}`
          }
        }));
        process.exit(0);
      }
    }

    process.exit(0);
  } catch (err) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `web-access-guard hook failed closed: ${err.message}`
      }
    }));
    process.exit(2);
  }
});
