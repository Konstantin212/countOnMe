---
description: Run only tests affected by changed files (smart test runner)
---

Determine which tests need to run based on changed files, then run only those.

**Scope:** $ARGUMENTS (leave empty to auto-detect from git diff, or specify file paths)

## Instructions

1. **Find changed files**: Run `git diff --name-only HEAD` (or use provided file paths)
2. **Map to test files** using these conventions:
   - Client: `src/hooks/useProducts.ts` → `src/hooks/useProducts.test.ts`
   - Client: `src/screens/ProductFormScreen.tsx` → `src/screens/ProductFormScreen.test.tsx`
   - Client: `src/storage/storage.ts` → `src/storage/storage.test.ts`
   - Backend: `app/services/products.py` → `tests/services/test_products_db.py`
   - Backend: `app/api/routers/products.py` → `tests/api/test_products_api.py`
3. **Find dependent tests**: Search for test files that import changed modules
4. **Run targeted tests**:
   - Client: `cd client && pnpm vitest run <test-files>`
   - Backend: `cd backend && pytest <test-files> -v`
5. **Report untested changes**: List changed files with no corresponding test file

## Report Format

```
## Scoped Test Results

### Changed Files → Test Files
- src/hooks/useProducts.ts → src/hooks/useProducts.test.ts (FOUND)
- src/screens/NewScreen.tsx → (NO TEST FILE)

### Test Results
- X tests passed, Y failed
- [list failures with details]

### Coverage Gaps
- Files with no test coverage:
  - path/to/file.ts (changed but no test file exists)
```
