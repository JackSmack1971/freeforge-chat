import { showInvalidBanner } from './ui/screen.js';

export async function fetchFreeModels(key) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error('Invalid API key');
      if (res.status === 429) throw new Error('Rate limited — try again shortly');
      throw new Error(`Failed to fetch models (${res.status})`);
    }
    const data = await res.json();
    return (data.data || []).filter(m => {
      if (m.id?.endsWith(':free')) return true;
      const p = m.pricing;
      return p && Number.parseFloat(p.prompt || '1') === 0 && Number.parseFloat(p.completion || '1') === 0;
    }).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function streamCompletion(msgs, modelId, key, { onToken, onDone, onError, signal }) {
  let res;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: modelId, messages: msgs, stream: true, stream_options: { include_usage: true } }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') return onDone('{}', '');
    onError('Network error — check your connection.');
    return;
  }

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); msg = j.error?.message || msg; } catch {}
    if (res.status === 401) { showInvalidBanner(); onError('Invalid API key — update it in Settings.'); }
    else if (res.status === 429) onError('Rate limited — try again in a moment.');
    else if (res.status === 400) onError(`Bad request: ${msg}`);
    else if (res.status === 413) onError('Context too long — start a new chat.');
    else onError(msg);
    return;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let full = '';
  let donePayload = '{}';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data: ')) continue;
        const raw = t.slice(6);
        if (raw === '[DONE]') continue;
        try {
          const j = JSON.parse(raw);
          if (j?.usage?.total_tokens !== undefined) donePayload = raw;
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) { full += delta; onToken(delta, full); }
        } catch {}
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') return onDone(donePayload, full);
    try { reader.cancel(); } catch {}
    onError('Stream interrupted.');
    return;
  }
  return onDone(donePayload, full);
}

