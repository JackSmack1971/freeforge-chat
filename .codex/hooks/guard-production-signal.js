#!/usr/bin/env node
// PreToolUse hook: flags production-sensitive shell operations (push,
// merge, publish, deploy, migrations) with an advisory note. This hook is
// defense-in-depth, not sole authorization — it never denies a call.
//
// .codex/rules/default.rules already carries the real, enforced decision
// (forbidden/prompt/allow) for the specific command shapes it lists (git
// push --force, git commit, git push, gh pr merge, gh release create,
// netlify deploy --prod, npm/yarn/pnpm publish, etc.) via Codex's native
// execpolicy engine — see docs/control-plane/policy-map.md and
// tests/security/codex-execpolicy-rules.test.mjs. This hook does not
// duplicate that gate; it adds visibility for compound/non-prefix
// invocations execpolicy's ordered-token prefix matching may not catch
// (e.g. `npm run build && git push origin main`), and restates the
// human-authorization requirement inline. See
// docs/control-plane/hooks-policy-map.md for the full overlap rationale.
'use strict';

const { readStdinJson, writeJson } = require('./_shared');

const PRODUCTION_SIGNAL = new RegExp(
  [
    'git\\s+push',
    'git\\s+merge',
    'gh\\s+pr\\s+merge',
    'gh\\s+release\\s+create',
    'npm\\s+publish',
    'yarn\\s+publish',
    'pnpm\\s+publish',
    'bun\\s+publish',
    'netlify\\s+deploy',
    'vercel\\s+(?:deploy|--prod)',
    'docker\\s+push',
    'kubectl\\s+(?:apply|delete|replace|patch)',
    'terraform\\s+apply',
    '\\bmigrate\\b',
    'db:push',
    'prisma\\s+migrate',
    'git\\s+tag',
  ].join('|'),
  'i',
);

function allow(context) {
  if (context) {
    writeJson({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        additionalContext: context,
      },
    });
  }
  process.exit(0);
}

async function main() {
  let payload;
  try {
    payload = await readStdinJson();
  } catch {
    // Advisory hook: malformed input degrades safely (allow, no comment).
    allow();
    return;
  }

  try {
    const toolName = String(payload.tool_name || '');
    if (toolName !== 'Bash') {
      allow();
      return;
    }
    const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};
    const command = String(input.command || '');

    if (!PRODUCTION_SIGNAL.test(command)) {
      allow();
      return;
    }

    allow(
      `Production-sensitive operation detected: ${command.trim()}. Requires explicit human authorization per AGENTS.md's ` +
      'Release-operator role and docs/control-plane/MIGRATION_CONTRACT.md section 3.8 (merging/pushing to main triggers ' +
      'Netlify auto-deploy with no separate gate). This hook is defense-in-depth only — it does not grant or withhold ' +
      'permission; .codex/rules/default.rules is the authoritative execpolicy layer for this command\'s allow/forbid/prompt decision.',
    );
  } catch {
    allow();
  }
}

main().catch(() => allow());
