---
description: Review recent code changes for quality, security, and patterns
---

Review the recent code changes using the appropriate specialized reviewer(s).

**Scope:** $ARGUMENTS

## Smart Routing

Determine which files have changed and route to the correct reviewer:

1. **Check changed files**: Run `git diff --name-only HEAD~1` (or `git diff --name-only` for unstaged changes)
2. **Route by directory**:
   - Files in `backend/` → Use **backend-reviewer** agent (deep Python/FastAPI/SQLAlchemy review)
   - Files in `client/` → Use **fe-reviewer** agent (deep TypeScript/React Native review)
   - Both directories changed → Run **both reviewers in parallel**
   - Neither → Fall back to generic review checklist below

## Review Checklist (Fallback for Mixed/Other Files)

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

1. Identify changed files and determine scope (backend, frontend, or both)
2. Delegate to the appropriate specialist reviewer(s)
3. If both changed, run both reviews in parallel
4. Report combined findings with severity levels: Critical / Important / Suggestion
5. Provide a unified verdict: APPROVE / REQUEST CHANGES / BLOCK

## Related

- Agent: `.claude/agents/backend-reviewer.md` — For `backend/` changes
- Agent: `.claude/agents/fe-reviewer.md` — For `client/` changes
- Agent: `.claude/agents/code-reviewer.md` — Generic fallback
