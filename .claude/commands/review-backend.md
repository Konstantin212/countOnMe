---
description: Review backend code changes for quality, security, device scoping, and FastAPI patterns
---

Review the recent backend code changes using the **backend-reviewer** agent.

**Scope:** $ARGUMENTS

## Instructions

1. Focus on files in `backend/` directory
2. Run diagnostic commands: `cd backend && ruff check app/`
3. Apply severity-based review: CRITICAL → HIGH → MEDIUM → LOW
4. Check CountOnMe-specific patterns: device scoping, soft deletes, service-layer architecture
5. Report findings with file:line references and fix suggestions
6. Provide verdict: APPROVE / REQUEST CHANGES / BLOCK

## When to Use

- After implementing backend changes
- Before committing backend code
- As part of `/orchestrate` workflow
- When specifically reviewing Python/FastAPI code

## Related

- Agent: `.claude/agents/backend-reviewer.md`
- Skills: `backend-patterns`, `python-patterns`, `python-testing`, `security-review`
