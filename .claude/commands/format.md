---
description: Auto-format code
---

Auto-format code across the codebase.

## Instructions

1. **Client** (if `client/` exists and prettier is installed):
   - Run `cd client && npx prettier --write "src/**/*.{ts,tsx,js,jsx,json}"`
   - Report number of files changed

2. **Backend** (if `backend/` exists):
   - Run `cd backend && ruff format app/`
   - Report number of files changed

3. Report summary of all formatting changes

## Rules

- Only format, never fix logic or lint issues
- Report the file count, not individual file names (unless < 5 files)
- If prettier is not installed, skip client formatting and suggest installing it
