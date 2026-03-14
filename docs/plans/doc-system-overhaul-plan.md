---
type: plan
status: completed
created: 2026-03-14
---

# Implementation Plan: Documentation System Overhaul

## Overview

Redesign the CountOnMe documentation infrastructure to enforce templates with YAML frontmatter, separate ephemeral plans from permanent docs, add automated doc validation (lint hook + reviewer agent), and integrate doc-writer into all agent flows (not just Flow 1). The goal is documentation that stays accurate, follows consistent structure, and is automatically maintained as features evolve.

## Success Criteria

- [ ] All permanent docs have YAML frontmatter (type, status, last-updated, related-features)
- [ ] Ephemeral plans live in `docs/plans/` separate from permanent `docs/architecture/`
- [ ] A `post-edit-doc-lint.js` hook validates frontmatter + structure on every write to `docs/`
- [ ] A `doc-reviewer` agent validates doc accuracy against source code
- [ ] Doc-writer agent uses strict templates with mandatory frontmatter
- [ ] CLAUDE.md flows 2 (Bug Fix) and 3 (Refactor) include doc-writer step
- [ ] Orchestrate command updated to trigger doc-writer + doc-reviewer in all flows
- [ ] Existing docs migrated to new templates with frontmatter
- [ ] `docs/api/endpoints.md` (1131 lines) split into per-domain files
- [ ] `docs/features/product-management.md` (307 lines) trimmed to 150 line target
- [ ] ADR statuses updated from "Proposed" to "Accepted" where implemented
- [ ] `/doc-lint` command available for manual doc validation
- [ ] `docs/README.md` updated with new folder structure

## Assumptions

- YAML frontmatter is parsed by the doc-lint hook using simple regex (no YAML library needed for basic fields) -- validated: all hooks use pure Node.js with no external dependencies
- The `block-random-md.js` hook already allows all paths containing `/docs/` -- validated: read the hook, it checks `normalized.includes("/docs/")` so adding `docs/plans/` requires no change
- Hook scripts receive tool input via stdin as JSON -- validated: read `post-edit-typecheck.js` and `block-random-md.js` patterns
- The doc-writer agent (haiku model) is fast enough to run as a final step without significant latency -- validated: already used in Flow 1
- No external YAML parser needed; frontmatter is simple key-value pairs parseable with regex
- Existing docs that violate the 150-line guideline need content reduction, not just splitting

## Architecture Changes

### New Folder Structure

```
docs/
  README.md                          # Table of contents (updated)
  features/                          # Permanent feature documentation
    product-management.md            # (migrated with frontmatter)
    food-tracking.md                 # (migrated with frontmatter)
    catalog-seeding.md               # (migrated with frontmatter)
    goal-system.md                   # (migrated with frontmatter)
    device-auth.md                   # (migrated with frontmatter)
    sync-system.md                   # (migrated with frontmatter)
  api/                               # Per-domain API reference
    README.md                        # API overview + common conventions
    devices.md                       # (split from endpoints.md)
    products.md                      # (split from endpoints.md)
    portions.md                      # (split from endpoints.md)
    food-entries.md                  # (split from endpoints.md)
    goals.md                         # (split from endpoints.md)
    stats.md                         # (split from endpoints.md)
    body-weights.md                  # (split from endpoints.md)
    sync.md                          # (split from endpoints.md)
    catalog.md                       # (split from endpoints.md)
  architecture/                      # Permanent architecture docs + ADRs
    overview.md                      # (migrated with frontmatter)
    adr-001-backend-test-infrastructure.md  # (status updated)
    adr-002-macro-rings-overconsumption.md  # (status updated)
    adr-003-global-product-catalog.md       # (status updated)
  plans/                             # Ephemeral implementation plans (NEW)
    products-epic.md                 # (moved from architecture/)
    products-epic-plan.md            # (moved from architecture/)
    bugs-fix-plan.md                 # (moved from architecture/)
    bugs-fix-plan-2.md               # (moved from architecture/)
    vertical-slice-migration-plan.md # (moved from architecture/)
    doc-system-overhaul-plan.md      # (THIS plan, moved after approval)
```

