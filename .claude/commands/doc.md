---
description: Generate/update feature documentation
---

Generate or update documentation for the following feature area:

**Feature:** $ARGUMENTS

## Instructions

1. Identify all relevant source files for "$ARGUMENTS" (screens, hooks, services, models, storage)
2. Check if documentation already exists in `docs/features/`, `docs/api/`, or `docs/architecture/`
3. If doc exists → read it and update with current code state, bump `last-updated`
4. If no doc exists → create a new one with proper YAML frontmatter

## Frontmatter (MANDATORY)

Every doc MUST start with valid YAML frontmatter. The `post-edit-doc-lint.js` hook will block writes without it.

```yaml
---
type: feature | api | architecture | adr
status: current | draft | deprecated | proposed | accepted | rejected | superseded
last-updated: YYYY-MM-DD
related-features: []
---
```

## Doc Format

Use the templates from the `doc-templates` skill:
- **Feature docs** (80-150 lines): Overview, User Flows, Data Model, Key Files, API Endpoints (link to `docs/api/`, don't duplicate), Related Features
- **API docs** (60-120 lines): Endpoints (method, path, auth, params, response, status codes), Schemas
- **ADR docs** (50-150 lines): Status, Context, Decision, Trade-Off Analysis, Consequences

## Rules

- Write to `docs/features/` for user-facing features, `docs/api/` for endpoints, `docs/architecture/` for system design
- Use kebab-case file names: `product-management.md`, `meal-builder.md`
- API endpoint details go in `docs/api/<domain>.md` — feature docs link to them, never duplicate schemas
- Plans go in `docs/plans/` — never in `docs/architecture/`
- No code blocks longer than 10 lines — reference file paths instead
- Always include the "Key Files" section with paths
- Update `docs/README.md` table of contents after creating/updating docs
- Set `last-updated` to today's date

## After Writing

After doc-writer finishes, launch the **doc-reviewer** agent on the created/updated file(s) to validate:
- Frontmatter compliance
- File reference accuracy
- Content accuracy against source code
If doc-reviewer reports FAIL findings, fix them before finishing.
