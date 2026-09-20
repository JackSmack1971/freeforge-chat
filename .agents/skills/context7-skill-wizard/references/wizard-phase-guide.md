# Wizard Phase Guide

## Scope-question patterns

Ask questions that directly become documentation topics, not generic skill
level questions.

- Authentication: framework/router, setup versus debugging, sessions versus
  organizations/webhooks.
- Async runtimes: scheduling model, I/O versus CPU workload, shutdown/retry or
  concurrency limits.
- UI frameworks: optimization target, component/state/server scope, rendering
  or animation constraint.
- Testing tools: unit/integration/E2E/API, framework, setup/mocking/async/CI.
- Databases and ORMs: schema/migrations versus CRUD, database engine, query or
  transaction pattern.

For an unknown domain ask: primary use case, focused versus comprehensive
scope, and the most important concern.

## Topic derivation

Combine answers into short documentation queries, for example:

| Answer | Topic |
|---|---|
| sign-in flows | sign-in sign-up authentication |
| interval scheduling | cron interval scheduling |
| graceful shutdown | graceful shutdown cancellation |
| App Router | app router server components |
| initial setup | installation setup configuration |
| filtering and pagination | filtering sorting pagination |

Use one to three topic queries per selected library. Broaden once when a
query returns no useful documentation.

## Iteration

- Narrower scope: re-fetch with a narrower topic.
- Missing feature: fetch that feature specifically.
- Too long: move detail into `references/`.
- Wrong version: re-fetch with the requested version qualifier.
- Format-only change: edit without re-fetching.
