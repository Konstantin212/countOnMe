---
description: Run tests with coverage and enforce 80% minimum threshold
---

Run tests with coverage analysis and enforce the project's 80% minimum coverage threshold.

**Scope:** $ARGUMENTS (leave empty for both, or specify "client" / "backend")

## Checks to Run

### Client (client/)
```bash
cd client && pnpm run test:coverage
```

### Backend (backend/)
```bash
cd backend && pytest --cov=app --cov-report=term-missing
```

## Instructions

1. Run tests with coverage for the specified scope (or both)
2. Parse the coverage output
3. Identify files below 80% coverage
4. Determine overall pass/fail based on the 80% threshold

## Report Format

```
## Coverage Gate Report

### Client
- Overall: XX% (PASS/FAIL)
- Files below 80%:
  - src/hooks/useProducts.ts: 65% — missing: lines 45-60, 88-95
  - src/screens/ProductFormScreen.tsx: 72% — missing: lines 110-130

### Backend
- Overall: XX% (PASS/FAIL)
- Files below 80%:
  - app/services/products.py: 70% — missing: lines 55-80

### Untested Files (0% coverage)
- (list any files with no tests at all)

### Priority Improvements
1. [file] — adding X tests would bring coverage to Y%
2. [file] — adding X tests would bring coverage to Y%

### Gate: PASS / FAIL
```

The gate FAILS if overall coverage is below 80% for either client or backend.
