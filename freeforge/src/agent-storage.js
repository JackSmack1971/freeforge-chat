import { generateAgentId, normalizeAgent } from './agent-schema.js';
import { LS } from './state.js';

const AGENT_STORAGE_KEY = 'ff_agents_v1';
const ACTIVE_AGENT_KEY = 'ff_active_agent_id';
const AGENT_SCHEMA_VERSION_KEY = 'ff_agent_schema_version';
const AGENT_SCHEMA_VERSION = 1;

function isPlainObject(value) {
  return Boolean(value) && Object.prototype.toString.call(value) === '[object Object]';
}

function readStoredAgents() {
  const raw = LS.get(AGENT_STORAGE_KEY);
  if (Array.isArray(raw)) return raw;
  if (isPlainObject(raw) && Array.isArray(raw.agents)) return raw.agents;
  return [];
}

function writeStoredAgents(agents, activeAgentId) {
  const okAgents = LS.set(AGENT_STORAGE_KEY, { agents });
  if (!okAgents) return false;
  const okVersion = LS.set(AGENT_SCHEMA_VERSION_KEY, AGENT_SCHEMA_VERSION);
  if (!okVersion) return false;
  if (activeAgentId) return LS.set(ACTIVE_AGENT_KEY, activeAgentId);
  LS.del(ACTIVE_AGENT_KEY);
  return true;
}

function normalizeAgentList(rawAgents) {
  const agents = [];
  for (const raw of Array.isArray(rawAgents) ? rawAgents : []) {
    agents.push(normalizeAgent(raw));
  }
  return agents;
}

function resolveActiveAgentId(agents, activeAgentId) {
  if (activeAgentId && agents.some(agent => agent.id === activeAgentId)) return activeAgentId;
  return agents[0]?.id ?? null;
}

function parseAgentInput(input) {
  if (typeof input === 'string') return JSON.parse(input);
  return input;
}

export function loadAgents() {
  const version = LS.get(AGENT_SCHEMA_VERSION_KEY);
  if (version != null && version !== AGENT_SCHEMA_VERSION) return [];

  const agents = normalizeAgentList(readStoredAgents());
  const activeAgentId = resolveActiveAgentId(agents, LS.get(ACTIVE_AGENT_KEY));
  if (activeAgentId !== LS.get(ACTIVE_AGENT_KEY)) {
    writeStoredAgents(agents, activeAgentId);
  }
  return agents;
}

export function getAgent(id) {
  return loadAgents().find(agent => agent.id === id) || null;
}

export function setActiveAgent(id) {
  const agents = loadAgents();
  const activeAgentId = resolveActiveAgentId(agents, id);
  writeStoredAgents(agents, activeAgentId);
  return activeAgentId;
}

export function saveAgent(agent) {
  const normalized = normalizeAgent(agent);
  const agents = loadAgents();
  const idx = agents.findIndex(entry => entry.id === normalized.id);
  if (idx === -1) agents.push(normalized);
  else agents.splice(idx, 1, normalized);
  const activeAgentId = resolveActiveAgentId(agents, LS.get(ACTIVE_AGENT_KEY) || normalized.id);
  if (!writeStoredAgents(agents, activeAgentId)) return null;
  return normalized;
}

export function deleteAgent(id) {
  const agents = loadAgents();
  const idx = agents.findIndex(agent => agent.id === id);
  if (idx === -1) return false;
  const wasActive = LS.get(ACTIVE_AGENT_KEY) === id;
  agents.splice(idx, 1);
  const activeAgentId = wasActive ? resolveActiveAgentId(agents, null) : resolveActiveAgentId(agents, LS.get(ACTIVE_AGENT_KEY));
  return writeStoredAgents(agents, activeAgentId);
}

export function exportAgent(id) {
  const agent = getAgent(id);
  return agent ? JSON.stringify(agent, null, 2) : null;
}

export function importAgent(input) {
  const parsed = parseAgentInput(input);
  const agent = normalizeAgent(parsed);
  return saveAgent(agent);
}

export function createAgentId() {
  return generateAgentId();
}

