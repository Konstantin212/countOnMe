---
description: Run multi-agent workflow (feature/bugfix/refactor)
---

Run an orchestrated multi-agent workflow for the following task:

**Task:** $ARGUMENTS

## Workflow Selection

Based on the task type, follow the appropriate workflow:

### Flow 1: New Feature (Full)

For new features, especially those touching 5+ files or introducing a new domain:

1. **Architect** → Analyze system design, trade-offs, component responsibilities (use `architect` agent)
2. **Plan** → Break design into phased implementation steps, get user approval (use `planner` agent)
3. **Implement** → Delegate to developer agents based on scope:
   - `backend/` changes → **backend-developer** agent
   - `client/` changes → **fe-developer** agent
   - Both → Run **both developers in parallel**
   - Developer agents follow TDD internally (write test → implement → verify)
4. **Verify** → Run full verification suite (use `verifier` agent)
5. **Review** → Run specialist reviewers based on changed files:
   - `backend/` → **backend-reviewer** agent
   - `client/` → **fe-reviewer** agent
   - Both → Run **both reviewers in parallel**
6. **Security** → Scan for vulnerabilities if auth/input/API involved (use `security-reviewer` agent)
7. **Doc** → Update or create documentation in `docs/` (use `doc-writer` agent)

### Flow 2: Bug Fix

1. **Analyze** → Reproduce the bug, identify root cause and affected files
2. **Implement Fix** → Delegate to the appropriate developer agent:
   - `backend/` bug → **backend-developer** (write failing test → fix → verify)
   - `client/` bug → **fe-developer** (write failing test → fix → verify)
3. **Verify** → Run full verification suite (use `verifier` agent)
4. **Review** → Run specialist reviewer(s) based on changed files:
   - `backend/` → **backend-reviewer**
   - `client/` → **fe-reviewer**

### Flow 3: Refactor

1. **Verify Baseline** → Run full verification suite to establish green baseline (use `verifier` agent)
2. **Plan** → Identify what to change and in what order (use `planner` agent), get user approval
3. **Implement** → Delegate to developer agents:
   - `backend/` changes → **backend-developer**
   - `client/` changes → **fe-developer**
   - Both → Run **both in parallel**
4. **Clean** → Remove any dead code left behind (use `refactor-cleaner` agent)
5. **Verify** → Confirm everything still passes (use `verifier` agent)
6. **Review** → Run specialist reviewer(s):
   - `backend/` → **backend-reviewer**
   - `client/` → **fe-reviewer**

### Flow 4: Code Review Only

1. **Route** → Determine changed files (backend, client, or both)
2. **Review** → Run in parallel:
   - `backend/` changes → **backend-reviewer**
   - `client/` changes → **fe-reviewer**
3. **Security** → If security-sensitive changes detected → **security-reviewer**

### Flow 5: Architecture Decision

1. **Architect** → Analyze requirements, produce design with trade-offs (use `architect` agent)
2. **ADR** → Create Architecture Decision Record in `docs/architecture/`
3. **Plan** → Turn design into implementation phases (use `planner` agent), get user approval

### Flow 6: Small Fix (Single File, Skip Architect)

1. **Plan** → Lightweight planning (use `planner` agent)
2. **Implement** → **fe-developer** or **backend-developer** based on file location
3. **Verify** → Run verification (use `verifier` agent)
4. **Review** → Run specialist reviewer: **fe-reviewer** or **backend-reviewer**

## Agent Reference

| Agent | Role | Model |
|-------|------|-------|
| `architect` | System design, trade-offs, ADRs | opus |
| `planner` | Implementation phases, step breakdown | opus |
| `fe-developer` | Implement client/ code (TypeScript/RN) | sonnet |
| `backend-developer` | Implement backend/ code (Python/FastAPI) | sonnet |
| `verifier` | Type check + lint + tests | haiku |
| `fe-reviewer` | Deep frontend code review | sonnet |
| `backend-reviewer` | Deep backend code review | sonnet |
| `security-reviewer` | Security vulnerability scanning | sonnet |
| `refactor-cleaner` | Dead code removal | sonnet |
| `doc-writer` | Documentation generation | haiku |
| `tdd-guide` | TDD cycle enforcement | sonnet |
| `build-fixer` | Incremental error fixing | sonnet |
| `code-reviewer` | Generic review (routes to specialists) | sonnet |

## Rules

- Always get user approval before starting implementation
- Run verification after every significant change
- Stop and ask if any check fails unexpectedly
- Report progress after each workflow step
- Use specialist reviewers (backend-reviewer / fe-reviewer), not the generic code-reviewer
- Run independent agents in parallel when possible (e.g., fe-developer ∥ backend-developer)
- Developer agents carry all project knowledge — do NOT write code directly
