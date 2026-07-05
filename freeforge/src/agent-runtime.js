function estimateTokens(text) {
  return Math.ceil(String(text ?? '').length / 4);
}

function getRequestBudget(contextLength) {
  if (!Number.isFinite(contextLength) || contextLength <= 0) return 4096;
  return Math.max(1024, Math.floor(contextLength * 0.75));
}

export function buildRequestMessages(messages, agent, contextLength = null) {
  const payload = [];
  const systemPrompt = typeof agent?.instructions?.systemPrompt === 'string' ? agent.instructions.systemPrompt.trim() : '';
  const budget = getRequestBudget(contextLength);
  let usedTokens = systemPrompt ? estimateTokens(systemPrompt) : 0;
  if (systemPrompt) {
    payload.push({ role: 'system', content: systemPrompt });
  }

  const selected = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'user' && message.role !== 'assistant') continue;
    const content = String(message.content ?? '');
    if (!content.trim()) continue;
    const tokens = estimateTokens(content);
    if (selected.length && usedTokens + tokens > budget) break;
    selected.push({ role: message.role, content });
    usedTokens += tokens;
  }

  selected.reverse();
  payload.push(...selected);
  return payload;
}

export function buildRequestParameters(agent) {
  const parameters = {};
  const temperature = agent?.model?.temperature;
  if (Number.isFinite(temperature)) parameters.temperature = temperature;
  const maxTokens = agent?.model?.maxTokens;
  if (Number.isFinite(maxTokens)) parameters.max_tokens = maxTokens;
  return parameters;
}

export function buildRequestContext(messages, agent, contextLength = null) {
  return {
    messages: buildRequestMessages(messages, agent, contextLength),
    parameters: buildRequestParameters(agent),
  };
}
