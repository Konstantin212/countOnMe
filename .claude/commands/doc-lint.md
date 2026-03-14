---
description: Validate documentation quality, structure, and accuracy against source code
---

Validate documentation for compliance with project templates and accuracy against source code.

**Target:** $ARGUMENTS

## Instructions

### If target is a specific file (e.g., `features/product-management.md`):

1. Launch the **doc-reviewer** agent on `docs/$ARGUMENTS`
2. Report the results

### If target is `all` or empty:

1. Use Glob to find all `.md` files in `docs/` (excluding `docs/plans/`)
2. For each file (except `docs/README.md` and `docs/api/README.md`):
   - Launch the **doc-reviewer** agent
3. Aggregate results into a summary report:

```
## Doc Lint Results

| File | Structural | Content | Status |
|------|-----------|---------|--------|
| features/product-management.md | PASS | 2 WARN | WARN |
| features/food-tracking.md | PASS | PASS | PASS |
| api/products.md | 1 FAIL | PASS | FAIL |

### Failures
- api/products.md: Missing frontmatter field: last-updated

### Warnings
- features/product-management.md: Documented hook method `refresh()` not found in useProducts.ts exports
```

## Rules

- Run doc-reviewer agents in parallel where possible (batch of 3-4 at a time)
- Report ALL findings — do not stop at first failure
- FAIL = must fix before merge; WARN = should fix; PASS = compliant
- Exclude `docs/plans/` from validation (plans have relaxed rules)
- Exclude `docs/README.md` and `docs/api/README.md` (index files, no frontmatter)
