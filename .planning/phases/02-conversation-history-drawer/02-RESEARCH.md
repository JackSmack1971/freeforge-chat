<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Capture a snapshot only when the user starts a new chat.
- **D-02:** The snapshot source is the current thread at the moment `newChat()` runs, before the active chat shell is cleared.
- **D-03:** Restore immediately when the composer is empty.
- **D-04:** If the composer has unsent text, require an explicit replace confirmation before restoring the archived thread.
- **D-05:** Keep each drawer row minimal: title, timestamp, first-prompt preview, and a Restore button.
- **D-06:** Do not add extra per-item metadata in the MVP unless it is needed for identification.

### the agent's Discretion
None - the user selected concrete options for each gray area.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

# Phase 2: Conversation History Drawer - Research

**Researched:** 2026-07-05
**Domain:** Browser-local conversation archive, modal drawer UX, and restore flow for a static chat app [VERIFIED: codebase]
**Confidence:** HIGH

## Summary

This phase is a state-snapshot problem, not a new subsystem. The app already has a single reset boundary in `freeforge/src/features/chat.js` (`newChat()`), a shared modal/focus pattern in `freeforge/src/features/settings.js` and `freeforge/src/ui/agent-library.js`, and browser-local persistence through `freeforge/src/state.js` `LS` helpers. [VERIFIED: codebase]

The planner should treat the drawer as a thin archive UI backed by a capped `localStorage` list, with restore logic that rewires the singleton state before the existing message renderer runs. That restore path needs to realign more than `S.messages`: the current model, conversation-agent snapshot, and context-pill state all feed the UI and should move together with the archived thread. [VERIFIED: codebase][ASSUMED]

**Primary recommendation:** add a dedicated `freeforge/src/features/history.js` module that snapshots before `newChat()`, stores capped archives under a separate key from `ff_msgs`, and reuses `createFocusTrap()` plus the existing modal open/close pattern for the drawer. [VERIFIED: codebase][ASSUMED]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Capture the active thread before reset | Browser / Client | Database / Storage | `newChat()` runs in the browser and can snapshot `S.messages` before it clears the active shell; persistence stays in browser storage. [VERIFIED: codebase] |
| Persist a bounded archive | Database / Storage | Browser / Client | The archive lives in `localStorage` through `LS`; the browser owns durability and pruning. [VERIFIED: codebase] |
| Render the slide-over drawer | Browser / Client | UI layer | The drawer is pure DOM/UI work and should follow the existing modal surfaces in `settings.js` and `agent-library.js`. [VERIFIED: codebase] |
| Restore an archived conversation | Browser / Client | Database / Storage | Restore mutates singleton state and then writes the active thread back to storage so reloads stay consistent. [VERIFIED: codebase] |
| Confirm replacement when draft text exists | Browser / Client | UI layer | The confirmation is a local interaction gate, not a backend decision. [VERIFIED: codebase] |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ES modules in `freeforge/src/**/*.js` | Native browser support | Application code organization | The repo already runs without a build step, so the drawer should stay inside the existing ES module graph. [VERIFIED: codebase] |
| `freeforge/src/state.js` (`S`, `LS`, `$`) | Internal | Shared state and browser storage wrapper | `S` is the singleton state source and `LS` is the current persistence abstraction; adding a history list here avoids a new state system. [VERIFIED: codebase] |
| `freeforge/src/ui/focus-trap.js` | Internal | Modal focus management | The existing helper already stores previous focus and traps Tab inside modal surfaces. [VERIFIED: codebase] |
| `freeforge/src/features/chat.js` | Internal | Reset boundary and restore application | `newChat()` is the correct archive hook because it already owns request cancellation and message clearing. [VERIFIED: codebase] |
| `node:test` | Node 22.20.0 | Regression coverage | The repo already validates runtime behavior with Node-based browser-style tests instead of a browser automation stack. [VERIFIED: codebase][VERIFIED: local environment] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `freeforge/src/features/settings.js` | Internal | Reference implementation for accessible modal open/close | Use it as the blueprint for drawer focus, `aria-hidden`, and close/fallback behavior. [VERIFIED: codebase] |
| `freeforge/src/ui/agent-library.js` | Internal | Reference implementation for modal drawer wiring | Use it as the blueprint for a slide-over surface that opens, traps focus, and restores focus on close. [VERIFIED: codebase] |
| `freeforge/src/ui/messages.js` | Internal | Message list rendering and empty-state toggling | Use it to restore the active thread after archive selection and to keep the empty state in sync. [VERIFIED: codebase] |
| `Biome 1.9.4` | 1.9.4 | Lint and formatting checks | Use the existing repo check command after the history module and drawer markup change. [VERIFIED: local environment][VERIFIED: codebase] |
| Browser `localStorage` | Native API | Archive persistence | Use it for the capped archive; the app already persists `ff_msgs`, `ff_model`, and agent context data here. [VERIFIED: codebase] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A separate history module | Fold history into `chat.js` | Smaller file count, but harder to keep snapshot, restore, and drawer rendering isolated. [ASSUMED] |
| Reusing `ff_msgs` for archives | A dedicated `ff_history` key | Reusing `ff_msgs` is simpler short term, but it blurs active-thread state with archive state and makes startup hydration harder. [VERIFIED: codebase][ASSUMED] |
| A new modal framework | `createFocusTrap()` plus the existing modal pattern | The existing helper already solves the accessibility and focus restoration problem, so a new framework is unnecessary. [VERIFIED: codebase] |

