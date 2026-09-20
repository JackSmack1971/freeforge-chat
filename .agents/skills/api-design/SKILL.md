---
name: api-design
description: Design or review an API contract for domain operations, including request and response schemas, errors, authentication, authorization, pagination, idempotency, and versioning. Use for HTTP, RPC, GraphQL, or internal service boundaries.
compatibility: Requires a product or domain operation and relevant repository or protocol constraints.
---

# API Design

Design the smallest stable contract that lets clients accomplish a domain
operation safely and predictably.

## Workflow

1. Define the operation, actor, resource ownership, and success condition.
2. Specify transport shape, inputs, outputs, validation, empty states, and
   stable error codes with client-relevant recovery guidance.
3. Define authentication, authorization, rate limits, pagination/filtering,
   idempotency, consistency, and timeout expectations where relevant.
4. Check naming, compatibility, sensitive-data exposure, and observability.
5. Provide representative examples and acceptance checks.

## Output

Return a contract table or protocol-native schema plus behavior, errors,
authorization rules, examples, and compatibility/versioning notes.

## Boundary

Do not add versioning, pagination, or abstraction without a client or scale
need. Never expose internal errors, secrets, or data a caller is not authorized
to see.
