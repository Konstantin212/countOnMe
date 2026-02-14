---
description: Review frontend code changes for quality, theme compliance, hook patterns, and React Native best practices
---

Review the recent frontend code changes using the **fe-reviewer** agent.

**Scope:** $ARGUMENTS

## Instructions

1. Focus on files in `client/` directory
2. Run diagnostic commands: `cd client && npx tsc --noEmit`
3. Apply severity-based review: CRITICAL → HIGH → MEDIUM → LOW
4. Check CountOnMe-specific patterns: theme system, particles, import aliases, hook ownership, immutability
5. Report findings with file:line references and fix suggestions
6. Provide verdict: APPROVE / REQUEST CHANGES / BLOCK

## When to Use

- After implementing frontend changes
- Before committing client code
- As part of `/orchestrate` workflow
- When specifically reviewing TypeScript/React Native code

## Related

- Agent: `.claude/agents/fe-reviewer.md`
- Skills: `react-native-patterns`, `coding-standarts`, `tdd-workflow`, `security-review`
