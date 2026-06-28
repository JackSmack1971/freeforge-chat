# Integrations

## Summary

FreeForge talks to OpenRouter directly from the browser and otherwise stays local.
The app also depends on a few browser APIs and a static hosting layer.

## External Services

- OpenRouter model listing: `https://openrouter.ai/api/v1/models`
- OpenRouter chat completion stream: `https://openrouter.ai/api/v1/chat/completions`
- OpenRouter key signup link in `freeforge/index.html`
- jsDelivr CDN for `marked` and `dompurify` script delivery

## Browser APIs

- `fetch()` for model lookup and streaming completion requests
- `ReadableStream` and `TextDecoder` for SSE-style token handling
- `sessionStorage` for the API key
- `localStorage` for chat history and model preference
- `navigator.clipboard` for copy actions
- `Blob`, `URL.createObjectURL()`, and anchor clicks for export

## Hosting and Delivery

- `netlify.toml` publishes `freeforge/`
- CSP and other headers are enforced by Netlify response headers
- The app can also be served from any static host

## Security and Privacy Boundaries

- API key is kept in `sessionStorage`, not persistent `localStorage`
- Legacy `ff_key` values are migrated out of `localStorage`
- Markdown is sanitized before insertion into the DOM
- UI copy actions and exports stay client-side

## Integration Ownership

- `freeforge/src/api.js` owns all OpenRouter network traffic
- `freeforge/src/features/models.js` owns model discovery
- `freeforge/src/features/chat.js` owns message streaming
- `freeforge/src/features/onboarding.js` and `freeforge/src/features/settings.js` validate the API key
- `freeforge/src/features/export.js` handles local markdown export

## No Other Backends Detected

- No authentication provider beyond the OpenRouter API key
- No analytics service
- No webhook receiver
- No database or cache service

## Key Paths

- `freeforge/src/api.js`
- `freeforge/src/features/models.js`
- `freeforge/src/features/chat.js`
- `freeforge/src/features/onboarding.js`
- `freeforge/src/features/settings.js`
- `freeforge/src/features/export.js`
- `netlify.toml`