### Frontmatter Schema

All permanent docs (features, api, architecture, ADRs) must have YAML frontmatter:

```yaml
---
type: feature | api | architecture | adr
status: current | draft | deprecated | proposed | accepted | rejected | superseded
last-updated: YYYY-MM-DD
related-features:
  - feature-name
---
```

Plans in `docs/plans/` use a simpler frontmatter:

```yaml
---
type: plan
status: active | completed | abandoned
created: YYYY-MM-DD
---
```

### Doc Templates

**Feature doc template** (target: 80-150 lines):
```markdown
---
type: feature
status: current
last-updated: YYYY-MM-DD
related-features: []
---

# Feature Name

## Overview
2-3 sentences.

## User Flows
Key interactions, numbered steps.

## Data Model
Types, tables, storage keys.

## Key Files
- `path/to/file` -- Description

## API Endpoints
Brief endpoint list (link to api/ doc for details).

## Related Features
- [Feature Name](../features/name.md)
```

**API doc template** (target: 60-120 lines per domain):
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
Method, path, auth, params, response shape, status codes.

## Schemas
Request/response Pydantic models (brief).
```

**ADR template** (target: 50-150 lines):
```markdown
---
type: adr
status: proposed | accepted | rejected | superseded
last-updated: YYYY-MM-DD
related-features: []
---

# ADR-NNN: Title

## Status
{status}