**Installation:** No new packages required. [VERIFIED: codebase]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal focus management | Custom Tab-loop and focus-restore logic | `createFocusTrap()` | Settings and agent library already prove this pattern works and preserves previous focus. [VERIFIED: codebase] |
| Browser-local persistence | Ad hoc JSON blobs scattered across modules | `LS` from `state.js` | The app already centralizes localStorage access and JSON handling through one helper. [VERIFIED: codebase] |
| Drawer open/close semantics | A bespoke dialog abstraction | Existing `hidden`/`aria-hidden` modal pattern | The repo already has two modal surfaces with the exact open/close pattern the drawer needs. [VERIFIED: codebase] |
| Archived message previews | Re-rendering full markdown in the drawer list | Plain text preview from the first user prompt | The drawer needs identification, not rich rendering; plain text avoids extra XSS surface and DOM cost. [ASSUMED] |
| Restore state reconciliation | Updating only `S.messages` | Restore `S.messages`, `S.selectedModel`, `S.conversationAgent`, `S.contextTokens`, and `S.usageIsExact` together | The message UI, starter prompts, agent avatar, model selector, and context pill all read from separate singleton fields. [VERIFIED: codebase][ASSUMED] |

**Key insight:** the history drawer is a snapshot-and-restore layer on top of the existing single-thread UI, so the smallest correct solution is a capped archive plus a restore action that rehydrates the current singleton state before rendering. [VERIFIED: codebase][ASSUMED]

## Architecture Patterns

### System Architecture Diagram

User clicks "New Chat" or opens the drawer
-> `freeforge/src/app.js` delegated event wiring
-> `freeforge/src/features/chat.js` snapshot/reset boundary
-> `freeforge/src/features/history.js` archive read/write
-> `freeforge/src/state.js` `S` + `LS`
-> `freeforge/src/ui/messages.js` + `freeforge/src/ui/focus-trap.js`
-> browser DOM

Restore path:
User selects an archive
-> drawer confirm gate if composer has text
-> history module swaps singleton state
-> existing message renderer redraws the active thread
-> focus returns to the opener. [VERIFIED: codebase][ASSUMED]

### Recommended Project Structure
```text
freeforge/src/
├─ features/
│  ├─ chat.js         # snapshot boundary and restore application
│  └─ history.js      # archive list, prune, snapshot, restore
├─ ui/
│  └─ focus-trap.js   # shared modal focus management
└─ app.js             # drawer trigger wiring and delegated actions
```

