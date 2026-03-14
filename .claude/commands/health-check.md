---
description: Run comprehensive anti-pattern scan across the entire codebase
---

Run a full codebase health check, scanning for violations of project rules from CLAUDE.md.

**Scope:** $ARGUMENTS (leave empty for full scan, or specify "client" / "backend")

## Checks to Run

### TypeScript / React Native (client/src/)
1. **`any` usage**: Grep for `: any`, `as any`, `any[]`, `<any>` in non-test `.ts/.tsx` files
2. **Inline styles**: Grep for `style={{` in `.tsx` files
3. **console.log**: Grep for `console.log(` in non-test `.ts/.tsx` files
4. **@ts-ignore**: Grep for `@ts-ignore` (should use `@ts-expect-error`)
5. **Non-null assertions**: Grep for `!.` and `!)` patterns (the `!` operator)
6. **Direct storage in screens**: Check `screens/` for `AsyncStorage` imports
7. **Missing StyleSheet**: Check `.tsx` files for inline style objects without `StyleSheet.create`

### Python / FastAPI (backend/app/)
1. **print() calls**: Grep for `print(` in non-test `.py` files
2. **Raw SQL in routers**: Check `api/routers/` for `session.execute`, `select(`, `update(`, `delete(`
3. **Missing device scoping**: Check `services/` for `select(` without nearby `device_id`
4. **Missing soft delete filter**: Check `services/` for queries without `deleted_at` filter

### Code Smells (both)
1. **Large files**: Find files exceeding 800 lines
2. **Long functions**: Find functions exceeding 50 lines
3. **Deep nesting**: Find code with >4 levels of indentation
4. **TODO/FIXME/HACK**: Count remaining TODO markers

## Instructions

1. Run all applicable checks using grep/glob tools
2. Collect findings with file:line references
3. Group by severity:
   - **Critical**: Security issues (missing device scoping, hardcoded secrets)
   - **Warning**: Rule violations (any types, inline styles, print calls)
   - **Info**: Code smells (large files, TODOs, deep nesting)

## Report Format

```
## Health Check Report

### Critical (X issues)
- file:line — description

### Warning (X issues)
- file:line — description

### Info (X issues)
- file:line — description

### Summary
- Critical: X | Warning: Y | Info: Z
- Files scanned: N
```

If no issues found in a category, omit that section.
