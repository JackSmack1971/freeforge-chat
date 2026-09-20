# Changelog Plan Schema


## Contents

- [Top-level object](#top-level-object)
- [Actions](#actions)
  - [`update_unreleased`](#update-unreleased)
  - [`release`](#release)
  - [`reconstruct`](#reconstruct)
- [Release object](#release-object)
- [Omitted object](#omitted-object)
- [Links](#links)
Create UTF-8 JSON. The validation script rejects unknown actions, malformed entries, duplicate releases, placeholders, unsafe target paths, and inconsistent version/date rules.

## Top-level object

```json
{
  "schema_version": 1,
  "action": "update_unreleased",
  "target_file": "CHANGELOG.md",
  "title": "Changelog",
  "preamble": "All notable changes to this project will be documented in this file.",
  "source": {
    "mode": "since-tag",
    "range": "v0.3.0..HEAD",
    "generated_date": "2026-07-04",
    "target_version": null,
    "assumptions": []
  },
  "releases": [],
  "omitted": [],
  "links": {}
}
```

## Actions

### `update_unreleased`

Use exactly one release with `"version": "Unreleased"` and `"date": null`. The writer creates or updates the existing Unreleased block and preserves all released history.

### `release`

Use exactly one release with a concrete version and ISO date. The writer:

1. merges planned bullets into the current Unreleased body;
2. creates the target release directly below an empty Unreleased heading;
3. rejects duplicate target versions;
4. preserves older releases.

Use this for release preparation. The plan may provide comparison-link updates.

### `reconstruct`

Provide all desired releases, newest first, normally beginning with Unreleased. The writer replaces the changelog only when invoked with `--allow-replace`.

## Release object

```json
{
  "version": "0.4.0",
  "date": "2026-07-04",
  "sections": {
    "Added": [
      {
        "text": "Added date-bounded changelog generation for scheduled release summaries",
        "commits": ["a1b2c3d"],
        "breaking": false
      }
    ],
    "Changed": [],
    "Deprecated": [],
    "Removed": [],
    "Fixed": [],
    "Security": []
  }
}
```

Rules:

- Allowed sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Section arrays may be omitted when empty.
- `text` is a single-line bullet without a leading dash.
- `commits` contains abbreviated or full hexadecimal commit IDs; use all material source commits for a synthesized entry.
- Set `breaking: true` only for `Changed` or `Removed`. The writer prefixes `**Breaking:**` when the text does not already contain it.
- Unreleased has `date: null`; released versions require `YYYY-MM-DD`.
- Versions omit surrounding brackets; retain a leading `v` only when that is the repository convention.

## Omitted object

```json
{
  "commit": "d4e5f6a",
  "reason": "Test-only coverage expansion with no shipped behavior change"
}
```

Include one record per omitted commit or a `commits` array for a homogeneous cluster. Reasons must be evidence-based and concise.

## Links

`links` maps labels to complete comparison or release URLs:

```json
{
  "Unreleased": "https://github.com/org/repo/compare/v0.4.0...HEAD",
  "0.4.0": "https://github.com/org/repo/compare/v0.3.0...v0.4.0"
}
```

Omit links when the canonical repository URL or tag relationship is uncertain. Existing links are preserved during incremental actions unless the plan updates the same label.

