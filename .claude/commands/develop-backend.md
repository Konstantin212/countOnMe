---
description: Implement backend code from an approved plan using TDD and service-layer architecture
---

Implement the following backend task using the **backend-developer** agent.

**Task:** $ARGUMENTS

## Instructions

1. Read the approved plan and identify backend/ files to create/modify
2. Study existing similar files to match conventions
3. Implement in dependency order: Models → Schemas → Services → Routers → Tests
4. Follow TDD: write test → run (fail) → implement → run (pass) → refactor
5. Enforce: device scoping, soft deletes, thin routers, async operations, type hints
6. Run verification after each file: `cd backend && ruff check app/ && pytest`
7. If models changed: run `alembic revision --autogenerate -m "description"`
8. Hand off to `verifier` → `backend-reviewer` for quality check

## When to Use

- After a plan is approved that includes backend/ changes
- When implementing a new endpoint, service, or model
- When fixing a backend bug
- As part of `/orchestrate` workflow

## Related

- Agent: `.claude/agents/backend-developer.md`
- Skills: `backend-patterns`, `python-patterns`, `python-testing`, `postgress-patterns`, `security-review`
- Handoff: After implementation → use `/verify` then `/review-backend`
