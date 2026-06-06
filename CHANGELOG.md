# Changelog

All notable changes to FreeForge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows a simple date-based release history derived from the
current git history.

## [Unreleased]

### Changed
- Accessibility improvements for icon-only controls and mobile navigation labels
- Suggestion chips now auto-send through the same submit flow as manual messages
- Password-entry fields now use non-submitting forms with `autocomplete="new-password"`

### Planned
- Settings modal accessibility improvements including dialog semantics and focus management
- Repository documentation including a root README and deployment notes
- Additional performance and quality fixes identified in the current issue backlog

## [2026-06-06] - Security Hardening

### Added
- Netlify deployment configuration and HTTP response headers
- Browser-side runtime verification artifacts for the phase 1 security pass

### Changed
- Migrated API key handling to centralized helpers with session-scoped storage
- Tightened DOMPurify configuration with an explicit allowlist and escaped fallback behavior
- Hardened Content Security Policy, referrer policy, and related browser security headers
- Updated CDN dependencies and deployment configuration to support the hardened frontend

### Fixed
- Markdown sanitization flow now parses before sanitizing rendered HTML
- Browser storage handling removes stale persistent API keys during migration
- CSP and browser privacy settings align with the current client-side threat model

## [2026-06-05] - Initial Release

### Added
- Streaming chat UI for OpenRouter-hosted free models
- Model discovery and selection in a zero-build browser app
- Markdown rendering with DOMPurify sanitization
- Local conversation persistence and onboarding/settings flows for API key entry
- Responsive single-page interface deployed through Netlify
