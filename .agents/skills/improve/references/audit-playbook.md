# Audit Playbook

## Contents

- [Cross-cutting evidence rules](#cross-cutting-evidence-rules)
- [1. Correctness](#1-correctness)
- [2. Security and privacy](#2-security-and-privacy)
- [3. Performance and scalability](#3-performance-and-scalability)
- [4. Tests and verification](#4-tests-and-verification)
- [5. Architecture and maintainability](#5-architecture-and-maintainability)
- [6. Dependencies and migrations](#6-dependencies-and-migrations)
- [7. Developer experience and operations](#7-developer-experience-and-operations)
- [8. Documentation integrity](#8-documentation-integrity)
- [9. Product direction](#9-product-direction)

## Cross-cutting evidence rules

- Evidence first. A pattern becomes a finding only when a concrete path, symbol, and impact are established.
- Trace across boundaries. Inspect callers, consumers, configuration, tests, and deployment behavior—not only the suspicious line.
- Separate absence of evidence from evidence of absence. Mark unverified claims as investigation items.
- Respect intentional decisions, but report implementation drift or stale ADRs.
- Prefer reachable production paths. Generated, vendored, example, and dead code require explicit relevance.
- Do not execute proof-of-concept attacks, contact production services, or reveal sensitive values.

## 1. Correctness

Inspect critical state transitions and boundary behavior:

- swallowed or misclassified errors; partial writes without compensation,
- unawaited work, races, stale closures, missing cancellation and cleanup,
- nullability and unchecked indexing at trust boundaries,
- timezone, locale, pagination, ordering, retry, and idempotency errors,
- missing exhaustive handling of states or protocol variants,
- check-then-act concurrency and missing transactions,
- resource leaks and cleanup paths,
- serialization/deserialization mismatches across packages or services.

Require a plausible runtime path and a testable failure mode.

## 2. Security and privacy

Inspect trust boundaries, not just suspicious APIs:

- authentication, authorization, ownership, tenancy, and server-side enforcement,
- untrusted data reaching SQL, shell, HTML, dynamic execution, templates, or filesystem paths,
- request and event authenticity; replay and idempotency controls,
- schema validation, mass assignment, upload constraints, archive extraction,
- secret handling, logging, telemetry, crash reports, and retention,
- browser policy: CSP, CORS with credentials, cookies, CSRF, redirects,
- dependency advisories only when reachable in runtime or distribution paths,
- insecure production defaults or environment fallbacks.

For exposed credentials, report type and location only and require rotation. Do not include runnable misuse steps or payloads.

## 3. Performance and scalability

Prioritize measurable or structurally certain costs:

- N+1 I/O, repeated remote calls, or query-per-item loops,
- superlinear scans in hot paths and repeated parsing/serialization,
- unbounded collections, queues, payloads, concurrency, or retries,
- missing pagination, backpressure, pooling, batching, or bounded caches,
- render/fetch waterfalls and avoidable client bundles,
- synchronous expensive work on latency-sensitive paths,
- CI/build bottlenecks with evidence from configuration or timing.

Do not recommend caching without naming key, lifetime, invalidation, and memory-risk constraints.

## 4. Tests and verification

Map risk before counting lines:

- critical paths with no regression coverage,
- high-churn modules with weak characterization tests,
- tests that assert mocks, snapshots without semantic assertions, or order-dependent behavior,
- missing contract/integration coverage across trust boundaries,
- flaky real-time, real-network, shared-state, or nondeterministic tests,
- no safe one-command verification baseline,
- verification commands that silently skip packages or swallow failures.

A missing verification baseline is usually a prerequisite finding.

## 5. Architecture and maintainability

Look for change amplification and boundary erosion:

- duplicated logic that has diverged,
- circular or inverted dependencies,
- public APIs bypassed by internal consumers,
- god modules, high fan-in utilities, or unstable shared abstractions,
- incompatible patterns for the same concern,
- hidden global state and configuration coupling,
- feature flags, compatibility layers, and dead paths beyond their retirement criteria,
- architecture docs that no longer match implementation.

Prefer a concrete repeated maintenance cost over aesthetic judgments.

## 6. Dependencies and migrations

- End-of-life runtimes/frameworks with operational or security consequences.
- Deprecated APIs with an announced removal path.
- Abandoned critical dependencies or duplicated libraries.
- Manifest/lockfile/workspace drift.
- Major migrations only after estimating changed packages, compatibility risks, rollout order, and rollback.
- Advisory findings must identify package, reachable path, affected version, and remediation constraints.

Do not turn every available update into a finding.

## 7. Developer experience and operations

- incorrect or missing setup, environment examples, and reproducible commands,
- slow or fragmented feedback loops,
- inconsistent formatting/typecheck/lint enforcement,
- CI gaps, unpinned actions, missing caches, or non-reproducible release steps,
- inadequate logs, correlation, health checks, or operational diagnostics,
- unsafe local scripts and unclear destructive commands,
- absent agent instructions only when agents materially work in the repository.

## 8. Documentation integrity

Report only concrete costs:

- setup commands that fail,
- API examples inconsistent with exported interfaces,
- security or operational docs that omit required controls,
- unresolved contradictions between README, ADRs, product docs, and code,
- public surfaces without enough contract information to use safely.

Stale documentation is usually higher priority than missing documentation.

## 9. Product direction

Every option must be grounded in repository evidence:

- stated but undelivered product intent,
- recurring user friction visible in docs, examples, or issue patterns,
- asymmetric capabilities such as export without import,
- existing abstractions that make an adjacent capability unusually cheap,
- repeated manual workflows the product can absorb,
- abandoned stubs or clustered TODOs that reveal unfinished intent.

State the user value, evidence, trade-offs, coarse effort, and the cheapest validation step. Do not propose generic category features.
