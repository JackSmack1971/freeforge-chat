# Security Notes

This document records the current browser-side security posture of FreeForge and
the tradeoffs accepted by the project's zero-build, zero-server architecture.

## API Key Storage

FreeForge stores the OpenRouter API key in `sessionStorage` under the key
`ff_key`.

### Why `sessionStorage`

- It is scoped to the current browser tab
- It is cleared when the tab is closed
- It avoids persisting the API key on disk across browser restarts
- It works in a static-hosted browser app without requiring a backend

### Accepted Risk

`sessionStorage` is still readable by any same-origin JavaScript running in the
page. That means a successful XSS on the FreeForge origin could read the API
key for the lifetime of the tab session.

This is currently treated as an acceptable risk because:

- FreeForge has no backend, so an HTTP-only cookie design is out of scope
- The app uses a restrictive CSP to limit script execution sources
- Markdown output is sanitized before insertion into the DOM
- The key is ephemeral and user-revocable through OpenRouter
- The key grants API usage, not access to stored user account data in FreeForge

## Current Mitigations

- Content Security Policy configured in `netlify.toml`
- DOMPurify sanitization for rendered model output
- Session-scoped key storage with migration away from `localStorage`
- `frame-ancestors 'none'` and related browser security headers

## User Guidance

If you want to reduce exposure further:

- Use a dedicated browser profile for AI tooling
- Close the tab when you are done with a session
- Rotate or revoke the OpenRouter API key if you suspect compromise
- Avoid running untrusted scripts or extensions in the same browser profile

## Scope

This project is a static browser client. It does not currently implement:

- A backend token broker
- Server-side secret storage
- HTTP-only cookie based authentication
- Centralized telemetry or intrusion detection
