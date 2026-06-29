const AGENT_SCHEMA_VERSION = 1;
const AGENT_NAME_MAX = 60;
const AGENT_DESCRIPTION_MAX = 240;
const AGENT_SYSTEM_PROMPT_MAX = 16000;
const AGENT_OPENING_MESSAGE_MAX = 2000;
const AGENT_STARTER_PROMPT_MAX = 500;
const AGENT_STARTER_PROMPT_LIMIT = 6;
const AGENT_TEMPERATURE_MIN = 0;
const AGENT_TEMPERATURE_MAX = 2;
const AGENT_MAX_TOKENS_MIN = 1;
const AGENT_MAX_TOKENS_MAX = 131072;
const DEFAULT_ICON = { type: 'emoji', value: '🧠' };

const V1_KEYS = new Set([
  'schemaVersion',
  'id',
  'revision',
  'name',
  'description',
  'icon',
  'instructions',
  'model',
  'createdAt',
  'updatedAt',
]);

const LEGACY_KEYS = new Set([
  ...V1_KEYS,
  'systemPrompt',
  'openingMessage',
  'starterPrompts',
  'preferredModelId',
  'temperature',
  'maxTokens',
]);

function isPlainObject(value) {
  return Boolean(value) && Object.prototype.toString.call(value) === '[object Object]';
}

function trimText(value) {
  return String(value ?? '').trim();
}

function makeError(errors) {
  return new Error(`Invalid agent: ${errors.join('; ')}`);
}

function addError(errors, field, message) {
  errors.push(`${field}: ${message}`);
}

function assertKnownKeys(source, allowedKeys, errors) {
  for (const key of Object.keys(source)) {
    if (!allowedKeys.has(key)) addError(errors, key, 'unsupported field');
  }
}

function parseInteger(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value !== 'string') return null;
  if (!/^[-+]?\d+$/.test(value.trim())) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBoundedText(source, field, { min, max, required = false }, errors) {
  const value = trimText(source);
  if (!value) {
    if (required) addError(errors, field, `must be between ${min} and ${max} characters`);
    return '';
  }
  if (value.length < min || value.length > max) {
    addError(errors, field, `must be between ${min} and ${max} characters`);
  }
  return value;
}

function normalizeOptionalText(source, field, max, errors) {
  const value = trimText(source);
  if (!value) return '';
  if (value.length > max) addError(errors, field, `must be at most ${max} characters`);
  return value;
}

function normalizeId(source, errors) {
  const id = trimText(source);
  if (id) return id;
  return generateAgentId();
}

function normalizeRevision(source, errors) {
  const value = source ?? 1;
  const revision = parseInteger(value);
  if (revision === null || revision < 1) {
    addError(errors, 'revision', 'must be a positive integer');
    return 1;
  }
  return revision;
}

