# Contributing

## Overview

FreeForge Chat is a solo portfolio project. Contributions are welcome but should stay in scope.

## Before You Start

- Open an issue before beginning large changes.
- Keep changes focused. One concern per pull request.

## Development

No install step is required for the browser app.

```bash
# Run tests
npm --prefix freeforge test

# Run linter
npx --yes @biomejs/biome@1.9.4 check freeforge/src tests/security
```

## Pull Requests

- Target `main`.
- Ensure `npm --prefix freeforge test` and `npx --yes @biomejs/biome@1.9.4 check freeforge/src tests/security` pass before opening a PR.
- Keep the diff small and traceable to the issue it addresses.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.
