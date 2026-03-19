# CountOnMe Documentation

## Structure

### Features
- [`features/product-management.md`](features/product-management.md) — Product CRUD, Open Food Facts import, scales and units
- [`features/food-tracking.md`](features/food-tracking.md) — Daily food logging, meal types, AddMeal flow, day stats
- [`features/draft-meal-system.md`](features/draft-meal-system.md) — Multi-step meal creation with persistent draft state
- [`features/barcode-scanner.md`](features/barcode-scanner.md) — Barcode scanning, catalog + OFF lookup, product confirmation
- [`features/catalog-seeding.md`](features/catalog-seeding.md) — Global USDA product catalog, seed script, API endpoints
- [`features/goal-system.md`](features/goal-system.md) — Nutrition goals (calculated via BMR/TDEE or manual), BMI, macros
- [`features/device-auth.md`](features/device-auth.md) — Anonymous device authentication, token lifecycle
- [`features/sync-system.md`](features/sync-system.md) — Offline-first sync, queue, cursor-based sync endpoint
- [`features/theme-system.md`](features/theme-system.md) — Light/dark/system themes, color tokens, persistence
- [`features/analytics-mypath.md`](features/analytics-mypath.md) — MyPath analytics dashboard, charts, streaks, insights
- [`features/profile-screen.md`](features/profile-screen.md) — Profile hub, theme selector, sync status, data management

### API Reference
- [`api/README.md`](api/README.md) — Overview, auth, conventions, enumerations
- [`api/devices.md`](api/devices.md) — Device registration
- [`api/products.md`](api/products.md) — Product CRUD, search, name check
- [`api/portions.md`](api/portions.md) — Product portion CRUD
- [`api/food-entries.md`](api/food-entries.md) — Daily food entry CRUD
- [`api/goals.md`](api/goals.md) — Nutrition goal CRUD + calculation
- [`api/stats.md`](api/stats.md) — Day stats, daily trends, weight trends
- [`api/body-weights.md`](api/body-weights.md) — Body weight CRUD
- [`api/sync.md`](api/sync.md) — Cursor-based incremental sync
- [`api/catalog.md`](api/catalog.md) — Global product catalog search

### Architecture
- [`architecture/overview.md`](architecture/overview.md) — System architecture, component diagram, data flow
- [`architecture/navigation-map.md`](architecture/navigation-map.md) — Client navigation structure, screen flows, param types, cross-tab navigation
- [`architecture/module-impact-map.md`](architecture/module-impact-map.md) — Hook/component/service dependency graph, impact analysis matrix
- [`architecture/adr-001-backend-test-infrastructure.md`](architecture/adr-001-backend-test-infrastructure.md) — ADR: Test infrastructure design
- [`architecture/adr-002-macro-rings-overconsumption.md`](architecture/adr-002-macro-rings-overconsumption.md) — ADR: Macro ring visualization
- [`architecture/adr-003-global-product-catalog.md`](architecture/adr-003-global-product-catalog.md) — ADR: Global product catalog design
- [`architecture/adr-004-seed-data-improvement.md`](architecture/adr-004-seed-data-improvement.md) — ADR: Seed data improvement

## Conventions

- All docs (except README files) require **YAML frontmatter** with `type`, `status`, `last-updated`
- See `.claude/skills/doc-templates/SKILL.md` for templates and field definitions
- The `post-edit-doc-lint.js` hook enforces frontmatter on every write to `docs/`

## Commands

- `/doc <feature>` — Generate or update documentation for a feature area
- `/doc-lint [file|all]` — Validate doc quality, structure, and accuracy against source code
