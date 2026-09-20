---
name: intent-layer
description: >
  Set up hierarchical Intent Layer (AGENTS.md files) for codebases.
  Use when initializing a new project, adding context infrastructure to an existing repo,
  user asks to set up AGENTS.md, add intent layer, make agents understand the codebase,
  or scaffolding AI-friendly project documentation.
---

# Intent Layer

Hierarchical AGENTS.md infrastructure so agents navigate codebases like senior engineers.

## Core Principle

**Only ONE root context file.** Keep `AGENTS.md` as the Codex/Open Agent instruction root. Child `AGENTS.md` files are encouraged for complex subsystems.

## Workflow

```
1. Detect state
   python scripts/intent_tools.py detect-state /path/to/project
   → Returns: none | partial | complete

2. Route
   none/partial → Initial setup (steps 3-5)
   complete     → Maintenance (step 6)

3. Measure [gate - show table first]
   python scripts/intent_tools.py analyze /path/to/project
   python scripts/intent_tools.py estimate /path/to/each/source/dir

4. Decide
   No root file  → Ask whether to add a root AGENTS.md.
   Has root file → Add Intent Layer section + child nodes if needed

5. Execute
   Use references/templates.md for structure
   Use references/node-examples.md for real-world patterns
   Validate: one root, READ-FIRST directive, <4k tokens per node

6. Maintenance mode (when state=complete)
   Ask user:
   a) Audit nodes     → Use references/capture-protocol.md for SME questions
   b) Find candidates → Re-measure tokens, suggest new nodes
   c) Both
```

## When to Create Child Nodes

| Signal | Action |
|--------|--------|
| >20k tokens in directory | Create AGENTS.md |
| Responsibility shift | Create AGENTS.md |
| Hidden contracts/invariants | Document in nearest ancestor |
| Cross-cutting concern | Place at LCA |

Do NOT create for: every directory, simple utilities, test folders (unless complex).

## Capture Questions

When documenting existing code, ask:
1. What does this area own? What's out of scope?
2. What invariants must never be violated?
3. What repeatedly confuses new engineers?
4. What patterns should always be followed?

## Resources

**Scripts:**
- `scripts/intent_tools.py detect-state` - Check Intent Layer state (none/partial/complete)
- `scripts/intent_tools.py analyze` - Find semantic boundaries
- `scripts/intent_tools.py estimate` - Measure directory complexity

**References:**
- `references/templates.md` - Root and child node templates
- `references/node-examples.md` - Real-world examples
- `references/capture-protocol.md` - SME interview protocol
