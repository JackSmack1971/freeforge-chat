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