## Context
## Decision
## Trade-Off Analysis
## Consequences
```

## Files Affected

### New Files
- `.claude/hooks/post-edit-doc-lint.js` -- PostToolUse hook: validates frontmatter + structure on writes to `docs/`
- `.claude/agents/doc-reviewer.md` -- Agent (haiku): validates doc accuracy against source code
- `.claude/commands/doc-lint.md` -- Command: manual doc validation trigger
- `.claude/skills/doc-templates/SKILL.md` -- Templates and conventions for doc-writer reference
- `docs/plans/.gitkeep` -- New plans directory
- `docs/api/README.md` -- API overview extracted from endpoints.md
- `docs/api/devices.md` -- Split from endpoints.md
- `docs/api/products.md` -- Split from endpoints.md
- `docs/api/portions.md` -- Split from endpoints.md
- `docs/api/food-entries.md` -- Split from endpoints.md
- `docs/api/goals.md` -- Split from endpoints.md
- `docs/api/stats.md` -- Split from endpoints.md
- `docs/api/body-weights.md` -- Split from endpoints.md
- `docs/api/sync.md` -- Split from endpoints.md
- `docs/api/catalog.md` -- Extracted from catalog-seeding.md API section

### Modified Files
- `.claude/settings.json` -- Register `post-edit-doc-lint.js` hook
- `.claude/agents/doc-writer.md` -- Strict templates, mandatory frontmatter, updated rules
- `.claude/commands/doc.md` -- Updated to include doc-reviewer step after writing
- `.claude/commands/orchestrate.md` -- Add doc-writer to Flow 2 and Flow 3
- `CLAUDE.md` -- Update Flow 2 and Flow 3 definitions, add doc-reviewer to agent table, add `/doc-lint` to command table
- `docs/README.md` -- Rewrite with new folder structure
- `docs/features/product-management.md` -- Add frontmatter, trim to 150 lines
- `docs/features/food-tracking.md` -- Add frontmatter
- `docs/features/catalog-seeding.md` -- Add frontmatter, extract API section to `docs/api/catalog.md`
- `docs/features/goal-system.md` -- Add frontmatter
- `docs/features/device-auth.md` -- Add frontmatter
- `docs/features/sync-system.md` -- Add frontmatter
- `docs/architecture/overview.md` -- Add frontmatter
- `docs/architecture/adr-001-backend-test-infrastructure.md` -- Add frontmatter, update status to "Accepted"
- `docs/architecture/adr-002-macro-rings-overconsumption.md` -- Add frontmatter, update status to "Accepted"
- `docs/architecture/adr-003-global-product-catalog.md` -- Add frontmatter, update status to "Accepted"

### Deleted Files
- `docs/api/endpoints.md` -- Replaced by per-domain files in `docs/api/`
- `docs/api/.gitkeep` -- No longer needed (real files exist)
- `docs/features/.gitkeep` -- No longer needed
- `docs/architecture/.gitkeep` -- No longer needed

### Moved Files
- `docs/architecture/products-epic.md` -> `docs/plans/products-epic.md`
- `docs/architecture/products-epic-plan.md` -> `docs/plans/products-epic-plan.md`
- `docs/architecture/bugs-fix-plan.md` -> `docs/plans/bugs-fix-plan.md`
- `docs/architecture/bugs-fix-plan-2.md` -> `docs/plans/bugs-fix-plan-2.md`
- `docs/architecture/vertical-slice-migration-plan.md` -> `docs/plans/vertical-slice-migration-plan.md`

---

## Implementation Steps

### Phase 1: Infrastructure (Hook + Agent + Command + Skill)

**Estimate:** 6 new files, 2 modified files

This phase creates the validation infrastructure before touching any docs. Everything in this phase is additive -- no existing behavior changes.

1. **Create doc-lint hook** (`.claude/hooks/post-edit-doc-lint.js`)
   - Action: Write a PostToolUse hook that fires on Edit|Write to files matching `docs/**/*.md` (but NOT `docs/plans/**/*.md`). The hook:
     - Reads the written file path from stdin JSON (`event.tool_input.file_path`)
     - Skips if path is not under `docs/` or is under `docs/plans/`
     - Skips `docs/README.md` (index file, no frontmatter needed)
     - Reads the file content and checks:
       1. File starts with `---` (has frontmatter)
       2. Frontmatter contains `type:` field with valid value
       3. Frontmatter contains `status:` field with valid value
       4. Frontmatter contains `last-updated:` field matching `YYYY-MM-DD` pattern
     - On failure: writes error message to stdout AND exits with code 2 (BLOCKING -- prevents non-compliant docs from being written)
     - On pass: exits silently (exit 0)
   - Why: Enforces frontmatter compliance at write-time — agents must produce valid docs from the start
   - Dependencies: None
   - Risk: Medium -- blocking hooks can prevent agents from writing docs iteratively. Mitigation: the hook only checks frontmatter existence and required fields, not content quality. Agents can always write valid frontmatter on first attempt since the templates are in the doc-templates skill.
   - Pattern: Follow `post-edit-typecheck.js` structure (stdin JSON parsing, file path extraction, conditional check, stdout message)
   - Test: Write a test doc to `docs/features/test-temp.md` without frontmatter, verify hook outputs warning. Then add frontmatter, verify silence. Delete test file.

2. **Create doc-reviewer agent** (`.claude/agents/doc-reviewer.md`)
   - Action: Create a new agent file with:
     - `model: sonnet` (needs reasoning power for deep content validation)
     - `tools: ["Read", "Grep", "Glob"]` (read-only, never writes)
     - Description: validates doc accuracy by cross-referencing with source code
     - Instructions — **two validation tiers**:

       **Tier 1: Structural checks**
       1. Read the doc file
       2. Check frontmatter completeness (type, status, last-updated)
       3. Verify "Key Files" section: each listed file actually exists (use Glob)
       4. Verify file path references in doc body (use Glob to confirm they exist)
       5. Check line count is within range for doc type (feature: 80-150, api: 60-120, adr: 50-150)
       6. Check no code blocks exceed 10 lines

       **Tier 2: Deep content validation**
       7. **Type/interface drift**: For each type/interface mentioned in doc, Read the actual source file and verify documented fields match. Check `client/src/models/types.ts` for client types.
       8. **API endpoint shape**: For each endpoint documented, Read the corresponding Pydantic schema in `backend/app/schemas/` and verify request/response fields match.
       9. **Hook/function signatures**: For each hook mentioned, Read the actual hook file and verify documented return values and method names match exports.
       10. **Screen/file references**: For each screen name mentioned in user flows, verify the file exists via Glob.
       11. **Storage key accuracy**: For each AsyncStorage key mentioned, Grep `client/src/storage/` to verify the key string matches.
       12. **Status code validation**: For each endpoint status code documented, Read the corresponding router in `backend/app/api/routers/` and verify the status_code decorator matches.

       **Report format**: Structured output with PASS/WARN/FAIL per check, grouped by tier. Include file:line references for each finding.
     - Color: green (same as verifier)
   - Why: Automated quality gate for documentation accuracy — catches both structural issues and content drift
   - Dependencies: None
   - Risk: Low -- read-only agent, cannot modify anything
   - Pattern: Follow `verifier.md` structure (structured report format, never fixes, only reports)
   - Note: Upgraded from haiku to sonnet because deep validation requires reading multiple source files and reasoning about type/schema correspondence

3. **Create `/doc-lint` command** (`.claude/commands/doc-lint.md`)
   - Action: Write command that:
     - Takes `$ARGUMENTS` as optional path filter (e.g., `features/product-management.md` or `all`)
     - If specific file: launch doc-reviewer agent on that file
     - If `all` or no argument: launch doc-reviewer agent on each `.md` file in `docs/` (excluding `docs/plans/`)
     - Aggregates results into a summary report
   - Why: Manual trigger for doc validation (complements the automatic hook)
   - Dependencies: Step 2 (doc-reviewer agent)
   - Risk: Low

4. **Create doc-templates skill** (`.claude/skills/doc-templates/SKILL.md`)
   - Action: Write a skill file containing:
     - The three templates (feature, api, adr) with frontmatter
     - Frontmatter field definitions and valid values
     - Line count targets per doc type
     - Rules for plans (simpler frontmatter, no line count enforcement)
     - The folder structure decision (features/, api/, architecture/, plans/)
   - Why: Single source of truth for templates, referenced by doc-writer agent
   - Dependencies: None
   - Risk: Low

5. **Register doc-lint hook** (`.claude/settings.json`)
   - Action: Add a new PostToolUse entry:
     ```json
     {
       "matcher": "Edit|Write",
       "hooks": [{
         "type": "command",
         "command": "node D:/cot/countOnMe/.claude/hooks/post-edit-doc-lint.js"
       }]
     }
     ```
   - Why: Activates the hook for all doc edits
   - Dependencies: Step 1 (hook script exists)
   - Risk: Low -- hook only validates frontmatter structure, not content

6. **Update CLAUDE.md** (`CLAUDE.md`)
   - Action:
     - Add `doc-reviewer` to agent table (haiku, "Doc accuracy validation")
     - Add `/doc-lint` to command table
     - Update Flow 2 (Bug Fix) to include doc-writer as final step:
       ```
       [analyze] -> developer -> verifier -> tdd-guide -> reviewer -> doc-writer
       ```
     - Update Flow 3 (Refactor) to include doc-writer as final step:
       ```
       verifier -> planner -> developers -> refactor-cleaner -> verifier -> tdd-guide -> reviewers -> doc-writer
       ```
     - Add `post-edit-doc-lint.js` to hooks description section
   - Why: Keeps CLAUDE.md as the authoritative flow reference
   - Dependencies: Steps 1-3 (new infrastructure exists)
   - Risk: Medium -- CLAUDE.md is the master reference; incorrect flow changes could confuse agents. Mitigation: change only the specific flow lines, leave everything else untouched.

**Verification:**
- `node -c .claude/hooks/post-edit-doc-lint.js` -- syntax check
- Manually verify doc-reviewer agent and doc-lint command are well-formed markdown
- Verify settings.json is valid JSON: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"`