### Pattern 1: Reuse the existing modal surface pattern
**What:** Open the drawer by removing `hidden`, setting `aria-hidden="false"`, and activating the shared focus trap. [VERIFIED: codebase]
**When to use:** Any slide-over or dialog-like surface in this app. [VERIFIED: codebase]
**Example:**
```js
// Source: freeforge/src/features/settings.js [VERIFIED: codebase]
modal.classList.remove('hidden');
modal.classList.add('open');
modal.setAttribute('aria-hidden', 'false');
getFocusTrap().open();
```

### Pattern 2: Snapshot at the reset boundary
**What:** Capture the current thread before `newChat()` clears `S.messages`. [VERIFIED: codebase]
**When to use:** Any archive or undo feature that must preserve the pre-reset thread. [VERIFIED: codebase]
**Example:**
```js
// Source: freeforge/src/features/chat.js [VERIFIED: codebase]
export function newChat() {
  clearActiveRequestState();
  if (S.abort) { S.abort.abort(); S.abort = null; }
  clearInlineEditUndo();
  clearPersistent();
  S.messages = [];
}
```

### Anti-Patterns to Avoid
- **Writing archive state after `newChat()` clears `S.messages`:** that loses the thread you meant to save. [VERIFIED: codebase]
- **Storing archive rows in the same array as the active thread:** startup hydration and restore semantics get harder to reason about. [ASSUMED]
- **Using `innerHTML` for previews:** the drawer only needs a label and preview, and text nodes are safer. [ASSUMED]
- **Building a custom focus manager:** the repo already has one and has regression coverage for it. [VERIFIED: codebase]

## Common Pitfalls

### Pitfall 1: Snapshotting too late
**What goes wrong:** the archive captures an empty thread instead of the pre-reset conversation. [VERIFIED: codebase]
**Why it happens:** `newChat()` clears the active shell immediately after its reset work. [VERIFIED: codebase]
**How to avoid:** snapshot the current `S.messages` and related context before calling the clearing portion of `newChat()`. [VERIFIED: codebase][ASSUMED]
**Warning signs:** the drawer shows a blank item, or reload restores nothing even though the user started a fresh chat. [ASSUMED]

### Pitfall 2: Restoring only the messages
**What goes wrong:** the visible messages return, but the model selector, starter prompts, avatar, and context pill are out of sync. [VERIFIED: codebase]
**Why it happens:** the UI reads from `S.selectedModel`, `S.conversationAgent`, `S.contextTokens`, and `S.usageIsExact`, not just `S.messages`. [VERIFIED: codebase]
**How to avoid:** restore the archived singleton fields together, then call the existing render helpers. [VERIFIED: codebase][ASSUMED]
**Warning signs:** the restored thread renders but the context pill still shows the old conversation or the wrong assistant avatar appears. [VERIFIED: codebase]

### Pitfall 3: Losing the opener focus
**What goes wrong:** the drawer closes, but keyboard users land nowhere useful. [VERIFIED: codebase]
**Why it happens:** a modal without a remembered opener cannot restore focus deterministically. [VERIFIED: codebase]
**How to avoid:** use `createFocusTrap()` and close the drawer with an explicit fallback target, just like Settings. [VERIFIED: codebase]
**Warning signs:** Escape closes the drawer but focus ends up on the document body or a random control. [ASSUMED]

### Pitfall 4: Letting the archive grow without bound
**What goes wrong:** localStorage usage increases until older snapshots are evicted unpredictably. [VERIFIED: codebase][ASSUMED]
**Why it happens:** unlike the active thread, the archive will append on every new chat unless you prune it. [VERIFIED: codebase]
**How to avoid:** cap the archive and prune oldest snapshots first. [VERIFIED: roadmap/context]
**Warning signs:** restore gets slower, storage quota warnings appear, or the archive stops persisting. [VERIFIED: codebase][ASSUMED]

## Code Examples

Verified patterns from the current codebase:

### Modal open/close
```js
// Source: freeforge/src/ui/agent-library.js [VERIFIED: codebase]
modal.classList.remove('hidden');
modal.setAttribute('aria-hidden', 'false');
getFocusTrap().open();
```

### Reset boundary
```js
// Source: freeforge/src/features/chat.js [VERIFIED: codebase]
export function newChat() {
  clearActiveRequestState();
  if (S.abort) { S.abort.abort(); S.abort = null; }
  clearInlineEditUndo();
  clearPersistent();
  S.messages = [];
}
```

