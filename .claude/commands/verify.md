---
description: Run full verification suite (type check + lint + tests)
---

Run the full verification suite for the CountOnMe project.

## What to check

Determine which parts of the codebase have changed and run the appropriate checks:

### Client (if client code changed, or if running full verify)
```bash
cd client && npx tsc --noEmit          # Type check
cd client && npm test                   # Unit tests
```

### Backend (if backend code changed, or if running full verify)
```bash
cd backend && ruff check app/           # Lint
cd backend && pytest --cov=app --cov-report=term-missing  # Tests + coverage
```

## Instructions

1. Run all relevant checks (run client and backend in parallel if both needed)
2. Parse the output
3. Report results in this format:

```
## Verification Results
- Client type check: PASS/FAIL
- Client tests: PASS/FAIL (X passed, Y failed)
- Backend lint: PASS/FAIL
- Backend tests: PASS/FAIL (X passed, Y failed, Z% coverage)
- **Overall: PASS/FAIL**
```

If any check fails, list the specific errors grouped by file.

$ARGUMENTS