---

### Phase 2: Update Doc-Writer Agent + Doc Command

**Estimate:** 2 modified files

This phase makes the doc-writer produce docs that pass the new validation. Must come after Phase 1 (templates exist as skill reference).

1. **Update doc-writer agent** (`.claude/agents/doc-writer.md`)
   - Action: Rewrite the agent instructions to:
     - Reference the `doc-templates` skill for template structure
     - Mandate YAML frontmatter on all docs (except plans)
     - Use `last-updated` as today's date
     - Set `status: current` for new feature/api docs, `status: proposed` for new ADRs
     - Enforce line count targets: feature 80-150, api 60-120, adr 50-150, plan no limit
     - Add rule: if writing to `docs/plans/`, use simplified plan frontmatter
     - Add rule: API endpoint details go in `docs/api/<domain>.md`, not inside feature docs (feature docs link to API docs instead)
     - Add rule: when updating existing docs, preserve frontmatter and bump `last-updated`
     - Update quality checklist to include frontmatter validation
   - Why: Ensures all new docs are compliant from the start
   - Dependencies: Phase 1 Step 4 (skill exists as reference)
   - Risk: Medium -- changing the doc-writer's behavior could produce different output than expected. Mitigation: the doc-reviewer agent provides a safety net.

2. **Update `/doc` command** (`.claude/commands/doc.md`)
   - Action: Add a step after doc-writer completes:
     - "After doc-writer finishes, launch doc-reviewer agent on the created/updated file(s) to validate compliance"
     - If doc-reviewer reports FAIL, instruct doc-writer to fix the issues
   - Why: Built-in quality gate for every `/doc` invocation
   - Dependencies: Phase 1 Steps 2-3 (doc-reviewer exists)
   - Risk: Low

