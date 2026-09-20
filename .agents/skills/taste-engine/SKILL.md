---
name: taste-engine
description: Apply an explicitly enabled, user-maintained design preference profile to UI/UX briefs without overriding current instructions.
compatibility: Requires a user-provided profile path and explicit opt-in; no profile or persistence location is assumed.
---

# Taste Engine

This is an opt-in design aid, not an always-on worker. Use it only when the user explicitly enables it and provides a JSON profile. Read the profile, select the strongest signals for fonts, colors, layout density, and aesthetic direction, and add them as suggestions to the current design brief.

Never invent a profile, infer preferences from hidden session history, write to a legacy runtime config file, or mutate a file without an explicit path and user approval. Current-turn instructions always win. Preserve the supplied JSON schema when the user explicitly requests an approved/rejected update; otherwise return a proposed JSON patch or design-token block rather than writing state.

Codex does not provide the source runtime's command registry. Treat synchronization and token application as conversational operations and keep the profile path, opt-in flag, and output artifact visible in the response.
