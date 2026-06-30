export function buildRequestMessages(messages, agent) {
  const payload = [];
  const systemPrompt = agent?.instructions?.systemPrompt?.trim();
  if (systemPrompt) {
    payload.push({ role: 'system', content: systemPrompt });
  }
  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'assistant') continue;
    const content = String(message.content ?? '');
    if (!content.trim()) continue;
    payload.push({ role: message.role, content });
  }
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

export function buildRequestContext(messages, agent) {
  return {
    messages: buildRequestMessages(messages, agent),
    parameters: buildRequestParameters(agent),
  };
}
