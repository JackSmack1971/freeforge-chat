---
name: design-md-ideator
description: Collaboratively ideates, specifies, writes, and validates a standalone DESIGN.md design-system source of truth. Use when a user asks to create, define, refine, reconstruct, or audit DESIGN.md; establish colors, typography, spacing, radii, component tokens, visual rationale, or design guardrails; or produce a machine-readable design system for AI agents, Figma, Tailwind, or downstream tooling.
---

# Ideating DESIGN.md

Create a complete `DESIGN.md` through guided design decisions, then validate it deterministically.

## Operating contract

- Treat `resources/design-md-spec.md` as normative.
- Use the strict generation profile: YAML frontmatter is mandatory; all five token groups are non-empty; all eight canonical sections are present once, in order, as exact `##` headings.
- Tokens are normative. Prose explains intent and usage without contradicting tokens.
- Ask only unresolved, decision-relevant questions. Offer a recommended default with every question.
- Inspect available product context first: repository, screenshots, brand files, existing CSS/theme tokens, or user notes.
- Never invent claimed brand facts. Mark working assumptions in the decision ledger; resolve or clearly disclose them before final output.
- Produce the final artifact at `DESIGN.md` unless the user specifies another path.

## Required references

Read only as needed; all references are one level deep:

- Exact format and schema: `resources/design-md-spec.md`
- Adaptive questionnaire and defaults: `resources/questionnaire.md`
- Strict output contract and template: `resources/output-contract.md`
- Evaluation scenarios: `resources/evaluations.md`
- Portability and security notes: `resources/portability.md`

## Workflow

Copy and maintain this checklist:

- [ ] 1. Discover existing design evidence
- [ ] 2. Establish the creative direction
- [ ] 3. Resolve token decisions
- [ ] 4. Resolve component behavior and guardrails
- [ ] 5. Present the decision ledger
- [ ] 6. Generate `DESIGN.md`
- [ ] 7. Validate, fix, and revalidate
- [ ] 8. Deliver the file and verification result

### 1. Discover existing design evidence

Search local context before questioning the user. Prefer, in order:

1. Existing `DESIGN.md`, token files, CSS variables, Tailwind/theme config.
2. Product screenshots, mockups, logos, brand guides, and README/product descriptions.
3. Existing components and interaction states.
4. User-provided requirements.

Extract facts into a temporary decision ledger. Distinguish:

- `confirmed`: directly supported by evidence or accepted by the user.
- `recommended`: proposed by the agent with rationale.
- `assumed`: necessary default not yet accepted.
- `conflict`: sources disagree; requires resolution.

Do not overwrite an existing `DESIGN.md` until its useful decisions have been preserved and the user requested replacement or revision.

### 2. Establish the creative direction

Use `resources/questionnaire.md`. Ask in small batches, normally 3–5 decisions at a time. Start with:

- product, audience, and primary user tasks;
- desired personality and emotional response;
- density and platform constraints;
- accessibility target and technical consumers;
- references to emulate or avoid.

Convert vague adjectives into operational rules. Example: “premium” must become choices about contrast, whitespace, typography, motion, color restraint, and shape language.

If the user delegates decisions, choose coherent defaults and label them `recommended`, not `confirmed`.

### 3. Resolve token decisions

Capture a complete configuration dataset:

- metadata: `name`, optional `version`, optional `description`;
- colors: valid CSS color strings, including at least `primary`;
- typography: 9–15 semantic levels by default, each with precise properties;
- spacing: named dimensions or unitless numbers;
- rounded: named `px`, `em`, or `rem` dimensions;
- components: literal values or valid `{path.to.token}` references.

Default policies:

- Prefer `#RRGGBB` unless wide-gamut color is materially useful.
- Prefer semantic token names over presentation names.
- Prefer unitless line height.
- Prefer a 4px base with an 8px primary rhythm unless context suggests otherwise.
- Prefer token references in components to duplicate literals.
- Define state variants as sibling component keys, such as `button-primary-hover`.
- Add explicit error, focus, disabled, and selected states where relevant.

Check contrast implications while ideating. Do not claim WCAG conformance without calculable foreground/background pairs.

### 4. Resolve prose, components, and guardrails

Cover every canonical section:

1. Overview
2. Colors
3. Typography
4. Layout
5. Elevation & Depth
6. Shapes
7. Components
8. Do's and Don'ts

For components, prioritize actual product atoms. Unless irrelevant, address buttons, chips, lists, tooltips, checkboxes, radio buttons, and input fields. Specify layout conventions and interaction states in prose; put machine-usable assignments in frontmatter.

Guardrails must be executable and testable. Replace “keep it clean” with rules such as “use no more than one high-emphasis action per container.”

### 5. Present the decision ledger

Before generation, present a compact ledger containing:

- accepted creative direction;
- token naming and value decisions;
- unresolved assumptions or conflicts;
- defaults the agent selected;
- exclusions and non-goals.

Stop questioning when every required field is either `confirmed` or an explicitly disclosed `recommended` default. Do not block generation merely because the user delegated choices.

### 6. Generate `DESIGN.md`

Follow `resources/output-contract.md` exactly.

Generation rules:

- The first line is exactly `---`; the closing delimiter is exactly `---`.
- Emit frontmatter keys in this order: `version`, `name`, `description`, `colors`, `typography`, `rounded`, `spacing`, `components`; omit only optional metadata fields.
- Quote CSS colors, token references, and strings that YAML could coerce.
- Use two-space indentation and no tabs.
- Use one optional `#` document title, then exact canonical `##` sections.
- Keep prose specific, non-redundant, and consistent with token values.
- Never include placeholders, `[TODO]`, unresolved alternatives, or commentary in the final file unless the user explicitly requests a draft.

### 7. Validate, fix, and revalidate

Run:

```bash
python3 scripts/validate_design_md.py DESIGN.md --profile strict --format text
```

For machine-readable output:

```bash
python3 scripts/validate_design_md.py DESIGN.md --profile strict --format json
```

If validation fails:

1. Read every error and warning.
2. Fix the file, not the validator.
3. Run validation again.
4. Repeat until exit code `0`.

Do not deliver a strict-profile artifact that fails validation. If the runtime cannot execute Python, perform the same checks manually and explicitly disclose that script validation was unavailable.

### 8. Deliver

Provide:

- the completed `DESIGN.md` file or its full contents;
- a brief decision summary;
- validation command and status;
- disclosed assumptions, if any remain by user choice.

## Stop conditions

Stop and report rather than fabricate when:

- the user requires a brand fact that cannot be inferred or found;
- mutually exclusive constraints remain unresolved and no safe default exists;
- an existing file would be destructively replaced without authorization;
- validation still fails after fixes because the requested content violates the schema.

Otherwise, continue through generation and validation without unnecessary confirmation gates.
