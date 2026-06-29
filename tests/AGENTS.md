# Test Notes

For agent UI changes, manually verify:

- The agent library modal opens and closes with Escape.
- Focus returns to the triggering control after close.
- Validation errors in the builder remain visible in the UI instead of failing silently.
- Invalid JSON import fails safely and does not replace existing agents.