### Message re-render after state changes
```js
// Source: freeforge/src/ui/messages.js [VERIFIED: codebase]
export function renderAllMessages() {
  const list = $('msgs-list');
  syncMessageVisibility();
  if (S.messages.length === 0) return;
  list.innerHTML = '';
  renderedCount = 0;
  appendNewMessages();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Overwrite the active thread only | Keep a capped archive plus the active thread state | Phase 2 planning target [ASSUMED] | Users can return to prior conversations without adding sync or a backend. |
| Custom modal/focus code per surface | Shared `createFocusTrap()` plus `hidden`/`aria-hidden` toggles | Already present in the repo [VERIFIED: codebase] | Less duplication and fewer keyboard regressions. |
| Rich, searchable history management | Minimal browse-and-restore drawer | Locked by context [VERIFIED: roadmap/context] | Keeps the MVP small and avoids a management UI the phase does not need. |

**Deprecated/outdated:**
- Replacing `ff_msgs` in place with no archive: the current app already treats local storage as the persistence layer, and the phase goal explicitly adds a restorable archive. [VERIFIED: codebase][VERIFIED: roadmap/context]
- A separate framework for the drawer: the repo is intentionally buildless and browser-native. [VERIFIED: codebase]

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The archive is best implemented as a dedicated history module plus a separate `ff_history` store rather than overloading `ff_msgs`. | Summary, Standard Stack, Don't Hand-Roll | If the planner chooses the wrong key shape, startup hydration and restore code may need rework. |
| A2 | Restore should carry `S.selectedModel`, `S.conversationAgent`, `S.contextTokens`, and `S.usageIsExact` with each archived snapshot. | Don't Hand-Roll, Common Pitfalls | If the archived state shape is smaller, the drawer can restore the wrong model or context pill state. |
| A3 | The drawer preview can be plain text from the first user prompt. | Don't Hand-Roll, Architecture Patterns | If the planner expects markdown rendering, the implementation and tests need a different rendering path. |
| A4 | The archive cap value is not yet fixed and must be chosen during planning. | Common Pitfalls, Open Questions | If the cap is already locked elsewhere, the planner should not reopen it. |
| A5 | Restoring the active thread should update the existing render helpers after the singleton state is swapped. | Summary, Common Pitfalls | If the restore path forgets the render pass, the UI will stay stale. |
| A6 | The archive rows can stay minimal because identification, not management, is the MVP goal. | Summary, Don't Hand-Roll | If the phase scope expands, the drawer may need richer metadata later. |
| A7 | The drawer can use a compact confirm surface inside the drawer rather than a new framework-level dialog system. | Open Questions | If the product wants a separate confirm modal, the planner must split that work. |
| A8 | Browser automation is not present in the repo and the keyboard-only smoke test will remain manual for this phase. | Environment Availability | If a browser runner is added later, the smoke check can become automated. |
| A9 | The browser test DOM fixtures will need new drawer nodes and confirm-state nodes. | Validation Architecture | If the tests already have those fixtures elsewhere, this task can be skipped. |
| A10 | The archive should be pruned oldest-first to keep the list bounded. | Common Pitfalls, Open Questions | If a different retention policy is chosen, the archive write path changes. |
| A11 | The archive should likely be stored in a separate `ff_history` key instead of mixing with the active thread. | Summary, Standard Stack, Don't Hand-Roll | If `ff_msgs` is reused, the startup and restore logic becomes harder to reason about. |
| A12 | The restore path should probably persist the selected model per archive entry. | Summary, Open Questions | If the archive omits model state, model compatibility becomes probabilistic. |
| A13 | The restore path should likely keep a per-archive conversation-agent snapshot. | Summary, Open Questions | If the archive omits agent state, starter prompts and avatars may mismatch after restore. |
| A14 | The restore path should probably keep context-pill state with the snapshot or recompute it deterministically. | Summary, Open Questions | If neither happens, the pill can show the wrong usage immediately after restore. |
| A15 | The drawer preview should not use `innerHTML`. | Don't Hand-Roll, Common Pitfalls | If future design wants rich preview rendering, the sanitizer path must be revisited. |
| A16 | The drawer should restore focus to the opener after close. | Architecture Patterns, Common Pitfalls | If the opener disappears, a deterministic fallback target is needed. |
| A17 | The phase is targeting a capped archive plus active-thread state rather than overwriting the thread with no archive. | State of the Art | If the phase scope changes, the archive/restore tasks need to be re-scoped. |
| A18 | The restore shape is still partly inferred from current state consumers and needs confirmation during planning. | Metadata | If the inference is wrong, the restore snapshot may need a different schema. |
| A19 | The 2026-08-04 validity window is only an estimate. | Metadata | If the repo or runtime changes sooner, the research should be refreshed earlier. |

## Open Questions

1. **What exact retention cap should the archive use?**
   - What we know: the roadmap requires the archive to be capped, and no number is specified in `ROADMAP.md` or `CONTEXT.md`. [VERIFIED: roadmap/context]
   - What's unclear: whether the cap is 5, 10, 20, or derived from storage budget. [ASSUMED]
   - Recommendation: choose a fixed number in planning and prune oldest snapshots first. [ASSUMED]

2. **Which archived fields must be restored besides message content?**
   - What we know: the UI depends on `S.selectedModel`, `S.conversationAgent`, `S.contextTokens`, and `S.usageIsExact`. [VERIFIED: codebase]
   - What's unclear: whether those should be stored in each archive entry or recomputed on restore. [ASSUMED]
   - Recommendation: store them in the snapshot so restore is deterministic and cheap. [ASSUMED]

3. **Should the confirmation path be inline in the drawer or a separate confirm modal?**
   - What we know: the phase requires explicit confirmation only when unsent composer text would be replaced. [VERIFIED: roadmap/context]
   - What's unclear: the exact UI form of that confirmation. [ASSUMED]
   - Recommendation: prefer the smallest confirm surface that still preserves focus trapping, likely an inline confirm row or compact confirm panel inside the drawer. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm --prefix freeforge test` and repo tooling | Yes | v22.20.0 | - [VERIFIED: local environment] |
