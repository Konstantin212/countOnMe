---
description: Fix build, type check, or lint errors incrementally
---

Fix the current build/type/lint errors in the CountOnMe project.

**Context:** $ARGUMENTS

## Process

1. Run the failing check to get current errors:
   - Client: `cd client && npx tsc --noEmit`
   - Backend: `cd backend && ruff check app/`
2. Parse and group errors by file
3. Fix ONE error at a time, starting with imports/types (they cascade)
4. Re-run check after each fix to confirm progress
5. Repeat until all errors are resolved

## Rules

- Fix root causes, not symptoms (cascading errors often have one source)
- Don't change behavior while fixing types
- If a fix introduces MORE errors, revert and try a different approach
- If the same error persists after 3 attempts, stop and report
- Keep changes minimal
- Preserve existing tests

## Report

After fixing, report: initial error count → final error count, list of fixes applied.
