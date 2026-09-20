# Semantic Rules


## Contents

- [Evidence hierarchy](#evidence-hierarchy)
- [Analysis procedure](#analysis-procedure)
- [Inclusion test](#inclusion-test)
- [Category decisions](#category-decisions)
  - [Added](#added)
  - [Changed](#changed)
  - [Deprecated](#deprecated)
  - [Removed](#removed)
  - [Fixed](#fixed)
  - [Security](#security)
- [Breaking-change inspection](#breaking-change-inspection)
- [Synthesis rules](#synthesis-rules)
- [Noise and dependency edge cases](#noise-and-dependency-edge-cases)
- [Reconstruction rules](#reconstruction-rules)
## Evidence hierarchy

Use the strongest available evidence in this order:

1. Diff and shipped behavior
2. Tests that demonstrate changed behavior
3. Public interfaces, schemas, migrations, configuration, CLI help, UI copy, and documentation
4. Pull-request or issue context available locally
5. Commit subject/body
6. Filename and keyword hints

A commit message may be wrong, vague, humorous, generated, or implementation-focused. Never classify from a prefix alone.

## Analysis procedure

For each release segment:

1. Cluster commits that implement the same user-visible outcome.
2. Identify the external actor affected: end user, API consumer, operator, administrator, contributor, or none.
3. State the observable outcome and compatibility impact.
4. Assign one Keep a Changelog category.
5. Inspect the diff when category, impact, or inclusion is uncertain.
6. Synthesize one concise entry with source commit IDs.
7. Record omitted commits and reasons in the plan for auditability.

## Inclusion test

Include a change when at least one is true:

- It adds, changes, deprecates, removes, or fixes observable behavior.
- It changes a public API, CLI, configuration key, data/schema contract, migration path, installation process, deployment requirement, or supported platform.
- It materially changes performance, reliability, accessibility, privacy, or security.
- It changes packaging or dependencies in a way users/operators must know.
- It corrects user-facing documentation needed to use or migrate the product safely.

Omit by default when all effects are internal:

- formatting, linting, comments, naming, or code movement;
- test-only additions or fixture churn;
- internal refactors with no supported behavior change;
- merge commits that duplicate child commits;
- routine CI, build, release automation, or repository housekeeping;
- generated files or lockfile-only churn;
- version bumps already represented by a release heading;
- dependency updates with no relevant shipped, security, or compatibility effect.

Do not omit merely because a commit says `refactor`, `chore`, `cleanup`, or `test`. Inspect when affected paths or stats suggest external impact.

## Category decisions

### Added

Use for a new capability, endpoint, command, option, integration, supported platform, workflow, or user-visible output.

### Changed

Use for altered existing behavior, UX, defaults, performance, reliability, compatibility, installation, or operational workflow. Prefix `**Breaking:**` when existing consumers must change.

### Deprecated

Use only when the project still supports the feature but explicitly schedules removal or replacement.

### Removed

Use for deleted features, commands, options, endpoints, formats, or support. Prefix `**Breaking:**` when migration is required.

### Fixed

Use for corrected incorrect behavior, regressions, crashes, data loss, rendering errors, race conditions, or inaccurate docs that blocked correct usage.

### Security

Use for vulnerability remediation, exposure reduction, authentication/authorization corrections, secret handling, unsafe defaults, dependency CVEs with shipped relevance, or published advisories. Avoid disclosing exploit-enabling details not already public.

## Breaking-change inspection

Inspect diffs for:

- public symbol, endpoint, command, flag, or configuration removal/rename;
- changed defaults, validation, error behavior, serialization, database schema, or wire format;
- authentication, permission, policy, environment, or deployment requirement changes;
- dropped runtime, platform, browser, API, or dependency compatibility;
- migrations that are not backward compatible or reversible.

A breaking entry must identify what changed and the required migration when evidence supports it.

## Synthesis rules

- Lead with the user-visible outcome: “Added…”, “Improved…”, “Fixed…”, “Removed…”.
- Remove Conventional Commit prefixes, issue-only labels, branch names, hashes, and internal filenames unless the name is a public interface.
- Combine implementation commits, tests, follow-up fixes, and documentation for one feature into one entry.
- Split a cluster only when it contains distinct outcomes or categories.
- Avoid unsupported claims such as “faster,” “safer,” or “fully” unless evidence demonstrates them.
- Prefer 8–24 words per bullet; use a second sentence only for migration or critical context.
- Match existing project voice when it is consistent and professional. Otherwise use neutral, direct language.
- Use backticks for public commands, options, configuration keys, APIs, filenames, and literal values.
- End bullets without a period unless the repository consistently uses periods or the bullet contains multiple sentences.

## Noise and dependency edge cases

Include dependency changes when they:

- remediate a relevant vulnerability;
- drop or add supported runtime/platform versions;
- change required peer/system dependencies;
- materially alter bundle size, startup, compatibility, or deployment;
- enable a user-facing capability that is not otherwise represented.

For generated or AI-authored commit bursts, cluster by actual diff outcome rather than message wording or commit count.

## Reconstruction rules

- Use reachable tags as release boundaries when they form an ancestry chain.
- Preserve documented release dates from an existing changelog or release metadata when reliable; otherwise use tag creator dates and state that assumption.
- Place commits after the latest reachable tag under `Unreleased`.
- Do not fabricate entries for empty ranges.
- Preserve pre-existing historical prose that cannot be reconstructed confidently unless the user explicitly requests replacement.
