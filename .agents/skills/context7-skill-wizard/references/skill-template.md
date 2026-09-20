# Skill Package Template

Use this reference while synthesizing a generated Codex skill.

## Frontmatter

Use only supported fields such as `name`, `description`, `compatibility`,
`license`, `metadata`, and `allowed-tools` when the host documents them.

`name` must be lowercase kebab-case and no longer than 64 characters. Keep
platform names out of the name unless they are essential to the technology.

`description` must say what the skill does, include three to five realistic
trigger phrases, state prerequisites, and avoid XML tags and first-person
wording. Keep it below 1024 characters.

## Body

Keep the body focused on prerequisites, the primary workflow, hard behavior
rules, and links to one-level-deep references. Move complete schemas, large
method tables, long examples, and background concepts to `references/`.

## Quality checks

- Every API signature and configuration key is supported by fetched docs.
- Mark sparse documentation with `UNKNOWN` or an inline coverage marker.
- Keep the generated package free of credentials, transcript bodies, and
  runtime-specific launcher or permission fields.
