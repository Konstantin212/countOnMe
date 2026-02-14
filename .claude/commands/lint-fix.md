---
description: Auto-fix linting issues
---

Auto-fix linting issues across the codebase.

## Instructions

1. **Client** (if `client/` exists):
   - Run `cd client && npx eslint src/ --fix`
   - Report files changed and remaining issues

2. **Backend** (if `backend/` exists):
   - Run `cd backend && ruff check app/ --fix`
   - Run `cd backend && ruff format app/`
   - Report files changed and remaining issues

3. Run verification to confirm fixes didn't break anything:
   - Client: `cd client && npx tsc --noEmit`
   - Backend: `cd backend && ruff check app/`

4. Report summary of all changes made

## Rules

- Always run verification after fixes
- If fixes cause new errors, revert and report
- Report both fixed and remaining issues
