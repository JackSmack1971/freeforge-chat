#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const claudeDir = path.join(projectDir, '.claude');
const findings = [];

function ensureExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    findings.push(`MISSING ${path.relative(projectDir, targetPath)}`);
    return false;
  }
  return true;
}

function parseJson(relativePath) {
  const absolutePath = path.join(projectDir, relativePath);
  if (!ensureExists(absolutePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    findings.push(`JSON ${relativePath} :: ${error.message}`);
    return null;
  }
}

function checkJavaScript(relativePath) {
  const absolutePath = path.join(projectDir, relativePath);
  if (!ensureExists(absolutePath)) return;
  try {
    let source = fs.readFileSync(absolutePath, 'utf8');
    if (relativePath.startsWith('.claude/workflows/')) {
      source = source.replace(/\bexport\s+/g, '');
      source = `async function __workflow__() {\n${source}\n}\n`;
    }
    new vm.Script(source, { filename: absolutePath });
  } catch (error) {
    findings.push(`SYNTAX ${relativePath} :: ${error.message}`);
  }
}

function scanFlatMarkdownDir(relativeDir) {
  const absoluteDir = path.join(projectDir, relativeDir);
  if (!ensureExists(absoluteDir)) return;
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    if (!/\.md$/i.test(entry.name)) {
      findings.push(`UNEXPECTED ${path.posix.join(relativeDir.replace(/\\/g, '/'), entry.name)}`);
    }
  }
}

function parseFrontmatter(relativePath) {
  const absolutePath = path.join(projectDir, relativePath);
  if (!ensureExists(absolutePath)) return null;
  const source = fs.readFileSync(absolutePath, 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    findings.push(`FRONTMATTER ${relativePath} :: missing frontmatter block`);
    return null;
  }

  const result = {};
  let currentKey = null;
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentKey) {
      result[currentKey] ||= [];
      result[currentKey].push(listMatch[1].trim());
      continue;
    }
    const fieldMatch = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!fieldMatch) continue;
    currentKey = fieldMatch[1];
    const value = fieldMatch[2].trim();
    if (!value) {
      result[currentKey] = [];
      continue;
    }
    result[currentKey] = value.replace(/^["']|["']$/g, '');
  }
  return result;
}

function readMarkdownBody(relativePath) {
  const absolutePath = path.join(projectDir, relativePath);
  if (!ensureExists(absolutePath)) return '';
  const source = fs.readFileSync(absolutePath, 'utf8');
  const match = source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return match ? match[1] : source;
}