| npm | `npm --prefix freeforge test` | Yes | 10.9.3 | - [VERIFIED: local environment] |
| Biome via `npx` | Lint checks | Yes | 1.9.4 | - [VERIFIED: local environment] |

**Missing dependencies with no fallback:**
- None identified for the code-only planning work. [VERIFIED: codebase]

**Missing dependencies with fallback:**
- Browser-only keyboard smoke testing does not have a repo automation runner here; use a manual browser pass after the code changes. [VERIFIED: codebase]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` under Node.js 22.20.0 [VERIFIED: codebase][VERIFIED: local environment] |
| Config file | `freeforge/package.json` script `test` [VERIFIED: codebase] |
| Quick run command | `npm --prefix freeforge test` [VERIFIED: codebase] |
| Full suite command | `npm --prefix freeforge test` [VERIFIED: codebase] |

### Phase Requirements -> Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Snapshot the active thread before `newChat()` clears it | unit/integration in `tests/security/runtime-app.test.mjs` or `tests/security/runtime-ui-features.test.mjs` | `npm --prefix freeforge test` | No dedicated history test yet [VERIFIED: codebase] |
| Drawer opens from the nav and traps focus | browser-style unit/integration | `npm --prefix freeforge test` | No drawer fixture yet [VERIFIED: codebase] |
| Restore works immediately when the composer is empty | browser-style integration | `npm --prefix freeforge test` | No history restore test yet [VERIFIED: codebase] |
| Restore asks for confirmation when draft text exists | browser-style integration | `npm --prefix freeforge test` | No history confirm test yet [VERIFIED: codebase] |
| Empty state renders when there is no archive | browser-style UI test | `npm --prefix freeforge test` | No history empty-state test yet [VERIFIED: codebase] |
| Lint the new module and drawer markup | lint | `npx --yes @biomejs/biome@1.9.4 check freeforge/src tests/security` | Yes [VERIFIED: codebase][VERIFIED: local environment] |

### Sampling Rate
- **Per task commit:** `npm --prefix freeforge test` [VERIFIED: codebase]
- **Per wave merge:** `npm --prefix freeforge test` plus `npx --yes @biomejs/biome@1.9.4 check freeforge/src tests/security` [VERIFIED: codebase]
- **Phase gate:** Full suite green before verification. [VERIFIED: codebase]

### Wave 0 Gaps
- `freeforge/src/features/history.js` does not exist yet and must be created as the archive/restore boundary. [VERIFIED: codebase]
- `tests/security/runtime-ui-features.test.mjs` and `tests/security/runtime-app.test.mjs` do not yet contain history drawer coverage. [VERIFIED: codebase]
- The browser test DOM fixtures will likely need new drawer nodes and confirm-state nodes. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth change in this phase; keep the existing session key flow unchanged. [VERIFIED: codebase] |
| V3 Session Management | no | The phase does not alter the session-scoped API key behavior. [VERIFIED: codebase] |
| V4 Access Control | no | There is no role or permission model in the browser-only app. [VERIFIED: codebase] |
| V5 Input Validation | yes | Keep restore confirmation, drawer actions, and previews text-only; do not trust archive content blindly. [VERIFIED: codebase][ASSUMED] |
| V6 Cryptography | no | No new cryptography is introduced; do not hand-roll it. [VERIFIED: codebase] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS in history previews | Tampering / Elevation | Render previews as text, not HTML; only the main message viewer should render markdown through the existing sanitizer path. [VERIFIED: codebase][ASSUMED] |
| History disclosure in logs or toasts | Information Disclosure | Keep message content out of logging and toast strings, matching the project constraint. [VERIFIED: roadmap/context] |
| Unbounded localStorage growth | Denial of Service | Cap the archive and prune oldest snapshots first. [VERIFIED: roadmap/context] |
| Restore replacing unsent draft text | Tampering | Require explicit confirmation before swapping the active thread when composer text exists. [VERIFIED: roadmap/context] |

## Sources

### Primary (HIGH confidence)
- `freeforge/src/features/chat.js` - `newChat()`, streaming lifecycle, and current message persistence. [VERIFIED: codebase]
- `freeforge/src/features/settings.js` - accessible modal open/close, focus trap, and live-region pattern. [VERIFIED: codebase]
- `freeforge/src/ui/agent-library.js` - slide-over modal pattern with shared focus trap. [VERIFIED: codebase]
- `freeforge/src/ui/focus-trap.js` - reusable focus trap helper. [VERIFIED: codebase]
- `freeforge/src/ui/messages.js` - message rendering, empty state, and re-render behavior. [VERIFIED: codebase]
- `freeforge/src/ui/ctx-pill.js` - context-pill dependencies on `S.selectedModel`, `S.contextTokens`, `S.usageIsExact`, and `S.ctxToastFired`. [VERIFIED: codebase]
- `freeforge/src/state.js` - singleton state and `LS` helper. [VERIFIED: codebase]
- `freeforge/index.html` - existing drawer-like/modal surfaces and live-region nodes. [VERIFIED: codebase]
- `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, and `02-CONTEXT.md` - phase goals, locked decisions, and project constraints. [VERIFIED: codebase]
- `tests/security/runtime-app.test.mjs` and `tests/security/runtime-ui-features.test.mjs` - current regression coverage baseline. [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `README.md` and `freeforge/package.json` - existing stack inventory and runtime/tooling versions. [VERIFIED: codebase]

### Tertiary (LOW confidence)
- None. [VERIFIED: codebase]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all stack choices are already present in the repo or verified in the local environment. [VERIFIED: codebase][VERIFIED: local environment]
- Architecture: HIGH - the drawer fits existing modal, state, and render patterns already present in the app. [VERIFIED: codebase]
- Pitfalls: MEDIUM - the restore shape is partly inferred from current state consumers and still needs confirmation during planning. [ASSUMED]

**Research date:** 2026-07-05 [VERIFIED: local environment]
**Valid until:** 2026-08-04, assuming no major repo or runtime changes [ASSUMED]