**Verification:**
- Read both files and confirm they reference correct skill path and agent names
- Manually invoke `/doc product management` on a test basis after Phase 4 (when existing docs have frontmatter)

---

### Phase 3: Update Orchestrate Command + Flows

**Estimate:** 1 modified file

This phase wires doc-writer into all orchestration flows. Must come after Phase 2 (doc-writer produces compliant docs).

1. **Update orchestrate command** (`.claude/commands/orchestrate.md`)
   - Action:
     - **Flow 2 (Bug Fix)**: Add step 5 after reviewer:
       ```
       5. **Doc** -> Update documentation if the fix changed user-visible behavior or API contracts (use `doc-writer` agent)
       ```
       Note: doc-writer is conditional in bug fixes -- only if the fix changed documented behavior. Add this as a guideline, not mandatory.
     - **Flow 3 (Refactor)**: Add step 7 after reviewers:
       ```
       7. **Doc** -> Update documentation if file locations, APIs, or data models changed (use `doc-writer` agent)
       ```
       Same conditional pattern -- refactors that only move code without changing behavior may not need doc updates.
     - **Flow 1 (New Feature)**: Add step after doc-writer:
       ```
       8. **Doc Review** -> Validate documentation accuracy (use `doc-reviewer` agent)
       ```
     - **Flow 5 (Architecture Decision)**: Add step after ADR:
       ```
       3. **Doc Review** -> Validate ADR structure (use `doc-reviewer` agent)
       ```
   - Why: Ensures docs are considered in all flows, not just new features
   - Dependencies: Phase 2 (doc-writer is updated)
   - Risk: Medium -- changing orchestration affects all workflows. Mitigation: doc-writer is conditional in Flow 2/3 (agents judge relevance), and doc-reviewer is always non-blocking.

**Verification:**
- Read orchestrate.md and confirm all 6 flows are coherent
- Cross-reference with CLAUDE.md flow definitions (updated in Phase 1)

---

### Phase 4: Folder Restructure + Plan Migration

**Estimate:** 5 moved files, 1 new directory, 1 deleted file

This phase reorganizes the docs folder. Can be done in parallel with Phases 2-3 since it only moves/renames files. No content changes except deleting .gitkeep files.

1. **Create plans directory** (`docs/plans/`)
   - Action: Create `docs/plans/.gitkeep`
   - Why: New home for ephemeral implementation plans
   - Dependencies: None
   - Risk: Low

