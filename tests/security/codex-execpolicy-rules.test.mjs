// Deterministic control-plane validation for .codex/rules/default.rules,
// the real Codex CLI execpolicy file that replaced the Markdown pseudo-rule
// previously at .codex/rules/control-plane.md.
//
// This does not require the `codex` binary to be installed: the required
// assertions (decision-by-pattern, narrow-prefix discipline) are checked
// structurally against the Starlark source text, since the repository is
// zero-install and CI must not depend on an external CLI being present. If
// `codex` *is* on PATH, an additional block re-verifies the same decisions
// through the real `codex execpolicy check` parser/evaluator for the
// strongest possible signal; that block is skipped (not failed) when the
// binary is unavailable, matching this repo's "report skipped checks
// explicitly" rule (AGENTS.md, "Testing and verification").

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.join(__dirname, '..', '..', '.codex', 'rules', 'default.rules');
const RULES_TEXT = readFileSync(RULES_PATH, 'utf8');

function stripCommentLines(text) {
  // Full-line `#` comments only (this file never puts a `#` inside a string
  // literal), so a plain line-prefix check is safe and avoids matching
  // `prefix_rule(` mentioned in prose inside this file's own header comment.
  return text
    .split(/\r?\n/)
    .map((line) => (line.trim().startsWith('#') ? '' : line))
    .join('\n');
}

function extractPrefixRuleBlocks(rawText) {
  const text = stripCommentLines(rawText);
  const blocks = [];
  const marker = 'prefix_rule(';
  let searchFrom = 0;
  for (;;) {
    const start = text.indexOf(marker, searchFrom);
    if (start === -1) break;
    let depth = 0;
    let end = -1;
    for (let i = start + marker.length - 1; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    assert.notEqual(end, -1, `unbalanced parentheses in prefix_rule() starting at offset ${start}`);
    blocks.push(text.slice(start, end + 1));
    searchFrom = end + 1;
  }
  return blocks;
}

function decisionOf(block) {
  const m = block.match(/decision\s*=\s*"([a-z]+)"/);
  return m ? m[1] : 'allow';
}

// Returns just the `pattern = [ ... ]` segment of a rule block (balanced
// brackets), so token checks below never accidentally match a `match`/
// `not_match` example or a justification string that happens to mention
// the same words for an unrelated command.
function extractPatternSegment(block) {
  const start = block.indexOf('pattern');
  const bracketStart = block.indexOf('[', start);
  assert.notEqual(bracketStart, -1, `rule has no pattern = [...]:\n${block}`);
  let depth = 0;
  for (let i = bracketStart; i < block.length; i++) {
    if (block[i] === '[') depth++;
    else if (block[i] === ']') {
      depth--;
      if (depth === 0) return block.slice(bracketStart, i + 1);
    }
  }
  throw new Error(`unbalanced pattern brackets:\n${block}`);
}

function hasExactPattern(block, tokens) {
  const inner = tokens.map((t) => `"${t}"`).join(',\\s*');
  const re = new RegExp(`^\\[\\s*${inner}\\s*\\]$`);
  return re.test(extractPatternSegment(block));
}

function containsAllQuoted(block, tokens) {
  const pattern = extractPatternSegment(block);
  return tokens.every((t) => pattern.includes(`"${t}"`));
}

const RULE_BLOCKS = extractPrefixRuleBlocks(RULES_TEXT);

test('.codex/rules/default.rules exists and defines prefix_rule() policy', () => {
  assert.ok(RULES_TEXT.trim().length > 0, 'rules file must not be empty');
  assert.ok(RULE_BLOCKS.length >= 10, 'expected a substantive set of prefix_rule() entries');
});

test('every prefix_rule() carries a justification', () => {
  for (const block of RULE_BLOCKS) {
    assert.match(
      block,
      /justification\s*=\s*"[^"]+"/,
      `missing/empty justification in rule:\n${block}`,
    );
  }
});

test('no rule uses a bare single-token top-level program prefix (e.g. ["git"], ["gh"], ["rm"])', () => {
  const banned = ['git', 'gh', 'rm', 'npm', 'yarn', 'pnpm', 'node', 'bash', 'sh', 'zsh', 'powershell', 'pwsh', 'netlify'];
  for (const name of banned) {
    const re = new RegExp(`pattern\\s*=\\s*\\[\\s*"${name}"\\s*\\]`);
    assert.doesNotMatch(RULES_TEXT, re, `rule uses an over-broad bare prefix ["${name}"]`);
  }
});

