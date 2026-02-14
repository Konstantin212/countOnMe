---
description: Run multi-agent workflow (feature/bugfix/refactor)
---

Run an orchestrated multi-agent workflow for the following task:

**Task:** $ARGUMENTS

## Workflow Selection

Based on the task type, follow the appropriate workflow:

### Feature Workflow
1. **Plan** → Analyze requirements, break into phases, get user approval
2. **TDD** → For each phase: write tests first, then implement
3. **Verify** → Run type check + lint + tests
4. **Review** → Check code quality, security, patterns
5. **Security** → Scan for vulnerabilities (if auth/input/API involved)
6. **Doc** → Update or create documentation in docs/

### Bug Fix Workflow
1. **Analyze** → Reproduce the bug, identify root cause
2. **TDD** → Write a failing test that captures the bug
3. **Fix** → Implement minimal fix to pass the test
4. **Verify** → Run full verification suite
5. **Review** → Ensure fix doesn't introduce new issues

### Refactor Workflow
1. **Verify** → Establish green baseline (all tests pass)
2. **Plan** → Identify what to change and in what order
3. **Refactor** → Make changes incrementally, test after each
4. **Clean** → Remove any dead code left behind
5. **Verify** → Confirm everything still passes

## Rules

- Always get user approval before starting implementation
- Run verification after every significant change
- Stop and ask if any check fails unexpectedly
- Report progress after each workflow step
