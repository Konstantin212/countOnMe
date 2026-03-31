# CountOnMe Documentation

## Structure

### Features
- [`features/product-management.md`](features/product-management.md) — Product CRUD, Open Food Facts import, scales and units
- [`features/food-tracking.md`](features/food-tracking.md) — Daily food logging, meal types, AddMeal flow, day stats
- [`features/water-tracking.md`](features/water-tracking.md) — Water intake logging, animated modal, progress tracking
- [`features/draft-meal-system.md`](features/draft-meal-system.md) — Multi-step meal creation with persistent draft state
- [`features/barcode-scanner.md`](features/barcode-scanner.md) — Barcode scanning, catalog + OFF lookup, portion modes, direct meal tracking
- [`features/catalog-seeding.md`](features/catalog-seeding.md) — Global USDA product catalog, seed script, API endpoints
- [`features/goal-system.md`](features/goal-system.md) — Nutrition goals (calculated via BMR/TDEE or manual), BMI, macros
- [`features/supabase-auth.md`](features/supabase-auth.md) — Supabase email magic link auth, JWT verification, JWKS, device linking
- [`features/device-auth.md`](features/device-auth.md) — **Deprecated.** Legacy anonymous device authentication (see supabase-auth)
- [`features/sync-system.md`](features/sync-system.md) — Delta-based pull/push sync, LWW, dirty tracking, offline-first
- [`features/sqlite-cache.md`](features/sqlite-cache.md) — SQLite local database, repository pattern, change tracking
- [`features/shared-foods.md`](features/shared-foods.md) — Community food sharing, publish, search, import, visibility model
- [`features/moderation.md`](features/moderation.md) — User reports, blocking, admin moderation, abuse controls
- [`features/theme-system.md`](features/theme-system.md) — Light/dark/system themes, color tokens, persistence
- [`features/analytics-mypath.md`](features/analytics-mypath.md) — MyPath analytics dashboard, charts, streaks, insights
- [`features/profile-screen.md`](features/profile-screen.md) — Profile hub, theme selector, sync status, data management

### API Reference
- [`api/README.md`](api/README.md) — Overview, auth, conventions, enumerations
- [`api/auth.md`](api/auth.md) — Supabase JWT auth, device linking, account deletion
- [`api/devices.md`](api/devices.md) — Device registration (legacy)
- [`api/products.md`](api/products.md) — Product CRUD, search, name check
- [`api/portions.md`](api/portions.md) — Product portion CRUD
- [`api/food-entries.md`](api/food-entries.md) — Daily food entry CRUD
- [`api/goals.md`](api/goals.md) — Nutrition goal CRUD + calculation
- [`api/stats.md`](api/stats.md) — Day stats, daily trends, weight trends
- [`api/body-weights.md`](api/body-weights.md) — Body weight CRUD
- [`api/water-logs.md`](api/water-logs.md) — Water log CRUD
- [`api/sync.md`](api/sync.md) — Delta-based pull/push sync
- [`api/catalog.md`](api/catalog.md) — Global product catalog search
- [`api/shared-foods.md`](api/shared-foods.md) — Community food CRUD, publish, import, search
- [`api/moderation.md`](api/moderation.md) — User reports, blocks, admin moderation

### Architecture
- [`architecture/overview.md`](architecture/overview.md) — System architecture, component diagram, data flow
- [`architecture/navigation-map.md`](architecture/navigation-map.md) — Client navigation structure, screen flows, param types, cross-tab navigation
- [`architecture/module-impact-map.md`](architecture/module-impact-map.md) — Hook/component/service dependency graph, impact analysis matrix
- [`architecture/adr-001-backend-test-infrastructure.md`](architecture/adr-001-backend-test-infrastructure.md) — ADR: Test infrastructure design
- [`architecture/adr-002-macro-rings-overconsumption.md`](architecture/adr-002-macro-rings-overconsumption.md) — ADR: Macro ring visualization
- [`architecture/adr-003-global-product-catalog.md`](architecture/adr-003-global-product-catalog.md) — ADR: Global product catalog design
- [`architecture/adr-004-seed-data-improvement.md`](architecture/adr-004-seed-data-improvement.md) — ADR: Seed data improvement
- [`architecture/adr-010-direct-catalog-reference.md`](architecture/adr-010-direct-catalog-reference.md) — ADR: Direct catalog portion reference in food entries (eliminate copy-on-track)

## Conventions

- All docs (except README files) require **YAML frontmatter** with `type`, `status`, `last-updated`
- See `.claude/skills/doc-templates/SKILL.md` for templates and field definitions
- The `post-edit-doc-lint.js` hook enforces frontmatter on every write to `docs/`

## Commands

- `/doc <feature>` — Generate or update documentation for a feature area
- `/doc-lint [file|all]` — Validate doc quality, structure, and accuracy against source code
