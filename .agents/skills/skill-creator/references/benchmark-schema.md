# Codex evaluation contract

This is the small, Codex-native contract used by the bundled helpers. It
replaces the source package's transcript, Claude model, and agent-role schemas.

## Evaluation set

`run_eval.py` reads a JSON array:

```json
[
  {"query": "...", "should_trigger": true}
]
```

In `explicit_codex_invocation` mode, `should_trigger` means the task should
successfully follow the named repository skill. It does not measure implicit
skill ranking.

## Evaluation result

```json
{
  "skill_name": "skill-creator",
  "mode": "explicit_codex_invocation",
  "results": [
    {
      "query": "...",
      "should_trigger": true,
      "trigger_rate": 1.0,
      "triggers": 1,
      "runs": 1,
      "pass": true
    }
  ],
  "summary": {"total": 1, "passed": 1, "failed": 0}
}
```

The runner records only final output markers and exit/timeout outcomes. Do not
add transcript bodies, hook payloads, credentials, or raw model output to this
contract.

## Benchmark output

`aggregate_benchmark.py` produces `metadata`, `runs`, `run_summary`, and
`notes`. `run_summary` contains one entry per configuration plus `delta`; each
metric has `mean`, `stddev`, `min`, and `max`. Runtime token values are included
only when supplied by Codex runtime telemetry.

The HTML viewer accepts this JSON directly. Keep configuration names stable
within one benchmark and do not compare runs with different prompts or timeout
budgets without labeling the change.
