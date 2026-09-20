# AGENTS.md

This is a minimal fixture root used by tests/control-plane/verify.test.mjs to
exercise tools/control-plane/verify.mjs against a repository that should pass
every authoritative check.

Nested `AGENTS.md` files:

- `tests/AGENTS.md` governs the fixture's `tests/` directory.
- `.agents/AGENTS.md` governs the fixture's project control-plane content.

## Production boundary

Merging to the main branch triggers an automatic Netlify production deploy.
Treat that merge/deploy/publish action as production publication requiring
explicit human authorization.
