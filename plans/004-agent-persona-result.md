# Plan 004 Result: Custom Agent Creator spike

## Section 1 - What works today

- `freeforge/src/agent-schema.js` already normalizes legacy and v1 agent shapes, including required system prompts, optional opening messages, starter prompts, model preferences, and timestamps.
- `freeforge/src/agent-runtime.js` already turns an active agent into request messages and parameters.
- `buildRequestMessages()` already prepends a `system` role message when the agent has a system prompt.
- `buildRequestParameters()` already carries `temperature` and `max_tokens` through when they are valid numbers.
- `freeforge/src/features/chat.js` already uses the agent runtime helpers instead of hand-building the payload.

## Section 2 - Minimum viable integration

- Keep `S.activeAgent` and `S.activeAgentId` in shared state so the chosen agent survives across the chat flow.
- Preserve the current `ff_active_agent_id` and `ff_conversation_agent` storage keys so agent selection and the active conversation snapshot restore cleanly.
- Keep the request path in `chat.js` routed through `buildRequestContext(messages, agent)` so the system prompt and model parameters are injected in one place.
- Surface agent selection through the command palette and the dedicated agent UI, which is already how the current app exposes agent switching.
- Use `localStorage` for agent metadata and the active agent id because this is a preference, not a secret.

## Section 3 - Open questions for the maintainer

- Should agents be exportable and importable as JSON for backup and sharing?
- Should switching agents preserve the current conversation, or should it always start a fresh chat?
- Should the active agent badge live in the nav, in the chat header, or both?
- Should `openingMessage` and `starterPrompts` be part of the active chat state or only part of agent creation/editing UI?
- Should model overrides from an agent always win, or should the user be able to override them at send time?

## Section 4 - Answers to the three integration point questions

1. System prompt injection
- The minimal behavior is already implemented in `buildRequestMessages(messages, agent)`: prepend a single `system` message when `agent.instructions.systemPrompt` is present and non-empty.
- The spike script proves that behavior end-to-end with `normalizeAgent()` plus a real payload build.

2. Model override
- The current runtime already uses `buildRequestParameters(agent)` to pass `temperature` and `max_tokens` alongside the selected model id.
- Keeping the override in the request builder is cleaner than mutating global state when the agent is activated, because it keeps agent preferences local to the request path.

3. Agent storage
- `localStorage` is the right home for agent definitions and the active agent id because they are user preferences, not secrets.
- The current key split is already reasonable: `ff_active_agent_id` for selection and `ff_conversation_agent` for the snapshot used to keep an in-progress chat stable.
- If persistence expands later, the natural next key is `ff_agents` for the full agent catalog.

## Section 5 - Recommended build sequence

1. Keep the request-path logic centralized in `agent-runtime.js` and extend it there first when agent behavior changes.
2. Add agent CRUD and persistence around the existing `ff_active_agent_id` / `ff_conversation_agent` keys.
3. Expand the agent picker UI to support create, edit, duplicate, and delete flows.
4. Decide the switching semantics for conversations that were started under a different agent.
5. Add starter prompt and opening message handling once the selection model is stable.

## Notes

- This spike reflects the current repository state, where the request-building path already exists in `agent-runtime.js`.
- No source files or tests were modified for the spike beyond the two deliverables in `plans/`.