2. **Move ephemeral plans** (5 files)
   - Action: Move each file using git:
     - `git mv docs/architecture/products-epic.md docs/plans/products-epic.md`
     - `git mv docs/architecture/products-epic-plan.md docs/plans/products-epic-plan.md`
     - `git mv docs/architecture/bugs-fix-plan.md docs/plans/bugs-fix-plan.md`
     - `git mv docs/architecture/bugs-fix-plan-2.md docs/plans/bugs-fix-plan-2.md`
     - `git mv docs/architecture/vertical-slice-migration-plan.md docs/plans/vertical-slice-migration-plan.md`
   - Why: Separates session artifacts from permanent architecture docs
   - Dependencies: Step 1 (plans/ directory exists)
   - Risk: Low -- git mv preserves history
   - Note: After approval, this plan file should also be moved to `docs/plans/`

3. **Add plan frontmatter** (5 moved files)
   - Action: Add simplified frontmatter to each plan file:
     ```yaml
     ---
     type: plan
     status: completed
     created: 2026-03-14
     ---
     ```
     Set status to `completed` for bug-fix and products-epic plans (already executed).
     Set `vertical-slice-migration-plan.md` to `status: active` (user will run it manually later).
   - Why: Even plans benefit from basic metadata
   - Dependencies: Step 2 (files are in new location)
   - Risk: Low

4. **Clean up .gitkeep files**
   - Action: Remove `docs/features/.gitkeep`, `docs/api/.gitkeep`, `docs/architecture/.gitkeep` since these directories now have real files
   - Why: .gitkeep is only needed for empty directories
   - Dependencies: None
   - Risk: Low

**Verification:**
- `git status` shows clean moves (rename detection)
- All 5 plan files have frontmatter
- No broken links in docs/README.md (updated in Phase 6)

---

### Phase 5: Split `docs/api/endpoints.md` into Per-Domain Files

**Estimate:** 10 new files, 1 deleted file

This is the largest content change. The monolithic 1131-line `endpoints.md` is split into focused per-domain API docs. Can be done in parallel with Phase 4.

1. **Create `docs/api/README.md`** -- API overview
   - Action: Extract from `endpoints.md`:
     - Authentication section (lines 28-49)
     - Common conventions (enumerations, error codes)
     - Table of contents linking to each domain file
   - Add frontmatter: `type: api, status: current, last-updated: 2026-03-14`
   - Target: ~60 lines
   - Why: Common API information that applies to all endpoints
   - Dependencies: None
   - Risk: Low

2. **Create per-domain API files** (9 files)
   - Action: For each domain, extract its section from `endpoints.md` into a standalone file with frontmatter. Each file follows the API doc template:
     - `docs/api/devices.md` -- Devices section (register endpoint)
     - `docs/api/products.md` -- Products section (CRUD + check-name + search)
     - `docs/api/portions.md` -- Portions section (CRUD)
     - `docs/api/food-entries.md` -- Food Entries section (CRUD + date filters)
     - `docs/api/goals.md` -- Goals section (calculate, CRUD)
     - `docs/api/stats.md` -- Stats section (day, daily, weight)
     - `docs/api/body-weights.md` -- Body Weights section (CRUD)
     - `docs/api/sync.md` -- Sync section (cursor-based)
     - `docs/api/catalog.md` -- Catalog section (from catalog-seeding.md API section + endpoints.md if any)
   - Each file gets frontmatter: `type: api, status: current, last-updated: 2026-03-14`
   - Target: 60-120 lines each
   - Why: Focused docs are easier to maintain and find
   - Dependencies: Step 1 (README exists for cross-links)
   - Risk: Medium -- must ensure no content is lost during split. Mitigation: after split, the sum of all new files' content should cover everything in the original. Use Grep to verify all endpoint paths from original are present in new files.

3. **Delete `docs/api/endpoints.md`**
   - Action: `git rm docs/api/endpoints.md`
   - Why: Replaced by per-domain files
   - Dependencies: Step 2 (all content migrated)
   - Risk: Medium -- if any content is missed, it's lost. Mitigation: do this step last, after verification.

**Verification:**
- Grep for every endpoint path (e.g., `/v1/products`, `/v1/food-entries`) across `docs/api/*.md` -- all must be present
- Each new file has valid frontmatter
- No file exceeds 120 lines
- `endpoints.md` no longer exists

