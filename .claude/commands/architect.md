---
description: Create architectural design with trade-offs for new features or significant changes
---

Analyze the following request and create an architectural design using the **architect** agent.

**Request:** $ARGUMENTS

## Instructions

1. Analyze the current architecture (read key files, docs, existing patterns)
2. Gather functional and non-functional requirements
3. Produce a design proposal with component responsibilities and data flow
4. Document trade-offs for each significant decision (pros/cons/alternatives)
5. Create an ADR in `docs/architecture/` if the decision is significant
6. Hand off to `planner` agent for implementation phases

## When to Use

- New features touching 5+ files
- Adding a new domain area (new models, new screens)
- Architectural decisions (storage strategy, sync approach, new dependencies)
- Significant refactors that change system structure
- When you need to understand WHY before deciding HOW

## Related

- Agent: `.claude/agents/architect.md`
- Skills: `backend-patterns`, `coding-standarts`, `postgress-patterns`, `project-guidlane-example`
- Handoff: After architect → use `/plan` for implementation phases
