# Evaluation cases

1. Confirm the skill is discovered under `.agents/skills`.
2. Run `python scripts/find_polluter.py --help`; it must work on Windows.
3. Run the helper with a missing pollution target and a glob that matches no tests; it must finish without shell errors.
4. Confirm all supporting references remain available and use the migrated helper name.
5. Confirm no Claude-specific frontmatter or `superpowers:` launcher references remain.