---

### Phase 6: Migrate Existing Docs (Frontmatter + Trim)

**Estimate:** 10 modified files

Add frontmatter to all existing permanent docs and trim oversized ones. Depends on Phase 1 (hook validates frontmatter) so we get immediate feedback.

1. **Add frontmatter to feature docs** (6 files)
   - Action: Add YAML frontmatter to the top of each file:
     - `docs/features/product-management.md` -- `type: feature, status: current, last-updated: 2026-03-14, related-features: [catalog-seeding, food-tracking]`
     - `docs/features/food-tracking.md` -- `type: feature, status: current, last-updated: 2026-03-14, related-features: [product-management, goal-system]`
     - `docs/features/catalog-seeding.md` -- `type: feature, status: current, last-updated: 2026-03-14, related-features: [product-management]`
     - `docs/features/goal-system.md` -- `type: feature, status: current, last-updated: 2026-03-14, related-features: [food-tracking]`
     - `docs/features/device-auth.md` -- `type: feature, status: current, last-updated: 2026-03-14, related-features: [sync-system]`
     - `docs/features/sync-system.md` -- `type: feature, status: current, last-updated: 2026-03-14, related-features: [device-auth, product-management]`
   - Why: Standardized metadata enables staleness detection and cross-referencing
   - Dependencies: Phase 1 (hook validates on edit)
   - Risk: Low

2. **Trim `product-management.md`** (307 lines -> ~150 lines)
   - Action: Reduce by:
     - Moving the "API Endpoints" section (lines 136-275, ~140 lines of endpoint detail) to a link: "See [Products API](../api/products.md) for full endpoint reference"
     - Condensing the "Data Model" section to just the key type fields (remove backend model details -- those belong in api/products.md or architecture/overview.md)
     - Keep: Overview, User Flows, Scale System, Favorites/Recents, Hook, Key Files, Related Features
   - Why: Feature docs should describe "what and why", not duplicate API reference
   - Dependencies: Phase 5 Step 2 (api/products.md exists to link to)
   - Risk: Medium -- must not lose unique content. Mitigation: any content removed from feature doc must exist in the corresponding api/ doc.

3. **Trim `catalog-seeding.md`** (~295 lines)
   - Action: Extract the "API Endpoints" section (~80 lines) to `docs/api/catalog.md` and replace with a link. Target: ~150 lines.
   - Dependencies: Phase 5 (api/catalog.md exists)
   - Risk: Low -- straightforward extraction

4. **Add frontmatter to architecture docs** (1 file)
   - Action: Add frontmatter to `docs/architecture/overview.md`:
     - `type: architecture, status: current, last-updated: 2026-03-14`
   - Why: Consistency
   - Dependencies: Phase 1
   - Risk: Low

5. **Update ADR statuses** (3 files)
   - Action: For each ADR:
     - `adr-001-backend-test-infrastructure.md`: Add frontmatter with `type: adr, status: accepted, last-updated: 2026-03-14`. Change `## Status` body text from "Proposed" to "Accepted".
     - `adr-002-macro-rings-overconsumption.md`: Same -- `status: accepted`. The MacroRings component was implemented.
     - `adr-003-global-product-catalog.md`: Same -- `status: accepted`. The catalog tables and seed script exist.
   - Why: ADR statuses should reflect reality
   - Dependencies: Phase 1 (hook validates)
   - Risk: Low -- verify each decision was actually implemented by checking for the relevant files (use Glob)

6. **Update `docs/README.md`**
   - Action: Rewrite to reflect new folder structure:
     - Add `docs/plans/` section
     - Update `docs/api/` section to list per-domain files instead of single `endpoints.md`
     - Add note about frontmatter convention
     - Add note about generating docs with `/doc` command
     - Add note about validating docs with `/doc-lint` command
   - Dependencies: Phases 4-5 (new structure is in place)
   - Risk: Low

