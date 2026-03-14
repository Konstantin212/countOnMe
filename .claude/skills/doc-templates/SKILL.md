---
name: doc-templates
description: Documentation templates, frontmatter schema, folder structure, and conventions for CountOnMe docs
globs: ["docs/**/*.md", ".claude/agents/doc-writer.md", ".claude/agents/doc-reviewer.md"]
---

# Documentation Templates & Conventions

## Folder Structure

```
docs/
  README.md                    # Table of contents (no frontmatter)
  features/                    # Permanent feature documentation
  api/                         # Per-domain API reference
    README.md                  # API overview + common conventions (no frontmatter)
  architecture/                # Permanent architecture docs + ADRs
  plans/                       # Ephemeral implementation plans
```

## Frontmatter Schema

All permanent docs (features/, api/, architecture/) MUST have YAML frontmatter.

### Permanent docs (feature, api, architecture, adr)

```yaml
---
type: feature | api | architecture | adr
status: current | draft | deprecated | proposed | accepted | rejected | superseded
last-updated: YYYY-MM-DD
related-features:
  - feature-name
---
```

### Plans (docs/plans/)

```yaml
---
type: plan
status: active | completed | abandoned
created: YYYY-MM-DD
---
```

## Line Count Targets

| Doc Type | Target | Hard Max |
|----------|--------|----------|
| feature  | 80-150 | 200      |
| api      | 60-120 | 150      |
| adr      | 50-150 | 200      |
| architecture | 100-400 | 500 |
| plan     | no limit | no limit |

## Templates

### Feature Doc Template

```markdown
---
type: feature
status: current
last-updated: YYYY-MM-DD
related-features: []
---

# Feature Name

## Overview
2-3 sentences: what it does and why it exists.

## User Flows
Key interactions, numbered steps. Keep to the main happy path.

## Data Model
Types, tables, storage keys relevant to this feature.

## Key Files
- `client/src/screens/XScreen.tsx` -- Screen component
- `client/src/hooks/useX.ts` -- State management
- `backend/app/services/x.py` -- Business logic

## API Endpoints
Brief endpoint list with method + path. Link to `docs/api/<domain>.md` for full details.
Do NOT duplicate full request/response schemas here.

## Related Features
- [Feature Name](../features/name.md)
```

### API Doc Template

```markdown
---
type: api
status: current
last-updated: YYYY-MM-DD
related-features: []
---

# Domain API Reference

## Endpoints

### Endpoint Name
- **Method**: GET/POST/PATCH/DELETE
- **Path**: `/v1/resource`
- **Auth**: Bearer token (device)
- **Request**: field descriptions
- **Response**: field descriptions
- **Status codes**: 200, 400, 401, 404

## Schemas
Brief Pydantic model field listing (not full code).
```

### ADR Template

```markdown
---
type: adr
status: proposed
last-updated: YYYY-MM-DD
related-features: []
---

# ADR-NNN: Title

## Status
Proposed | Accepted | Rejected | Superseded

## Context
What is the problem or situation that requires a decision?

## Decision
What was decided and why?

## Trade-Off Analysis
Pros, cons, and alternatives considered.

## Consequences
What follows from this decision? What changes are needed?
```

### Plan Template

```markdown
---
type: plan
status: active
created: YYYY-MM-DD
---

# Plan: Title

## Overview
Brief description of what this plan covers.

## Phases
Implementation phases with files and dependencies.
```

## Rules

1. **Frontmatter is mandatory** for all docs in features/, api/, architecture/ (enforced by `post-edit-doc-lint.js` hook — blocks writes without valid frontmatter)
2. **API details go in `docs/api/`** — feature docs link to API docs, never duplicate endpoint schemas
3. **Plans go in `docs/plans/`** — never in architecture/ (architecture/ is for permanent ADRs and overview only)
4. **File naming**: kebab-case (`product-management.md`, `food-entries.md`)
5. **Code blocks**: max 10 lines — reference file paths for longer code
6. **Key Files section**: mandatory in feature and API docs
7. **`docs/README.md`**: must be updated when adding new docs
8. **`last-updated`**: always set to today's date when creating or editing a doc
9. **`related-features`**: list of related feature doc names (without path or extension)
