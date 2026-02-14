---
description: Implement a feature using TDD (Red-Green-Refactor)
---

Implement the following using strict TDD methodology (Red-Green-Refactor):

**Feature:** $ARGUMENTS

## TDD Cycle

For each piece of functionality:

### 1. RED — Write a failing test first
- Create test file if it doesn't exist (co-located with source)
- Write test that describes the expected behavior
- Run test to confirm it FAILS for the right reason

### 2. GREEN — Write minimal code to pass
- Implement just enough to make the test pass
- No extra features, no premature optimization
- Run test to confirm it PASSES

### 3. REFACTOR — Improve while green
- Clean up code, improve naming, remove duplication
- Run tests again to confirm still PASSING

## Rules

- NEVER write implementation before the test
- One test at a time, one concept per test
- Use AAA pattern (Arrange, Act, Assert)
- Test edge cases: zero, negative, empty, null, wrong device
- Client tests: Vitest (`cd client && npm test`)
- Backend tests: pytest (`cd backend && pytest`)
- Target 80%+ coverage overall, 95% for critical paths
