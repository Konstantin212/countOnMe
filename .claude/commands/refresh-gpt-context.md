---
description: Regenerate all ChatGPT context documents from current codebase state
---

Refresh all ChatGPT context documents in `docs/chatgpt-context/` by analyzing the current codebase.

## What This Does

Regenerates 9 files (00-08) that are uploaded to a Custom GPT as knowledge base, giving it full project context without direct codebase access.

## Instructions

### Step 1: Analyze Current State

Read these to understand what changed since last refresh:
- `docs/chatgpt-context/01-project-overview.md` (existing, for diff)
- `docs/README.md` (doc index)
- `CLAUDE.md` (project rules)
- `client/package.json` + `backend/pyproject.toml` (versions)
- `docs/features/*.md` (feature list)
- `docs/architecture/*.md` (ADRs and design)
- `docs/api/*.md` (API docs)

### Step 2: Regenerate Docs 01-07 in Parallel

Launch 3 background agents in parallel:

**Agent A — Docs 01 + 02:**
- `01-project-overview.md`: Tech stack (exact versions from package.json/pyproject.toml), core principles, all built features (scan docs/features/), folder structure, navigation (read client/src/app/), package managers
- `02-data-models.md`: All frontend types (client/src/models/types.ts), all backend models (backend/app/features/*/models.py), enums (backend/app/core/enums.py), storage keys (client/src/storage/storage.ts), relationships, scale/unit constants

**Agent B — Docs 03 + 04:**
- `03-frontend-architecture.md`: Navigation (client/src/app/), all screens inventory (client/src/screens/), all hooks inventory (client/src/hooks/), all particles (client/src/particles/), components, DraftMealContext, theme system, import aliases, example patterns
- `04-api-endpoints.md`: All routers (backend/app/features/*/router.py), all schemas (backend/app/features/*/schemas.py), auth model, pagination, status codes, public vs authenticated

**Agent C — Docs 05 + 06 + 07:**
- `05-business-logic.md`: Calorie calc (client/src/services/utils/calories.ts), units (units.ts), insights (insights.ts), goal calc (backend/app/features/goals/calculation.py), stats calc (backend/app/features/stats/calculation.py), barcode/OFF integration
- `06-backend-architecture.md`: Vertical slice structure, core/ files, router/service/model/schema patterns, auth flow, device scoping, catalog system, test infrastructure, config
- `07-sync-and-storage.md`: Storage files (client/src/storage/), sync queue, backend sync endpoint, three data access patterns, draft meal persistence, device identity

### Step 3: Update System Prompt (00)

After docs 01-07 are regenerated, review `00-system-prompt.md`:
- Update tech stack versions if changed
- Update constraints if new architectural decisions exist
- Update knowledge base table if doc coverage changed
- Keep under 8000 characters

### Step 4: Update Consultant Roles (08)

Review `08-consultant-roles.md`:
- No changes needed unless new product domains were added
- If new features introduce new competitive landscape or market context, update relevant roles

## File Requirements

Every file in `docs/chatgpt-context/` MUST have:
```yaml
---
type: architecture
status: current
last-updated: YYYY-MM-DD  # Set to today
---
```

## Content Guidelines

- ~2000 words per doc (01-07), under 8000 chars for doc 00
- Use code blocks for type definitions, schemas, formulas
- Use tables for inventories (screens, hooks, endpoints, particles)
- Include actual values from source (versions, constants, formulas) — don't paraphrase
- Each doc must be self-contained (ChatGPT reads them independently)

## After Regeneration

Report a summary of what changed in each doc compared to the previous version. Highlight:
- New features/screens/hooks/endpoints added
- Removed or renamed items
- Version bumps
- New architectural decisions
