# Concerns

## Summary

The codebase is small and clean, but it has a few structural risks that are worth tracking.
Most of them come from being a browser-only app with static assets and no build pipeline.

## Technical Debt

- `freeforge/package.json` is detached from the deployed app root
- CDN script versions in `freeforge/index.html` can drift from the package metadata
- The app has no lockfile because runtime dependencies are loaded directly in the browser
- Generated CSS in `freeforge/styles/tailwind.min.css` must stay in sync with `freeforge/styles/tailwind.source.css`

## Reliability Risks

- OpenRouter streaming depends on network quality and remote availability
- Long conversations can exceed context limits and force a new chat
- API-key validation depends on live remote model-list responses
- Browser clipboard/export behavior can fail in restricted contexts

## Security / Privacy Tradeoffs

- The API key lives in browser storage, so the threat model is local-browser only
- `sessionStorage` reduces persistence but means the key disappears on tab/browser restart
- Assistant markdown is sanitized, but the app still depends on third-party CDN script delivery
- A local debug hook exists at `window.__freeforgeGetErrorLog`

## UX / Accessibility Risks

- Modal focus handling and live-region announcements rely on manual browser verification
- Command palette behavior is keyboard-driven and easy to regress without E2E coverage
- Copy and regenerate affordances are dynamically injected after render
- The app uses a dark visual system with many custom surface styles, so CSS drift can be noticeable

## Testing Gaps

- No browser automation
- No visual regression coverage
- No integration test for streamed token rendering
- No automated accessibility audit in the repo

## Code Fragility

- `freeforge/src/ui/messages.js` mixes DOM creation with several action buttons
- `freeforge/src/features/chat.js` owns streaming state transitions and live-region updates
- `freeforge/src/features/settings.js` manages focus trap, validation, and clear-key confirmation in one file
- `freeforge/src/markdown.js` depends on globals injected by `index.html`

## Operational Concerns

- Netlify headers are important; the app assumes the hosting layer applies CSP
- Manual UAT is required for browser-only behaviors before release confidence is high
- The repo contains generated planning artifacts, which can grow quickly over time

## Key Paths

- `freeforge/index.html`
- `freeforge/styles/tailwind.min.css`
- `freeforge/src/features/chat.js`
- `freeforge/src/features/settings.js`
- `freeforge/src/ui/messages.js`
- `freeforge/src/markdown.js`
- `netlify.toml`