**Verification:**
- Run `/doc-lint all` (Phase 1 command) and verify all permanent docs pass
- No file in `docs/features/` exceeds 150 lines
- No file in `docs/api/` exceeds 120 lines
- All ADRs have non-"Proposed" status
- README.md links resolve to actual files

---

## Dependency Graph

```
Phase 1 (Infrastructure)
    |
    +---> Phase 2 (Doc-Writer Update)
    |         |
    |         +---> Phase 3 (Orchestrate Update)
    |
    +---> Phase 4 (Folder Restructure)  [parallel with 2,3]
    |
    +---> Phase 5 (API Split)           [parallel with 2,3,4]
    |
    +---> Phase 6 (Migrate Existing)    [after 1, needs 5 for product-management trim]
```

**Parallelism opportunities:**
- Phases 4, 5 can run in parallel with Phases 2, 3 (they touch different files)
- Phase 6 Steps 1, 4, 5 can start after Phase 1 (only frontmatter additions)
- Phase 6 Steps 2, 3 must wait for Phase 5 (need API docs to link to)
- Phase 6 Step 6 (README) must wait for Phases 4 and 5

## Testing Strategy

- **Automated (hook):** Every write to `docs/` triggers `post-edit-doc-lint.js` which validates frontmatter. This catches missing metadata immediately during implementation.
- **Automated (agent):** The doc-reviewer agent can be invoked via `/doc-lint all` to validate all docs in batch. Run this at the end of each phase.
- **Manual verification:**
  - Confirm `docs/plans/` contains only ephemeral plans
  - Confirm `docs/architecture/` contains only ADRs + overview (no plan files)
  - Confirm no content was lost from endpoints.md split (grep all endpoint paths)
  - Confirm product-management.md is under 150 lines
  - Confirm all docs/README.md links resolve

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Content loss during endpoints.md split | Medium | Before deleting endpoints.md, grep all `/v1/` paths and verify each appears in new files |
| Content loss during product-management.md trim | Medium | Any content removed must exist in the corresponding api/ file; diff both before and after |
| Doc-lint hook blocks agent mid-write | Medium | Hook only validates frontmatter fields (not content quality); agents can always produce valid frontmatter on first write since templates are in doc-templates skill. If hook blocks, agent gets clear error message explaining what's missing. |
| Doc-writer produces non-compliant output despite updated instructions | Medium | Doc-reviewer runs after doc-writer in `/doc` command; catches issues before completion |
| CLAUDE.md flow changes confuse existing agents | Medium | Changes are minimal (add one step to Flow 2 and 3); all agents re-read CLAUDE.md each session |
| Frontmatter regex parsing fails on edge cases | Low | Keep frontmatter simple (no nested YAML, no multiline values); test with all doc types |
| `docs/plans/` accumulates stale plans indefinitely | Low | Plans have `status` field; periodic cleanup is a manual process. Add note in README suggesting cleanup |

## Decisions (Confirmed)

1. **Doc-lint hook: BLOCKING (exit 2).** Prevents non-compliant docs from being written. Agents must produce valid frontmatter from the start.

2. **Plans require frontmatter: YES.** Minimal schema: `type: plan`, `status`, `created`. Enforced by hook (blocking).

3. **Doc-reviewer includes DEEP validation in Phase 1.** Beyond structural checks, the reviewer cross-references doc claims against source code:
   - **Type/interface drift**: Verify documented fields match actual TypeScript types in `models/types.ts`
   - **API endpoint shape**: Verify documented request/response bodies match Pydantic schemas in `backend/app/schemas/`
   - **Hook/function signatures**: Verify documented return values match actual hook exports
   - **Navigation/screen references**: Verify documented screen names exist as actual files
   - **Storage key accuracy**: Verify documented AsyncStorage keys match actual keys in `storage/`
   - **Endpoint status codes**: Verify documented status codes match router decorators

4. **Delete `endpoints.md` once content is verified migrated.** Grep all `/v1/` paths from original, confirm each exists in new per-domain files, then `git rm`.

5. **`vertical-slice-migration-plan` stays `active`.** User will run it manually later alongside screen-folder-migration. Folder structure rules and docs will be added as part of that future work.
