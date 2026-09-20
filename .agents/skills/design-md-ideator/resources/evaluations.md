# Evaluation Scenarios

Run these with a fresh Codex exec run. Success requires both conversational quality and validator exit code `0`.

## Evaluation 1: Greenfield product with vague adjectives

Prompt:

> Create a DESIGN.md for a local-first AI research workbench. It should feel premium, serious, and futuristic. Decide most details for me.

Pass criteria:

- Converts adjectives into operational decisions rather than copying them into prose.
- Asks no more than one compact batch before proceeding when decisions are delegated.
- Produces complete semantic tokens and all eight sections.
- Discloses agent-selected defaults.
- Strict validator passes.

## Evaluation 2: Existing repository evidence

Fixture context:

- CSS variables define primary, surface, text, error, spacing, and radii.
- Components define button hover, disabled, and focus states.

Prompt:

> Build DESIGN.md from this repository and ask me only about genuine gaps.

Pass criteria:

- Inspects and preserves existing values.
- Does not ask for known tokens.
- Surfaces conflicts between implementation and prose.
- Uses token references in component definitions.
- Strict validator passes.

## Evaluation 3: User supplies invalid values

Prompt:

> Use primary `#12GG00`, 14pt body text, and duplicate Colors sections.

Pass criteria:

- Explains that the requested values violate the schema/profile.
- Recommends valid replacements without silently changing intent.
- Does not emit invalid CSS colors, unsupported `pt` dimensions, or duplicate sections.
- Strict validator passes after resolution.

## Evaluation 4: Wide-gamut design

Prompt:

> Use OKLCH colors and a variable font with optical sizing. Make the design dark-only.

Pass criteria:

- Preserves valid `oklch()` strings.
- Uses `fontVariation` or `fontFeature` where appropriate.
- Provides explicit dark-surface semantic roles and contrast pairings.
- Strict validator passes.

## Evaluation 5: Revision without design drift

Prompt:

> Update the existing DESIGN.md to make forms denser, but do not change branding or button appearance.

Pass criteria:

- Reads the existing file before editing.
- Changes only form/layout-related tokens and prose.
- Preserves unrelated tokens and rationale.
- Reports the surgical changes.
- Strict validator passes.

## Evaluation 6: Base-spec compatibility

Fixture:

- Frontmatter omitted.
- Only Overview, Colors, and Typography are present in canonical order.

Command:

```bash
python3 scripts/validate_design_md.py fixture.md --profile spec --format json
```

Pass criteria:

- Accepts omission allowed by the base spec.
- Rejects duplicate headings.
- Returns machine-readable status.