function normalizeDate(source, fallback) {
  const value = trimText(source);
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function normalizeIcon(source, errors) {
  if (source == null) return { ...DEFAULT_ICON };
  if (typeof source === 'string') {
    const value = trimText(source);
    if (!value) return { ...DEFAULT_ICON };
    return { type: 'emoji', value };
  }
  if (!isPlainObject(source)) {
    addError(errors, 'icon', 'must be an emoji or built-in icon descriptor');
    return { ...DEFAULT_ICON };
  }
  const type = trimText(source.type);
  const value = trimText(source.value);
  if (!value) {
    addError(errors, 'icon.value', 'is required');
    return { ...DEFAULT_ICON };
  }
  if (type !== 'emoji' && type !== 'builtin') {
    addError(errors, 'icon.type', 'must be emoji or builtin');
    return { ...DEFAULT_ICON };
  }
  if (type === 'builtin' && value.length > 40) {
    addError(errors, 'icon.value', 'must be at most 40 characters');
  }
  return { type, value };
}

function normalizeStarterPrompts(source, errors) {
  const prompts = Array.isArray(source) ? source : [];
  if (prompts.length > AGENT_STARTER_PROMPT_LIMIT) {
    addError(errors, 'instructions.starterPrompts', `must contain at most ${AGENT_STARTER_PROMPT_LIMIT} prompts`);
  }
  const out = [];
  for (const [idx, prompt] of prompts.entries()) {
    const text = trimText(prompt);
    if (!text) continue;
    if (text.length > AGENT_STARTER_PROMPT_MAX) {
      addError(errors, `instructions.starterPrompts[${idx}]`, `must be at most ${AGENT_STARTER_PROMPT_MAX} characters`);
      continue;
    }
    out.push(text);
  }
  return out.slice(0, AGENT_STARTER_PROMPT_LIMIT);
}

function normalizeInstructions(source, legacy, errors) {
  const instructions = isPlainObject(source) ? source : {};
  const systemPrompt = normalizeBoundedText(
    instructions.systemPrompt ?? legacy.systemPrompt,
    'instructions.systemPrompt',
    { min: 1, max: AGENT_SYSTEM_PROMPT_MAX, required: true },
    errors
  );
  const openingMessage = normalizeOptionalText(
    instructions.openingMessage ?? legacy.openingMessage,
    'instructions.openingMessage',
    AGENT_OPENING_MESSAGE_MAX,
    errors
  );
  const starterPrompts = normalizeStarterPrompts(
    instructions.starterPrompts ?? legacy.starterPrompts,
    errors
  );
  return { systemPrompt, openingMessage, starterPrompts };
}

function normalizeModel(source, legacy, errors) {
  const model = isPlainObject(source) ? source : {};
  const preferredModelId = normalizeOptionalText(
    model.preferredModelId ?? legacy.preferredModelId,
    'model.preferredModelId',
    160,
    errors
  ) || null;

  const temperatureSource = model.temperature ?? legacy.temperature;
  const temperatureText = trimText(temperatureSource);
  let temperature = null;
  if (temperatureText) {
    temperature = parseNumber(temperatureSource);
    if (temperature === null || temperature < AGENT_TEMPERATURE_MIN || temperature > AGENT_TEMPERATURE_MAX) {
      addError(errors, 'model.temperature', `must be between ${AGENT_TEMPERATURE_MIN} and ${AGENT_TEMPERATURE_MAX}`);
      temperature = null;
    }
  }

  const maxTokensSource = model.maxTokens ?? legacy.maxTokens;
  const maxTokensText = trimText(maxTokensSource);
  let maxTokens = null;
  if (maxTokensText) {
    maxTokens = parseInteger(maxTokensSource);
    if (maxTokens === null || maxTokens < AGENT_MAX_TOKENS_MIN || maxTokens > AGENT_MAX_TOKENS_MAX) {
      addError(errors, 'model.maxTokens', `must be between ${AGENT_MAX_TOKENS_MIN} and ${AGENT_MAX_TOKENS_MAX}`);
      maxTokens = null;
    }
  }

  return { preferredModelId, temperature, maxTokens };
}

function coerceLegacyShape(source) {
  return {
    ...source,
    instructions: isPlainObject(source.instructions)
      ? source.instructions
      : {
          systemPrompt: source.systemPrompt,
          openingMessage: source.openingMessage,
          starterPrompts: source.starterPrompts,
        },
    model: isPlainObject(source.model)
      ? source.model
      : {
          preferredModelId: source.preferredModelId,
          temperature: source.temperature,
          maxTokens: source.maxTokens,
        },
  };
}

export function generateAgentId() {
  return globalThis.crypto?.randomUUID?.() || `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeAgent(source) {
  if (!isPlainObject(source)) throw new TypeError('Invalid agent: expected an object');

  const errors = [];
  const schemaVersion = source.schemaVersion;
  if (schemaVersion != null && schemaVersion !== AGENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported agent schema version: ${schemaVersion}`);
  }

  assertKnownKeys(source, schemaVersion === AGENT_SCHEMA_VERSION ? V1_KEYS : LEGACY_KEYS, errors);
  const raw = schemaVersion === AGENT_SCHEMA_VERSION ? source : coerceLegacyShape(source);

  const name = normalizeBoundedText(raw.name, 'name', { min: 1, max: AGENT_NAME_MAX, required: true }, errors);
  const description = normalizeOptionalText(raw.description, 'description', AGENT_DESCRIPTION_MAX, errors);
  const icon = normalizeIcon(raw.icon, errors);
  const instructions = normalizeInstructions(raw.instructions, raw, errors);
  const model = normalizeModel(raw.model, raw, errors);
  const id = normalizeId(raw.id, errors);
  const revision = normalizeRevision(raw.revision, errors);
  const createdAt = normalizeDate(raw.createdAt, new Date().toISOString());
  const updatedAt = normalizeDate(raw.updatedAt, createdAt);

  if (errors.length) throw makeError(errors);

  return {
    schemaVersion: AGENT_SCHEMA_VERSION,
    id,
    revision,
    name,
    description,
    icon,
    instructions,
    model,
    createdAt,
    updatedAt,
  };
}

