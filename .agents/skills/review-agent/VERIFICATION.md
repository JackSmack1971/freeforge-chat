# Verification

- Frontmatter shape and source-runtime reference scan passed.
- The skill is read-only by instruction and contains no helper scripts or mutation paths.
- `codex exec --ephemeral --sandbox read-only --skip-git-repo-check --ignore-user-config --ignore-rules --json` reported `$review-agent` as not discoverable in this no-Git workspace; the collector still inventories the package. Discovery parity remains UNKNOWN for this environment.
- A command-line `skills.config` path/enablement override produced the same result; it was not persisted because the documented override does not establish repository discovery.
