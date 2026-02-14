---
description: Implement frontend code from an approved plan using TDD and project conventions
---

Implement the following frontend task using the **fe-developer** agent.

**Task:** $ARGUMENTS

## Instructions

1. Read the approved plan and identify client/ files to create/modify
2. Study existing similar files to match conventions
3. Implement with TDD: write test → run (fail) → implement → run (pass) → refactor
4. Follow all project rules: particles, theme, import aliases, immutability, hook ownership
5. Run verification after each file: `cd client && npx tsc --noEmit && npm test`
6. Hand off to `verifier` → `fe-reviewer` for quality check

## When to Use

- After a plan is approved that includes client/ changes
- When implementing a new screen, hook, or component
- When fixing a frontend bug
- As part of `/orchestrate` workflow

## Related

- Agent: `.claude/agents/fe-developer.md`
- Skills: `react-native-patterns`, `coding-standarts`, `tdd-workflow`, `security-review`
- Handoff: After implementation → use `/verify` then `/review-frontend`
