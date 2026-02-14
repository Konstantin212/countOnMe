---
description: Generate/update feature documentation
---

Generate or update documentation for the following feature area:

**Feature:** $ARGUMENTS

## Instructions

1. Identify all relevant source files for "$ARGUMENTS" (screens, hooks, services, models, storage)
2. Check if documentation already exists in `docs/features/`, `docs/api/`, or `docs/architecture/`
3. If doc exists → read it and update with current code state
4. If no doc exists → create a new one

## Doc Format

Use this structure:
- **Overview** — What the feature does, why it exists
- **How It Works** — User flow and key interactions
- **Key Files** — List of source files with brief descriptions
- **Data Model** — Types, interfaces, storage format
- **API Endpoints** — Backend routes (if applicable)
- **Related Features** — Links to related docs

## Rules

- Write to `docs/features/` for user-facing features, `docs/api/` for endpoints, `docs/architecture/` for system design
- Use kebab-case file names: `product-management.md`, `meal-builder.md`
- Keep docs concise (50-150 lines)
- Focus on "what" and "why", not implementation details
- No code blocks longer than 10 lines — reference file paths instead
- Always include the "Key Files" section with paths
- Update `docs/README.md` table of contents after creating/updating docs
