#!/usr/bin/env node
// PreToolUse hook: blocks writes to hard-protected paths (secrets, .git
// internals, credential material) and flags writes to control-plane paths
// for human review. Covers Bash-invoked writes, Codex's native `apply_patch`
// tool, and IDE-style Edit/Write tool payloads.
//
// Fail-conservative by design: this hook's whole job is a security decision
// (may this write proceed?), so whenever it cannot confidently classify a
// call — unparseable input, an apply_patch with no recognizable file
// target, an Edit/Write call with no path — it denies rather than allows.
// A malformed decision here must never silently permit a dangerous write.
//
// Overlap note: destructive *shell commands* (rm -rf, git reset --hard,
// force-push, publish, etc.) are already owned by .codex/rules/default.rules
// (Codex-native execpolicy, evaluated before this hook even runs). This
// hook does not re-implement that command-level policy; it only covers the
// gap execpolicy cannot see — *file targets* written via apply_patch/Edit/
// Write, which carry no shell command for execpolicy to inspect at all.
// See docs/control-plane/hooks-policy-map.md.
'use strict';

const { readStdinJson, normalizeSlashes, extractApplyPatchPaths, writeJson } = require('./_shared');

// These test against either a single extracted file path (apply_patch,
// Edit/Write) or an entire Bash command string (no reliable way to extract
// "the path" from an arbitrary shell command without a full parser) — so
// none of these anchor on end-of-string ($). A pattern is deliberately a
// plain substring match; over-flagging a command that merely mentions one
// of these tokens is an acceptable cost for a fail-conservative hook,
// under-flagging a real write is not.
const HARD_DENY = [
  /\.env\b/i,
  /\.git\//i,
  /(?:^|[\s/])(?:secrets|private|credentials)\//i,
  /id_rsa|id_ed25519|\.pem|\.key/i,
  /(?:^|[^a-z0-9-])(secret|private-key|credential)(?:$|[^a-z0-9-])/i,
];

// Paths that are control-plane content per docs/control-plane/MIGRATION_CONTRACT.md
// section 2 (target topology) and section 1 (governing separations). Writable,
// but flagged: Codex hooks cannot issue an "ask" permissionDecision yet (parsed
// but not supported), so this is advisory context, not a gate.
const SOFT_ADVISORY = [
  /(?:^|[\s/])AGENTS\.md\b/i,
  /(?:^|[\s/])CLAUDE\.md\b/i,
  /\.codex\//i,
  /\.agents\//i,
  /\.github\/workflows\//i,
  /netlify\.toml\b/i,
  /security\/constitution\.md\b/i,
  /managed-settings(?:\.example)?\.json\b/i,
];

const WRITE_VERB = /\b(?:cp|mv|copy|copy-item|move-item|set-content|out-file|tee|sed\s+-i)\b|(?:>>?|>\|)/i;

function classify(paths) {
  for (const p of paths) {
    if (HARD_DENY.some((rx) => rx.test(p))) return { level: 'deny', path: p };
  }
  for (const p of paths) {
    if (SOFT_ADVISORY.some((rx) => rx.test(p))) return { level: 'advisory', path: p };
  }
  return null;
}

function allow() {
  process.exit(0);
}

function deny(reason) {
  writeJson({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  });
  process.stderr.write(`guard-protected-writes: deny — ${reason}\n`);
  process.exit(0);
}

function advisoryAllow(context) {
  writeJson({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      additionalContext: context,
    },
  });
  process.exit(0);
}

async function main() {
  let payload;
  try {
    payload = await readStdinJson();
  } catch (err) {
    deny(`could not parse hook input (${err.message}); denying by default per fail-conservative policy.`);
    return;
  }

  try {
    const toolName = String(payload.tool_name || '');
    const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};
    let candidatePaths = [];

    if (toolName === 'Bash') {
      const command = normalizeSlashes(String(input.command || ''));
      if (!WRITE_VERB.test(command)) {
        allow();
        return;
      }
      candidatePaths = [command];
    } else if (toolName === 'apply_patch') {
      const patch = String(input.command || input.patch || '');
      candidatePaths = extractApplyPatchPaths(patch).map(normalizeSlashes);
      if (candidatePaths.length === 0) {
        deny('apply_patch call carried no recognizable file target; denying by default per fail-conservative policy.');
        return;
      }
    } else if (toolName === 'Edit' || toolName === 'Write') {
      const filePath = String(input.file_path || input.path || '');
      if (!filePath) {
        deny('Edit/Write call carried no file path; denying by default per fail-conservative policy.');
        return;
      }
      candidatePaths = [normalizeSlashes(filePath)];
    } else {
      allow();
      return;
    }

    const hit = classify(candidatePaths);
    if (!hit) {
      allow();
      return;
    }

    if (hit.level === 'deny') {
      deny(`protected path write blocked: ${hit.path}`);
      return;
    }

    advisoryAllow(
      `Control-plane path touched: ${hit.path}. This concern is governed by docs/control-plane/MIGRATION_CONTRACT.md; ` +
      'treat this diff as requiring explicit human review before commit/merge. This hook cannot enforce an "ask" gate ' +
      '(Codex\'s permissionDecision "ask" is parsed but not yet supported) — it is advisory only, not sole authorization.',
    );
  } catch (err) {
    deny(`unexpected error while classifying this call (${err.message}); denying by default per fail-conservative policy.`);
  }
}

main().catch((err) => {
  deny(`unhandled hook failure (${err.message}); denying by default per fail-conservative policy.`);
});
