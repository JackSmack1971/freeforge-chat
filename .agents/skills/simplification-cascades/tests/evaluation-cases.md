# Evaluation cases

1. Run without `--path`; it scans the current directory and emits valid JSON.
2. Run with a missing path; it exits nonzero and emits only a bounded error.
3. Run with `--verify`; the score key is `post_cascade_score`.
4. Run on a synthetic directory containing code/config fixtures; output keeps
   the documented fields and does not execute fixture files.
5. Inspect the target package for Claude-only frontmatter or `run_command`.
