---
description: Verify adherence to project architectural patterns
---

Check the codebase for violations of CountOnMe's architectural patterns defined in CLAUDE.md.

**Scope:** $ARGUMENTS (leave empty for full check, or specify "client" / "backend")

## Architectural Patterns to Check

### Backend Patterns
1. **Router auth dependency**: All routers in `api/routers/` must use `Depends(get_current_device_id)` — not parse headers manually
2. **Service soft-delete filter**: All service query functions must filter `deleted_at.is_(None)` by default
3. **No business logic in routers**: Routers should only parse inputs, call services, return DTOs
4. **Schema separation**: No SQLAlchemy models in `schemas/`, no Pydantic schemas in `models/`

### Frontend Patterns
1. **Hook ownership**: Hooks must return objects with named methods — never expose raw `setState` functions
2. **Particle usage**: Screens with forms must use particles (FormField, Input, NumericInput, etc.) from `@particles`
3. **No direct storage**: Screens must not import from `@storage` — use hooks instead
4. **Import aliases**: Cross-folder imports must use `@` aliases, not relative paths like `../../`
5. **Theme consumption**: Components must use `useTheme()` hook — never import directly from `theme/colors.ts`

### Both
1. **Immutability**: No array `.push()`, `.splice()`, or direct object property assignment on state
2. **Explicit error handling**: All `async` calls must have try/catch or `.catch()`
3. **No `any`**: No `any` type in non-test TypeScript files

## Instructions

1. Run targeted grep/glob searches for each pattern
2. Report violations with file:line and the specific rule broken
3. Suggest the correct pattern for each violation

## Report Format

```
## Pattern Check Report

### Backend (X violations)
- [VIOLATION] app/api/routers/sync.py:15 — Direct SQL in router (should be in service)
- [OK] All routers use Depends(get_current_device_id)

### Frontend (X violations)
- [VIOLATION] src/screens/ProfileScreen.tsx:3 — Direct storage import (should use hook)
- [OK] All forms use particle components

### Summary
- Backend: X violations / Y checks
- Frontend: X violations / Y checks
```
