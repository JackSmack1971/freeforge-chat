# Testing anti-patterns

- Do not call a test green because it imported successfully; assert the behavior.
- Do not make the red test fail from a typo, missing fixture, or unavailable dependency.
- Do not add mocks when a small real collaborator is available; mock only external or nondeterministic boundaries.
- Do not refactor while the target behavior is red.
- Do not hide a full-suite regression behind a focused test result.
