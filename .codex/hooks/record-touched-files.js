#!/usr/bin/env node
// PostToolUse hook: records which tool touched which file/command and its
// outcome, as additionalContext the model can cite as evidence later. This
// intentionally does NOT run a formatter or any other side-effecting
// command — silently reformatting a file the agent just wrote would hide
// what the agent actually produced from later diff review, and "do not
// silently run broad formatters" is an explicit requirement of this hook.
// Advisory only: any failure here must never affect the tool call itself,
// since the call already completed by the time PostToolUse fires.
'use strict';

const { readStdinJson, normalizeSlashes, extractApplyPatchPaths, writeJson } = require('./_shared');

function emit(summary) {
  writeJson({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: summary,
    },
  });
}

function describeTarget(toolName, input) {
  if (toolName === 'Bash') {
    return `command: ${String(input.command || '').trim()}`;
  }
  if (toolName === 'apply_patch') {
    const paths = extractApplyPatchPaths(String(input.command || input.patch || '')).map(normalizeSlashes);
    return paths.length > 0 ? `file(s): ${paths.join(', ')}` : 'file(s): (unrecognized apply_patch target)';
  }
  if (toolName === 'Edit' || toolName === 'Write') {
    return `file: ${normalizeSlashes(String(input.file_path || input.path || '(unknown)'))}`;
  }
  return null;
}

function describeOutcome(response) {
  if (!response || typeof response !== 'object') return 'outcome: unknown';
  if (typeof response.exit_code === 'number') return `exit_code: ${response.exit_code}`;
  if (typeof response.exitCode === 'number') return `exit_code: ${response.exitCode}`;
  if (response.success === false) return 'outcome: reported failure';
  return 'outcome: completed';
}

async function main() {
  let payload;
  try {
    payload = await readStdinJson();
  } catch {
    process.exit(0);
    return;
  }

  try {
    const toolName = String(payload.tool_name || '');
    const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};
    const target = describeTarget(toolName, input);
    if (!target) {
      process.exit(0);
      return;
    }
    const outcome = describeOutcome(payload.tool_response);
    emit(`Evidence: [${toolName}] ${target} (${outcome})`);
    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main().catch(() => process.exit(0));
