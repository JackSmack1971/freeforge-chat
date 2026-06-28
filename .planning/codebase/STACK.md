# Technology Stack

## Summary

FreeForge is a browser-first chat app with no runtime build step.
The shipped app lives under `freeforge/` and opens directly in the browser.

## Languages

- JavaScript (ES modules) in `freeforge/src/**/*.js`
- HTML in `freeforge/index.html`
- CSS in `freeforge/styles/**/*.css`
- TOML in `netlify.toml`
- Node.js test modules in `tests/security/**/*.mjs`

## Runtime

- Browser runtime for the application shell and all user-facing behavior
- Node.js only for local tests and repo tooling
- Static hosting on Netlify via `netlify.toml`

## Frameworks and Libraries

- No front-end framework
- `marked@18.0.4` for Markdown parsing, loaded in `freeforge/index.html`
- `dompurify@3.4.8` for HTML sanitization, loaded in `freeforge/index.html`
- Tailwind CSS is used as prebuilt CSS, not through a bundler

## Dependencies

- `freeforge/package.json` declares `marked`, `dompurify`, and `tailwindcss`
- The browser app does not import from `node_modules` at runtime
- `freeforge/index.html` loads the Markdown and sanitization libraries from jsDelivr
- `freeforge/styles/tailwind.min.css` is checked in and linked locally

## Configuration

- `netlify.toml` publishes `freeforge/` and sets security headers
- `biome.json` configures linting for `freeforge/src/**/*.js` and `tests/security/**/*.mjs`
- `freeforge/package.json` exposes `node --test` as the only script

## Platform Requirements

- Modern browser with ES modules, Fetch, Streams, and Clipboard APIs
- `sessionStorage`, `localStorage`, and `ReadableStream` support
- No local server is required to open the app

## Notable Absences

- No root-level `package.json`
- No bundler, transpiler, or client-side build pipeline
- No app-specific framework dependencies
- No database or backend service

## Key Paths

- `freeforge/index.html`
- `freeforge/src/app.js`
- `freeforge/src/api.js`
- `freeforge/src/state.js`
- `freeforge/package.json`
- `netlify.toml`