const REQUIRED_DECISIONS = [
  { name: 'destructive rm -rf is forbidden', tokens: ['rm', '-rf'], decision: 'forbidden' },
  { name: 'destructive rm --recursive --force is forbidden', tokens: ['rm', '--recursive', '--force'], decision: 'forbidden' },
  { name: 'destructive Remove-Item -Recurse -Force is forbidden', tokens: ['Remove-Item', '-Recurse', '-Force'], decision: 'forbidden' },
  { name: 'git reset --hard is forbidden', tokens: ['git', 'reset', '--hard'], decision: 'forbidden' },
  { name: 'git clean -f is forbidden', tokens: ['git', 'clean', '-f'], decision: 'forbidden' },
  { name: 'force push (--force/-f/--force-with-lease) is forbidden', tokens: ['git', 'push', '--force-with-lease'], decision: 'forbidden' },
  { name: 'package publication (npm publish) is forbidden', tokens: ['npm', 'publish'], decision: 'forbidden' },
  { name: 'package publication (yarn publish) is forbidden', tokens: ['yarn', 'publish'], decision: 'forbidden' },
  { name: 'package publication (pnpm publish) is forbidden', tokens: ['pnpm', 'publish'], decision: 'forbidden' },
  { name: 'direct Netlify production deploy is forbidden', tokens: ['netlify', 'deploy', '--prod'], decision: 'forbidden' },
  { name: 'git commit requires review (prompt)', tokens: ['git', 'commit'], decision: 'prompt' },
  { name: 'gh pr merge requires review (prompt)', tokens: ['gh', 'pr', 'merge'], decision: 'prompt' },
  { name: 'gh release create requires review (prompt)', tokens: ['gh', 'release', 'create'], decision: 'prompt' },
  { name: 'git status is a safe, allowed inspection command', tokens: ['git', 'status'], decision: 'allow' },
  { name: 'git diff is a safe, allowed inspection command', tokens: ['git', 'diff'], decision: 'allow' },
  { name: 'git log is a safe, allowed inspection command', tokens: ['git', 'log'], decision: 'allow' },
  { name: 'git show is a safe, allowed inspection command', tokens: ['git', 'show'], decision: 'allow' },
];

for (const { name, tokens, decision } of REQUIRED_DECISIONS) {
  test(name, () => {
    const block = RULE_BLOCKS.find((b) => containsAllQuoted(b, tokens));
    assert.ok(block, `no prefix_rule() found containing tokens: ${tokens.join(' ')}`);
    assert.equal(decisionOf(block), decision, `expected decision "${decision}" for ${tokens.join(' ')}`);
  });
}

test('netlify deploy (non-prod, exact pattern) requires review (prompt)', () => {
  const block = RULE_BLOCKS.find((b) => hasExactPattern(b, ['netlify', 'deploy']));
  assert.ok(block, 'no prefix_rule() with exact pattern ["netlify", "deploy"]');
  assert.equal(decisionOf(block), 'prompt');
});

test('bare "git push" (no force flag) requires review, not silent allow or hard block', () => {
  const block = RULE_BLOCKS.find((b) => hasExactPattern(b, ['git', 'push']));
  assert.ok(block, 'no prefix_rule() with exact pattern ["git", "push"]');
  assert.equal(decisionOf(block), 'prompt');
});

test('a longer, more specific forbidden rule can only make the effective decision stricter, never looser', () => {
  // Structural corollary of codex-execpolicy's documented "strictest match wins"
  // resolution: the broad "git push" -> prompt rule and the narrower
  // "git push --force" -> forbidden rule must both exist so that a force
  // push is never silently downgraded to a mere prompt.
  const broad = RULE_BLOCKS.find((b) => hasExactPattern(b, ['git', 'push']));
  const narrow = RULE_BLOCKS.find(
    (b) => containsAllQuoted(b, ['git', 'push', '--force']) && !hasExactPattern(b, ['git', 'push']),
  );
  assert.ok(broad && narrow, 'expected both a broad git push rule and a narrower force-push rule');
  assert.equal(decisionOf(broad), 'prompt');
  assert.equal(decisionOf(narrow), 'forbidden');
});

test('.gitignore does not hide .codex/rules/*.rules from version control', () => {
  const gitignorePath = path.join(__dirname, '..', '..', '.gitignore');
  // `-q` (quiet, no `-v`) gives the documented, unambiguous exit code:
  // 0 = the path is actually excluded, 1 = it is not excluded. (`-v` alone
  // prints the last matching pattern, including a negation match, and is
  // not meant to be read as a plain ignored/not-ignored exit code.)
  const result = spawnSync('git', ['check-ignore', '-q', String(RULES_PATH)], {
    cwd: path.join(__dirname, '..', '..'),
  });
  if (result.error) {
    throw new Error(`could not run git check-ignore: ${result.error.message}`);
  }
  assert.notEqual(
    result.status,
    0,
    `.codex/rules/default.rules must not be gitignored (see ${gitignorePath})`,
  );
});

function codexAvailable() {
  const probe = spawnSync('codex', ['--version'], { encoding: 'utf8', shell: true });
  return !probe.error && probe.status === 0;
}

function checkWithCodex(commandTokens) {
  const result = spawnSync(
    'codex',
    ['execpolicy', 'check', '-r', RULES_PATH, '--', ...commandTokens],
    { encoding: 'utf8', shell: true },
  );
  assert.equal(result.status, 0, `codex execpolicy check failed: ${result.stderr}`);
  return JSON.parse(result.stdout).decision;
}

const LIVE_CODEX_AVAILABLE = codexAvailable();

test(
  'live codex execpolicy check confirms decisions for the required edge cases',
  { skip: !LIVE_CODEX_AVAILABLE && 'codex CLI is not installed in this environment' },
  () => {
    assert.equal(checkWithCodex(['git', 'push', '--force', 'origin', 'main']), 'forbidden');
    assert.equal(checkWithCodex(['git', 'push', '--force-with-lease', 'origin', 'main']), 'forbidden');
    assert.equal(checkWithCodex(['git', 'push', 'origin', 'main']), 'prompt');
    assert.equal(checkWithCodex(['git', 'diff', 'HEAD~1']), 'allow');
    assert.equal(checkWithCodex(['echo', 'git', 'push', '--force']), undefined);
    assert.equal(checkWithCodex(['git', 'reset', '--hard']), 'forbidden');
    assert.equal(checkWithCodex(['npm', 'publish']), 'forbidden');
    assert.equal(checkWithCodex(['netlify', 'deploy', '--prod']), 'forbidden');
  },
);
