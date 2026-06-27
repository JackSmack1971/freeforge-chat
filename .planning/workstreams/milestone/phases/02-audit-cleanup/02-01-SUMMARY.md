---
plan: 02-01
phase: 02-audit-cleanup
status: complete
started: 2026-06-27
completed: 2026-06-27
requirements_addressed: []
---

## Summary

Added the onboarding-style empty-models guard to `freeforge/src/features/settings.js` so a valid OpenRouter key that returns zero free models is treated as unusable instead of being saved as success.

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | Add empty-models guard to `updateKey()` | ✓ |

## Key Files

### Modified
- `freeforge/src/features/settings.js` — returns early on `!models.length`, shows `No free models found for this key`, and avoids persisting or promoting the key

## Verification

```
No free models found for this key ✓
Guard appears before setStoredKey(key) / populateModelsFromState() / closeSettings() ✓
Success path remains unchanged for usable keys ✓
```

## Self-Check: PASSED

All must_have truths verified:
- `settings.js` rejects zero-model results from `fetchFreeModels(key)` ✓
- The user sees the same no-free-model warning in settings that onboarding already uses ✓
- The key is not persisted or promoted into chat state on the zero-model path ✓
