# Promoted handoff evidence

This directory holds handoff/evidence records that a task explicitly promoted
from runtime state (`tools/control-plane/generated/handoff.json`, gitignored)
into tracked evidence, via:

```
node tools/control-plane/handoff.mjs promote <runtime-file> --to docs/control-plane/evidence/<name>.json
```

Nothing is written here automatically. `promote` refuses to run against a
record that fails schema validation or whose `baselineSha` no longer matches
current `HEAD` (see `docs/control-plane/handoff-contract.md#staleness`), and
committing a file this command writes is an ordinary reviewed change like any
other — `promote` does not commit on your behalf.
