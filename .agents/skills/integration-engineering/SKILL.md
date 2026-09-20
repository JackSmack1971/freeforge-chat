---
name: integration-engineering
description: Safely implement or review an integration with an external API, SDK, webhook, OAuth provider, cloud service, or payment/communication platform. Use whenever product behavior depends on a third-party system.
compatibility: Requires access to authoritative provider documentation and the repository's supported runtime/tooling; credentials must be supplied through the existing secret mechanism.
---

# Integration Engineering

Build the smallest provider integration that remains correct when networks,
providers, and requests are unreliable.

## Workflow

1. Read current authoritative provider documentation and identify supported
   API/SDK versions, sandbox mode, limits, and lifecycle requirements.
2. Define credentials/configuration boundaries and fail early when required
   configuration is absent; never print secrets.
3. Implement the minimal request or event flow with timeouts, safe error
   mapping, retry rules, and idempotency appropriate to the operation.
4. For webhooks, verify authenticity, handle duplicates, acknowledge quickly,
   and process safely.
5. Add test-mode coverage, redacted structured logs, useful metrics, and a
   failure/recovery runbook.
6. Verify success, provider failure, timeout, rate limit, malformed response,
   and repeated-delivery behavior.

## Boundary

Do not guess undocumented provider behavior or retry non-idempotent operations
blindly. Stop when credentials, provider policy, or authoritative version
information is missing.
