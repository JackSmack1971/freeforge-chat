import { S } from '../state.js';
import { toast } from '../ui/toast.js';

export function exportConversation() {
  if (!S.messages.length) { toast('No conversation to export yet', 'info'); return; }
  const text = S.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `## ${m.role}\n\n${m.content}`)
    .join('\n\n---\n\n');
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `freeforge-chat-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Conversation exported', 'success');
}
