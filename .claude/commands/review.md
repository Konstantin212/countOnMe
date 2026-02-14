---
description: Review recent code changes for quality, security, and patterns
---

Review the recent code changes for quality, security, and adherence to CountOnMe project patterns.

**Scope:** $ARGUMENTS

## Review Checklist

### Correctness & Logic
- Does the code do what it's supposed to?
- Are edge cases handled?

### Security
- No hardcoded secrets
- Device scoping enforced (backend)
- Input validation present
- No injection vulnerabilities

### Project Patterns
- Immutability (no state mutations)
- Hooks own state (screens don't touch AsyncStorage)
- Import aliases used (@hooks, @services, etc.)
- StyleSheet.create + theme values (no inline styles, no hardcoded colors)
- Backend: routers are thin, services have logic, queries use ORM

### TypeScript/Python Quality
- No `any` types / proper type hints
- Proper error handling
- Functions <50 lines, files <800 lines

## Instructions

1. Read the changed files
2. Run through each checklist item
3. Report findings using severity levels: Critical / Important / Suggestion
4. Provide specific fix suggestions for each issue
