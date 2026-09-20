# Adaptive DESIGN.md Questionnaire

Use this as a decision inventory, not a form to dump on the user. Inspect existing evidence first, then ask only unresolved questions in small batches. Every question should include a recommendation grounded in the product context.

## Decision ledger schema

Track each item as:

```yaml
field: colors.primary
status: confirmed | recommended | assumed | conflict
value: "#1A1C1E"
evidence: "Accepted by user" | "Existing CSS variable" | "Agent recommendation"
rationale: "Core text and high-emphasis control color"
```

## Round 1: Product and creative direction

Required decisions:

- Official design-system name.
- Optional version and description.
- Product type, platform, and primary tasks.
- Target audience and accessibility needs.
- Brand personality: choose 3–5 traits and 2–3 anti-traits.
- Intended emotional response.
- Density: compact, balanced, or spacious.
- Existing brand assets or references to preserve.
- Designs, patterns, or aesthetics to avoid.
- Downstream consumers: humans, agents, Figma, Tailwind, code generators, or other tools.

Recommended prompt shape:

> Based on the product evidence, I recommend **[direction]** because **[reason]**. Choose it or revise these decisions: **[3–5 concise choices]**.

## Round 2: Colors

Required token decisions:

- `primary` and its semantic purpose.
- Supporting palettes needed for text, surfaces, borders, interactions, feedback, and data visualization.
- Exact valid CSS strings.
- Hex versus wide-gamut policy.
- Foreground/background pairings that need contrast checks.
- Light-only, dark-only, or multi-theme scope.

Default semantic set when the product needs a complete UI palette:

- `primary`, `secondary`, `tertiary`, `neutral`
- `surface`, `surface-subtle`, `on-surface`, `border`
- `success`, `warning`, `error`, `info`
- interaction steps such as `primary-hover`, `primary-active`, `focus-ring`

Do not create decorative colors with no semantic role. Do not use a color name as proof of accessible contrast.

## Round 3: Typography

Required for every typography token:

- token name;
- semantic role;
- `fontFamily`;
- `fontSize` using `px`, `em`, or `rem`;
- numeric `fontWeight`;
- `lineHeight` as a dimension or unitless number;
- `letterSpacing` as a dimension;
- optional `fontFeature` or `fontVariation`.

Default scale: 9–15 levels using semantic names such as:

- `headline-display`, `headline-lg`, `headline-md`
- `body-lg`, `body-md`, `body-sm`
- `label-lg`, `label-md`, `label-sm`
- optional `caption`, `code`, or domain-specific telemetry/data styles

Resolve:

- one-family versus paired-family strategy;
- display, narrative, label, and technical-data roles;
- casing rules;
- maximum weights used per view;
- fallback families and platform availability.

## Round 4: Layout and spacing

Required decisions:

- responsive model: fluid, fixed-max-width, adaptive, or platform-native;
- viewport/container limits;
- columns, gutters, margins, safe areas, and breakpoints in prose;
- containment and grouping principles;
- spacing token names and exact values.

Default rhythm when no existing system exists:

```yaml
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  gutter: 24px
  margin: 32px
```

Unitless values are appropriate for counts or ratios. Quote values such as `"5"` when they should remain strings.

## Round 5: Elevation, shapes, and motion implications

Resolve:

- depth method: shadows, borders, tonal layers, blur, scale, or flat contrast;
- explicit shadow geometry and color in prose when shadows are used;
- hierarchy levels and where each may appear;
- shape language and radius scale;
- whether pills/circles are reserved for specific atoms;
- whether motion reinforces depth, even though motion has no normative token group in the current schema.

Default radius scale:

```yaml
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
```

## Round 6: Components and states

Identify the product's actual atoms. For each relevant component, resolve:

- visual role and hierarchy;
- background and text colors;
- typography reference;
- radius;
- padding, size, height, or width;
- default, hover, active/pressed, focus-visible, disabled, selected, error, and loading behavior as applicable.

Common components:

- buttons;
- chips;
- lists;
- tooltips;
- checkboxes;
- radio buttons;
- input fields and text areas.

Use sibling keys for variants:

```yaml
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
```

## Round 7: Do's and Don'ts

Ask for or propose absolute boundaries in these categories:

- color emphasis and contrast;
- typography mixing and hierarchy;
- spacing and containment;
- corner-radius consistency;
- component state visibility;
- destructive action treatment;
- content density and truncation;
- responsive behavior;
- accessibility and focus indication;
- prohibited visual clichés or brand mismatches.

Each rule must be observable. Prefer “Do keep focus rings at least 2px and visually distinct from borders” over “Do make focus obvious.”

## Completion gate

The dataset is complete when:

- metadata has a name;
- colors includes a valid `primary` and sufficient semantic roles;
- typography is implementable, not merely descriptive;
- spacing and rounded scales contain exact values;
- component tokens cover the product's critical atoms and states;
- all eight prose sections have enough decisions to guide an unfamiliar agent;
- every conflict is resolved;
- every remaining assumption is explicitly accepted or disclosed as an agent default.
