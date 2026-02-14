---
description: Find and remove dead code, unused exports, and duplicates
---

Analyze the codebase for dead code and safely remove it.

**Scope:** $ARGUMENTS

## Process

1. **Establish baseline** — Run full test suite first to confirm green state
2. **Detect** — Run analysis tools:
   - Client: `npx tsc --noEmit`, `npx eslint src/ --rule 'no-unused-vars: warn'`
   - Backend: `ruff check app/`
   - Grep for unused exports across the codebase
3. **Categorize** — SAFE (no refs) / CAREFUL (maybe dynamic) / RISKY (public API)
4. **Remove SAFE items** — One batch at a time
5. **Test after each batch** — Revert immediately if tests fail
6. **Report** — List everything removed and kept

## NEVER REMOVE

- `client/src/storage/` — Persistence layer
- `client/src/services/utils/calories.ts` — Core business logic
- `backend/app/models/` — ORM models
- `backend/alembic/versions/` — Migrations
- `backend/app/services/auth.py` — Auth service

## Rules

- Delete one item at a time, test after each
- If tests fail, revert with `git checkout -- <file>`
- Never refactor and clean in the same pass
- Be conservative — when in doubt, keep it