function shellPatternToRegex(allowedTool) {
  const match = String(allowedTool).match(/^Bash\((.*)\)$/);
  if (!match) return null;
  const escaped = match[1]
    .replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function hasHardcodedAbsolutePath(command) {
  const normalized = String(command)
    .replace(/\$CLAUDE_PROJECT_DIR/g, 'CLAUDE_PROJECT_DIR')
    .replace(/\$HOME/g, 'HOME')
    .replace(/%USERPROFILE%/gi, 'USERPROFILE')
    .replace(/(^|[\s"'`(])~(?=[\\/])/g, '$1HOME');
  return /(?:^|[\s"'`(])(?:[A-Za-z]:[\\/]|\/(?![/*]))/.test(normalized);
}

function validateEmbeddedShellAccess(relativePath, frontmatter, kind) {
  const body = readMarkdownBody(relativePath);
  const snippets = [...body.matchAll(/!`([^`]+)`/g)].map(match => match[1].trim());
  if (snippets.length === 0) return;
  const allowedTools = Array.isArray(frontmatter['allowed-tools']) ? frontmatter['allowed-tools'] : [];
  const bashMatchers = allowedTools.map(shellPatternToRegex).filter(Boolean);
  for (const snippet of snippets) {
    if (!bashMatchers.some(regex => regex.test(snippet))) {
      findings.push(`${kind} ${relativePath} :: shell snippet not allowlisted: ${snippet}`);
    }
  }
}

function validateAgent(relativePath) {
  const frontmatter = parseFrontmatter(relativePath);
  if (!frontmatter) return;
  for (const key of ['name', 'description', 'model', 'permissionMode', 'maxTurns']) {
    if (!frontmatter[key] || (Array.isArray(frontmatter[key]) && frontmatter[key].length === 0)) {
      findings.push(`AGENT ${relativePath} :: missing ${key}`);
    }
  }
  const tools = Array.isArray(frontmatter.tools) ? frontmatter.tools : [];
  const disallowedTools = Array.isArray(frontmatter.disallowedTools) ? frontmatter.disallowedTools : [];
  const isWriter = tools.some(tool => ['Write', 'Edit', 'MultiEdit'].includes(tool));
  if (isWriter && frontmatter.isolation !== 'worktree') {
    findings.push(`AGENT ${relativePath} :: writer agent missing isolation: worktree`);
  }
  if (!disallowedTools.includes('Agent')) {
    findings.push(`AGENT ${relativePath} :: disallowedTools should include Agent`);
  }
}

function validateCommandOrSkill(relativePath, kind) {
  const frontmatter = parseFrontmatter(relativePath);
  if (!frontmatter) return;
  if (!frontmatter.description) {
    findings.push(`${kind} ${relativePath} :: missing description`);
  }
  if (kind !== 'OUTPUT_STYLE' && !Array.isArray(frontmatter['allowed-tools'])) {
    findings.push(`${kind} ${relativePath} :: missing allowed-tools list`);
  }
  if ((kind === 'SKILL' || kind === 'OUTPUT_STYLE') && !frontmatter.name) {
    findings.push(`${kind} ${relativePath} :: missing name`);
  }
  if (kind === 'COMMAND' || kind === 'SKILL') {
    validateEmbeddedShellAccess(relativePath, frontmatter, kind);
  }
}

function validateRule(relativePath) {
  const frontmatter = parseFrontmatter(relativePath);
  if (!frontmatter) return;
  if (!Array.isArray(frontmatter.paths) || frontmatter.paths.length === 0) {
    findings.push(`RULE ${relativePath} :: missing paths list`);
  }
}

function validateHandoffSchema(relativePath, payload) {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    findings.push(`HANDOFF ${relativePath} :: expected object`);
    return;
  }
  if (typeof payload.objective !== 'string') {
    findings.push(`HANDOFF ${relativePath} :: objective must be a string`);
  }
  if (typeof payload.updated_at !== 'string') {
    findings.push(`HANDOFF ${relativePath} :: updated_at must be a string`);
  } else if (payload.updated_at && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(payload.updated_at)) {
    findings.push(`HANDOFF ${relativePath} :: updated_at must be empty or ISO 8601 UTC`);
  }
  for (const key of ['changed_files', 'validation_run', 'open_risks', 'next_actions']) {
    if (!Array.isArray(payload[key])) {
      findings.push(`HANDOFF ${relativePath} :: ${key} must be an array`);
    }
  }
}

function validateMcpConfig(relativePath, payload) {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    findings.push(`MCP ${relativePath} :: expected object`);
    return;
  }
  if ('mcpServers' in payload && (typeof payload.mcpServers !== 'object' || payload.mcpServers === null || Array.isArray(payload.mcpServers))) {
    findings.push(`MCP ${relativePath} :: mcpServers must be an object when present`);
  }
}

function validateManagedSettings(relativePath, payload) {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    findings.push(`MANAGED ${relativePath} :: expected object`);
    return;
  }
  if ('permissions' in payload && (typeof payload.permissions !== 'object' || payload.permissions === null || Array.isArray(payload.permissions))) {
    findings.push(`MANAGED ${relativePath} :: permissions must be an object when present`);
  }
  if ('enabledMcpjsonServers' in payload && !Array.isArray(payload.enabledMcpjsonServers)) {
    findings.push(`MANAGED ${relativePath} :: enabledMcpjsonServers must be an array when present`);
  }
}

function validateMarkdownReferences(relativePath) {
  const body = readMarkdownBody(relativePath);
  const optionalPathRefs = new Set([
    '.mcp.json',
    'managed-settings.json',
    'AGENTS.md',
    '.claude/settings.local.json',
    '.claude/handoff/current-task.json'
  ]);

  for (const match of body.matchAll(/`\/([a-z0-9-]+)\b/g)) {
    const commandName = match[1];
    const commandPath = path.join(projectDir, '.claude', 'commands', `${commandName}.md`);
    if (!fs.existsSync(commandPath)) {
      findings.push(`REFERENCE ${relativePath} :: missing command /${commandName}`);
    }
  }

  for (const match of body.matchAll(/`((?:\.claude\/|managed-settings(?:\.example)?\.json|managed-settings\.json|\.mcp\.json|CLAUDE\.md|AGENTS\.md)[^`]*)`/g)) {
    const rawRef = match[1].trim();
    if (!rawRef || rawRef.includes('*') || rawRef.includes('<') || rawRef.includes('>')) continue;
    if (optionalPathRefs.has(rawRef)) continue;
    const normalizedRef = rawRef.replace(/\//g, path.sep);
    const targetPath = path.join(projectDir, normalizedRef);
    if (!fs.existsSync(targetPath)) {
      findings.push(`REFERENCE ${relativePath} :: missing path ${rawRef}`);
    }
  }
}

function failIfGitignoreStillHides(targetPath) {
  const result = spawnSync('git', ['check-ignore', '-v', targetPath], {
    cwd: projectDir,
    encoding: 'utf8'
  });
  if (result.status === 0 && result.stdout.trim()) {
    findings.push(`GITIGNORE ${targetPath} :: ${result.stdout.trim()}`);
  }
}

ensureExists(path.join(projectDir, 'CLAUDE.md'));
ensureExists(claudeDir);

failIfGitignoreStillHides('.claude/rules/control-plane.md');
failIfGitignoreStillHides('.codex/rules/control-plane.md');
failIfGitignoreStillHides('docs/label-taxonomy.md');

const settings = parseJson('.claude/settings.json');
const handoffTemplate = parseJson('.claude/handoff/current-task.template.json');
if (handoffTemplate) validateHandoffSchema('.claude/handoff/current-task.template.json', handoffTemplate);
const mcpConfigPath = path.join(projectDir, '.mcp.json');
if (fs.existsSync(mcpConfigPath)) {
  const mcpConfig = parseJson('.mcp.json');
  if (mcpConfig) validateMcpConfig('.mcp.json', mcpConfig);
}
const managedSettingsExample = parseJson('managed-settings.example.json');
if (managedSettingsExample) validateManagedSettings('managed-settings.example.json', managedSettingsExample);
const managedSettingsPath = path.join(projectDir, 'managed-settings.json');
if (fs.existsSync(managedSettingsPath)) {
  const managedSettings = parseJson('managed-settings.json');
  if (managedSettings) validateManagedSettings('managed-settings.json', managedSettings);
}
const currentHandoffPath = path.join(projectDir, '.claude', 'handoff', 'current-task.json');
if (fs.existsSync(currentHandoffPath)) {
  try {
    const currentHandoff = JSON.parse(fs.readFileSync(currentHandoffPath, 'utf8'));
    validateHandoffSchema('.claude/handoff/current-task.json', currentHandoff);
  } catch (error) {
    findings.push(`JSON .claude/handoff/current-task.json :: ${error.message}`);
  }
}

scanFlatMarkdownDir('.claude/agents');
scanFlatMarkdownDir('.claude/commands');
scanFlatMarkdownDir('.claude/output-styles');
scanFlatMarkdownDir('.claude/rules');

const agentsDir = path.join(claudeDir, 'agents');
if (ensureExists(agentsDir)) {
  for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
    if (entry.isFile() && /\.md$/i.test(entry.name)) {
      validateAgent(path.posix.join('.claude/agents', entry.name));
    }
  }
}

const commandsDir = path.join(claudeDir, 'commands');
if (ensureExists(commandsDir)) {
  for (const entry of fs.readdirSync(commandsDir, { withFileTypes: true })) {
    if (entry.isFile() && /\.md$/i.test(entry.name)) {
      const relativePath = path.posix.join('.claude/commands', entry.name);
      validateCommandOrSkill(relativePath, 'COMMAND');
      validateMarkdownReferences(relativePath);
    }
  }
}

const outputStylesDir = path.join(claudeDir, 'output-styles');
if (ensureExists(outputStylesDir)) {
  for (const entry of fs.readdirSync(outputStylesDir, { withFileTypes: true })) {
    if (entry.isFile() && /\.md$/i.test(entry.name)) {
      const relativePath = path.posix.join('.claude/output-styles', entry.name);
      validateCommandOrSkill(relativePath, 'OUTPUT_STYLE');
      validateMarkdownReferences(relativePath);
    }
  }
}

const rulesDir = path.join(claudeDir, 'rules');
if (ensureExists(rulesDir)) {
  for (const entry of fs.readdirSync(rulesDir, { withFileTypes: true })) {
    if (entry.isFile() && /\.md$/i.test(entry.name)) {
      const relativePath = path.posix.join('.claude/rules', entry.name);
      validateRule(relativePath);
      validateMarkdownReferences(relativePath);
    }
  }
}

const skillsDir = path.join(claudeDir, 'skills');
if (ensureExists(skillsDir)) {
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    const skillPath = path.join(skillsDir, entry.name);
    if (!entry.isDirectory()) {
      findings.push(`UNEXPECTED .claude/skills/${entry.name}`);
      continue;
    }
    const skillRelativePath = path.posix.join('.claude/skills', entry.name, 'SKILL.md');
    ensureExists(path.join(skillPath, 'SKILL.md'));
    validateCommandOrSkill(skillRelativePath, 'SKILL');
    validateMarkdownReferences(skillRelativePath);
  }
}

for (const relativePath of ['CLAUDE.md', 'README-SWARM.md', '.claude/handoff/README.md']) {
  validateMarkdownReferences(relativePath);
}

for (const relativeDir of ['.claude/hooks/validators', '.claude/hooks/workflow', '.claude/workflows']) {
  const absoluteDir = path.join(projectDir, relativeDir);
  if (!fs.existsSync(absoluteDir)) continue;
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.isFile() && /\.(js|ts)$/i.test(entry.name)) {
      checkJavaScript(path.posix.join(relativeDir.replace(/\\/g, '/'), entry.name));
    }
  }
}

if (settings?.hooks) {
  for (const hookGroups of Object.values(settings.hooks)) {
    for (const hookGroup of hookGroups || []) {
      for (const hook of hookGroup.hooks || []) {
        const rawCommand = String(hook.command || '');
        const command = rawCommand
          .replace(/\$CLAUDE_PROJECT_DIR/g, projectDir)
          .replace(/^node\s+/, '')
          .replace(/^"(.*)"$/, '$1')
          .trim();
        if (!command) continue;
        if (hasHardcodedAbsolutePath(rawCommand)) {
          findings.push(`HOOK settings.json :: hardcoded absolute path in hook command: ${rawCommand}`);
        }
        const targetPath = path.isAbsolute(command) ? command : path.join(projectDir, command);
        ensureExists(targetPath);
      }
    }
  }
}

const summary = {
  status: findings.length === 0 ? 'PASS' : 'FAIL',
  checkedRoot: projectDir,
  findings
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
process.exit(findings.length === 0 ? 0 : 1);
