---
type: plan
status: draft
last-updated: 2026-03-26
related-features:
  - supabase-migration
  - data-model
  - future-social-features
---

# Implementation Plan: Phase 4 -- Split Private Data from Shared/Public Data Domain

## Overview

Introduce the shared/community data domain as a new `shared` feature in the backend. This adds two tables (`shared_foods`, `shared_food_portions`), two new enums (`Visibility`, `ModerationStatus`), full-text search with GIN indexes, and CRUD + publish/search/import API endpoints. All backend-only; no client changes.

## Success Criteria

- [ ] `Visibility` and `ModerationStatus` enums exist in `app/core/enums.py` and as PostgreSQL enum types
- [ ] `shared_foods` table with owner_user_id, visibility, moderation_status, nutritional fields, search_vector, soft deletes
- [ ] `shared_food_portions` table mirroring `catalog_portions` structure but with `shared_food_id` FK
- [ ] GIN index on `shared_foods.search_vector` for full-text search
- [ ] CRUD endpoints for shared foods (owner-only write access)
- [ ] Search endpoint returning only visible (public+approved OR owned) shared foods
- [ ] Publish flow: private -> public (sets moderation_status to pending)
- [ ] Import flow: copy shared food + portions into user's private products/product_portions
- [ ] Owner cannot see rejected items in public search but can see them in "my shared" list
- [ ] Cross-user isolation: user A cannot edit/delete user B's shared food
- [ ] All new service functions have unit tests; all new endpoints have integration tests
- [ ] Alembic migration creates tables, enums, and indexes
- [ ] `ruff check` and `pytest` pass with no regressions

## Assumptions

- **ADR-008 is the source of truth** for the three-domain model (private, catalog, shared) -- validated by reading `docs/architecture/adr-008-private-vs-shared-data.md`
- **The issue says `shared_templates` and `shared_foods`** but ADR-008 calls the food table `shared_products`. This plan uses `shared_foods` per the issue, which is clearer since `products` already exists for private data. This naming needs user confirmation.
- **No auto-approval logic yet** -- all newly published items start as `pending`. Auto-approval based on trust score is a future concern.
- **No admin moderation endpoints** -- Phase 4 only creates the data structures and user-facing API. Admin review endpoints are a separate feature.
- **Shared meal templates are deferred** -- The issue mentions `shared_templates` but the ADR marks them as JSONB-based. This plan focuses on `shared_foods` + `shared_food_portions` only, deferring templates to a follow-up. Needs user confirmation.
- **Nutritional data lives on portions** (matching catalog pattern) -- `shared_foods` has name/brand/description/barcode; `shared_food_portions` has calories/protein/carbs/fat/base_amount/base_unit.
- **Latest migration is `0014_make_device_id_nullable`** -- next is `0015`.
- **Feature layout follows `app/features/<domain>/`** pattern -- validated by reading existing features.

## Architecture Changes

- New feature directory: `backend/app/features/shared/` with `__init__.py`, `models.py`, `schemas.py`, `service.py`, `router.py`
- New enums in `backend/app/core/enums.py`: `Visibility`, `ModerationStatus`
- New Alembic migration: `backend/alembic/versions/0015_shared_foods.py`
- Register new model import in `backend/alembic/env.py`
- Register new router in `backend/app/main.py`
- Register new model imports in `backend/tests/conftest.py` (for `Base.metadata.create_all`)
- New enum creation SQL in `backend/tests/conftest.py` test_engine fixture
- New test factory functions in `backend/tests/factories.py`

## Files Affected

### New Files

- `backend/app/features/shared/__init__.py` -- Empty package init
- `backend/app/features/shared/models.py` -- SharedFood and SharedFoodPortion ORM models
- `backend/app/features/shared/schemas.py` -- Pydantic request/response schemas
- `backend/app/features/shared/service.py` -- Business logic (CRUD, search, publish, import)
- `backend/app/features/shared/router.py` -- API endpoints
- `backend/alembic/versions/0015_shared_foods.py` -- Migration for tables + enums + indexes
- `backend/tests/api/test_shared_foods_api.py` -- Router integration tests
- `backend/tests/services/test_shared_foods_db.py` -- Service unit tests

### Modified Files

- `backend/app/core/enums.py` -- Add `Visibility` and `ModerationStatus` StrEnums
- `backend/app/main.py` -- Register shared router
- `backend/alembic/env.py` -- Import shared models for autogenerate
- `backend/tests/conftest.py` -- Import SharedFood/SharedFoodPortion models; add enum creation SQL
- `backend/tests/factories.py` -- Add `create_shared_food()` and `create_shared_food_portion()` factories

## Implementation Steps

### Phase 1: Enums + Models + Migration (Data Layer)
Estimate: 5 files new, 3 files modified

1. **Add Visibility and ModerationStatus enums** (`backend/app/core/enums.py`)
   - Action: Add two new StrEnum classes at the bottom of the file
   - ```python
     class Visibility(StrEnum):
         private = "private"
         unlisted = "unlisted"
         public = "public"

     class ModerationStatus(StrEnum):
         pending = "pending"
         approved = "approved"
         rejected = "rejected"
     ```
   - Why: These are core domain concepts shared across all future shared-domain entities
   - Dependencies: None
   - Risk: Low
   - Test: Import enums in a Python shell; `ruff check app/core/enums.py`

2. **Create SharedFood model** (`backend/app/features/shared/models.py`)
   - Action: Create the file with `SharedFood` and `SharedFoodPortion` ORM classes
   - SharedFood columns:
     - `id` (UUID PK, server_default gen_random_uuid)
     - `owner_user_id` (UUID NOT NULL, FK users.id ON DELETE CASCADE, indexed)
     - `name` (Text NOT NULL)
     - `display_name` (Text NOT NULL) -- user-facing name, can differ from internal name
     - `description` (Text, nullable) -- optional description/notes
     - `brand` (Text, nullable)
     - `barcode` (Text, nullable, indexed)
     - `category` (Text, nullable)
     - `visibility` (Enum(Visibility), NOT NULL, server_default 'private')
     - `moderation_status` (Enum(ModerationStatus), NOT NULL, server_default 'pending')
     - `search_vector` (TSVECTOR, Computed, same pattern as CatalogProduct)
     - `created_at`, `updated_at`, `deleted_at` (via TimestampMixin)
   - SharedFood table_args:
     - `Index("ix_shared_foods_owner_user_id", "owner_user_id")`
     - `Index("ix_shared_foods_visibility_moderation", "visibility", "moderation_status")` -- for efficient filtering of public+approved items
     - `Index("ix_shared_foods_search_vector", "search_vector", postgresql_using="gin")` -- for FTS
     - `Index("ix_shared_foods_barcode", "barcode")`
   - SharedFoodPortion columns (mirror CatalogPortion):
     - `id` (UUID PK)
     - `shared_food_id` (UUID NOT NULL, FK shared_foods.id ON DELETE CASCADE, indexed)
     - `label` (Text NOT NULL)
     - `base_amount` (Numeric(12,3) NOT NULL)
     - `base_unit` (Enum(Unit) NOT NULL)
     - `gram_weight` (Numeric(12,3), nullable)
     - `calories` (Numeric(12,3) NOT NULL)
     - `protein`, `carbs`, `fat` (Numeric(12,3), nullable)
     - `is_default` (Boolean NOT NULL, server_default false)
     - `created_at`, `updated_at` (timestamps, no deleted_at -- cascade delete with parent)
   - Relationship: `SharedFood.portions` -> `SharedFoodPortion` (selectin lazy load)
   - Why: Separate tables enforce the domain boundary at schema level (ADR-008 decision 5)
   - Dependencies: Step 1 (enums)
   - Risk: Medium -- search_vector computed column requires raw SQL in migration
   - Test: Model imports correctly; `ruff check`

3. **Create `__init__.py`** (`backend/app/features/shared/__init__.py`)
   - Action: Create empty file
   - Why: Required for Python package
   - Dependencies: None
   - Risk: Low

4. **Write Alembic migration** (`backend/alembic/versions/0015_shared_foods.py`)
   - Action: Hand-write migration (do NOT use autogenerate -- computed columns and new enums need manual SQL)
   - Migration steps:
     1. Create `visibility_enum` PostgreSQL enum type with `CREATE TYPE ... IF NOT EXISTS`
     2. Create `moderation_status_enum` PostgreSQL enum type
     3. Create `shared_foods` table with all columns EXCEPT search_vector
     4. Add search_vector as GENERATED ALWAYS STORED column via raw SQL (same pattern as migration 0010)
     5. Create GIN index on search_vector
     6. Create `shared_food_portions` table
     7. Create all other indexes
   - Down migration: drop tables, drop enums
   - Revision: `0015_shared_foods`, depends on `0014_make_device_id_nullable`
   - Why: Tables must exist before service/router code can run
   - Dependencies: Step 2 (model definition guides column specs)
   - Risk: High -- enum creation and computed columns are error-prone in Alembic. Must test migration up+down on fresh and existing DBs.
   - Test: `alembic upgrade head` on test DB; `alembic downgrade -1` succeeds

5. **Register model in alembic env.py** (`backend/alembic/env.py`)
   - Action: Add `from app.features.shared import models as _shared  # noqa: F401` alongside other model imports
   - Why: Required for future autogenerate to detect shared models
   - Dependencies: Step 2
   - Risk: Low

6. **Update test conftest** (`backend/tests/conftest.py`)
   - Action:
     - Add import: `from app.features.shared.models import SharedFood, SharedFoodPortion`
     - Add to the model tuple in `test_engine` fixture for `Base.metadata.create_all`
     - Add enum creation SQL for `visibility_enum` and `moderation_status_enum` in the `test_engine` fixture (same pattern as `unit_enum` and `meal_type_enum`)
   - Why: Test DB must have these tables and enums
   - Dependencies: Step 2
   - Risk: Low

Verification:
```bash
cd backend && ruff check app/core/enums.py app/features/shared/
cd backend && alembic upgrade head
cd backend && pytest tests/api/test_health.py -v  # smoke test that app still starts
```

### Phase 2: Schemas + Test Factories (Contract Layer)
Estimate: 2 files new, 1 file modified

1. **Create Pydantic schemas** (`backend/app/features/shared/schemas.py`)
   - Action: Define request/response schemas
   - Schemas:
     - `SharedFoodCreateRequest`: name (str, 1-200), display_name (str, 1-200), description (str|None, max 2000), brand (str|None, max 200), barcode (str|None, max 50), category (str|None, max 200)
     - `SharedFoodUpdateRequest`: all fields optional (same as create but nullable)
     - `SharedFoodPortionCreateRequest`: label (str, 1-200), base_amount (Decimal, gt=0), base_unit (Unit), gram_weight (Decimal|None, gt=0), calories (Decimal, ge=0), protein/carbs/fat (Decimal|None, ge=0), is_default (bool, default False)
     - `SharedFoodPortionResponse`: id, shared_food_id, label, base_amount, base_unit, gram_weight, calories, protein, carbs, fat, is_default
     - `SharedFoodResponse`: id, owner_user_id, name, display_name, description, brand, barcode, category, visibility, moderation_status, created_at, updated_at, portions (list[SharedFoodPortionResponse])
     - `SharedFoodListItem`: id, owner_user_id, name, display_name, brand, barcode, category, visibility, moderation_status, default_portion (SharedFoodPortionResponse|None)
     - `SharedFoodPublishRequest`: (empty body -- just changes visibility to public)
     - `SharedFoodImportResponse`: product_id (UUID), portion_count (int) -- confirms what was created in private domain
   - Why: Contracts must be defined before service/router to enable TDD
   - Dependencies: Phase 1 Step 1 (enums)
   - Risk: Low
   - Test: `ruff check app/features/shared/schemas.py`

2. **Add test factories** (`backend/tests/factories.py`)
   - Action: Add `create_shared_food()` and `create_shared_food_portion()` functions
   - `create_shared_food(session, *, owner_user_id, name=..., visibility=Visibility.private, moderation_status=ModerationStatus.pending, **overrides)` -> SharedFood
   - `create_shared_food_portion(session, *, shared_food_id, label="100 g", base_amount=100, base_unit=Unit.g, calories=200, is_default=True, **overrides)` -> SharedFoodPortion
   - Why: All tests need consistent factory functions
   - Dependencies: Phase 1 Step 2 (models)
   - Risk: Low
   - Test: Factory functions used in Phase 3 tests

Verification:
```bash
cd backend && ruff check app/features/shared/schemas.py tests/factories.py
```

### Phase 3: Service Layer (Business Logic)
Estimate: 2 files new

1. **Create shared foods service** (`backend/app/features/shared/service.py`)
   - Action: Implement all business logic functions
   - Functions:
     - `create_shared_food(session, *, owner_user_id, name, display_name, description, brand, barcode, category) -> SharedFood`
       - Creates a new shared food with default visibility=private, moderation_status=pending
     - `list_my_shared_foods(session, *, owner_user_id, limit, offset) -> list[SharedFood]`
       - Returns all non-deleted shared foods owned by this user (any visibility/status)
       - Ordered by created_at desc
     - `get_shared_food(session, *, shared_food_id) -> SharedFood | None`
       - Returns a single shared food with portions (no ownership check -- caller decides)
     - `update_shared_food(session, *, owner_user_id, shared_food_id, ...) -> SharedFood | None`
       - Returns None if not found or not owned by this user
       - If visibility is already public and moderation_status is approved, changing content resets moderation_status to pending
     - `soft_delete_shared_food(session, *, owner_user_id, shared_food_id) -> bool`
       - Only owner can delete; sets deleted_at
     - `publish_shared_food(session, *, owner_user_id, shared_food_id) -> SharedFood | None`
       - Sets visibility=public, moderation_status=pending
       - Returns None if not found or not owned
       - Returns 409-worthy error if already public (handle in router)
     - `unpublish_shared_food(session, *, owner_user_id, shared_food_id) -> SharedFood | None`
       - Sets visibility=private, keeps moderation_status as-is
     - `search_shared_foods(session, *, q, limit, offset) -> list[SharedFood]`
       - Only returns items where visibility=public AND moderation_status=approved AND deleted_at IS NULL
       - Uses combined tsvector + ILIKE search (same pattern as catalog service)
       - Ordered by ts_rank desc for >= 3 char queries, display_name asc otherwise
     - `add_portion_to_shared_food(session, *, owner_user_id, shared_food_id, ...) -> SharedFoodPortion | None`
       - Validates ownership; manages is_default constraint (clear previous default if new one is default)
     - `import_shared_food_to_private(session, *, user_id, shared_food_id) -> tuple[Product, list[ProductPortion]]`
       - Copies shared food -> private Product (name, barcode)
       - Copies all shared food portions -> private ProductPortions
       - The shared food must be visible to the user (public+approved OR owned by user)
       - Returns the created private product and portions
   - `_not_deleted(stmt)` helper: filters `SharedFood.deleted_at.is_(None)`
   - Why: All business rules centralized in service; router stays thin
   - Dependencies: Phase 1 (models), Phase 2 (schemas for return types validation)
   - Risk: Medium -- import flow touches both shared and private domains; must handle the is_default portion constraint correctly
   - Test: See Phase 3 Step 2

2. **Write service tests** (`backend/tests/services/test_shared_foods_db.py`)
   - Action: Write comprehensive service-level tests
   - Test cases:
     - `test_create_shared_food` -- creates with correct defaults (private, pending)
     - `test_list_my_shared_foods_only_returns_owned` -- user B cannot see user A's items
     - `test_list_my_shared_foods_includes_all_statuses` -- owner sees private, public, rejected
     - `test_list_my_shared_foods_excludes_deleted` -- soft-deleted items not returned
     - `test_get_shared_food_returns_with_portions` -- eagerly loads portions
     - `test_get_shared_food_not_found` -- returns None for unknown ID
     - `test_update_shared_food_only_owner` -- non-owner gets None
     - `test_update_shared_food_resets_moderation` -- editing approved+public item resets to pending
     - `test_soft_delete_only_owner` -- non-owner returns False
     - `test_publish_sets_visibility_public` -- visibility becomes public
     - `test_publish_not_found_returns_none`
     - `test_unpublish_sets_visibility_private`
     - `test_search_only_finds_public_approved` -- private/pending/rejected items excluded
     - `test_search_tsvector_finds_by_display_name` -- FTS works
     - `test_search_ilike_fallback` -- short queries use ILIKE
     - `test_search_excludes_deleted`
     - `test_add_portion_validates_ownership`
     - `test_add_portion_manages_default_flag`
     - `test_import_to_private_creates_product_and_portions` -- full copy flow
     - `test_import_to_private_only_visible_items` -- cannot import private item from another user
     - `test_import_to_private_owner_can_import_own_private` -- owner can import their own
   - Why: TDD -- service logic is the core business value; must be thoroughly tested
   - Dependencies: Phase 2 (factories)
   - Risk: Low
   - Test: `pytest tests/services/test_shared_foods_db.py -v`

Verification:
```bash
cd backend && ruff check app/features/shared/service.py
cd backend && pytest tests/services/test_shared_foods_db.py -v
```

### Phase 4: Router (API Layer)
Estimate: 2 files new, 1 file modified

1. **Create shared foods router** (`backend/app/features/shared/router.py`)
   - Action: Define API endpoints
   - Endpoints:
     - `POST /v1/shared/foods` -- Create a shared food (authenticated, becomes owner)
     - `GET /v1/shared/foods/mine` -- List my shared foods (authenticated, owner only)
     - `GET /v1/shared/foods/search` -- Search public+approved shared foods (authenticated)
     - `GET /v1/shared/foods/{id}` -- Get shared food detail (authenticated, must be owner OR public+approved)
     - `PATCH /v1/shared/foods/{id}` -- Update shared food (authenticated, owner only)
     - `DELETE /v1/shared/foods/{id}` -- Soft delete shared food (authenticated, owner only)
     - `POST /v1/shared/foods/{id}/publish` -- Publish to community (authenticated, owner only)
     - `POST /v1/shared/foods/{id}/unpublish` -- Unpublish (authenticated, owner only)
     - `POST /v1/shared/foods/{id}/portions` -- Add a portion (authenticated, owner only)
     - `POST /v1/shared/foods/{id}/import` -- Import to private collection (authenticated, any user with access)
   - Router prefix: `/shared` with tag `shared`
   - Auth: All endpoints use `get_current_user_id` dependency
   - Error codes:
     - 404 for not found or no access
     - 409 for publish when already public
     - 403 for edit/delete when not owner
   - Why: Thin router layer wires HTTP to service
   - Dependencies: Phase 3 (service)
   - Risk: Low -- follows established router patterns exactly
   - Test: See Step 2

2. **Register router in main.py** (`backend/app/main.py`)
   - Action: Import and include the shared router in the v1 APIRouter
   - Add: `from app.features.shared.router import router as shared_router`
   - Add: `v1.include_router(shared_router)`
   - Why: Router must be registered to be accessible
   - Dependencies: Step 1
   - Risk: Low

3. **Write router integration tests** (`backend/tests/api/test_shared_foods_api.py`)
   - Action: Write HTTP-level integration tests
   - Test cases:
     - `test_create_shared_food_requires_auth` -- 401 without token
     - `test_create_shared_food_success` -- 201, returns created item
     - `test_list_my_shared_foods_empty` -- 200, empty list
     - `test_list_my_shared_foods_returns_owned` -- only my items
     - `test_search_shared_foods_returns_public_approved` -- cross-user visibility
     - `test_search_shared_foods_excludes_private` -- user B's private not visible
     - `test_get_shared_food_owner_can_see_private` -- owner access
     - `test_get_shared_food_other_user_public_approved` -- non-owner can see public+approved
     - `test_get_shared_food_other_user_private_404` -- non-owner cannot see private
     - `test_update_shared_food_success` -- 200
     - `test_update_shared_food_not_owner_403` -- cannot edit another user's item
     - `test_delete_shared_food_success` -- 204
     - `test_delete_shared_food_not_owner_403`
     - `test_publish_shared_food_success` -- 200, visibility changes
     - `test_publish_already_public_409` -- conflict
     - `test_unpublish_shared_food_success`
     - `test_add_portion_success` -- 201
     - `test_add_portion_not_owner_403`
     - `test_import_shared_food_success` -- 201, returns product_id + portion_count
     - `test_import_private_food_from_other_user_404`
   - Pattern: Uses `authenticated_client` fixture; creates a second user for cross-user tests (via `create_user` factory + separate JWT)
   - Why: End-to-end verification of the full HTTP request cycle
   - Dependencies: Phase 4 Steps 1-2
   - Risk: Medium -- cross-user tests require creating a second authenticated client. Use `_make_test_jwt` from conftest to create tokens for a second user.
   - Test: `pytest tests/api/test_shared_foods_api.py -v`

Verification:
```bash
cd backend && ruff check app/features/shared/ tests/api/test_shared_foods_api.py
cd backend && pytest tests/api/test_shared_foods_api.py tests/services/test_shared_foods_db.py -v
cd backend && pytest --cov=app --cov-report=term-missing  # full suite, no regressions
```

## Testing Strategy

- **Unit tests** (`tests/services/test_shared_foods_db.py`): All service functions tested with real database. ~20 test cases covering CRUD, ownership, visibility, search, import.
- **Integration tests** (`tests/api/test_shared_foods_api.py`): All endpoints tested via HTTP client. ~20 test cases covering auth, cross-user isolation, error codes.
- **Cross-user isolation** is tested in both layers: service tests create two users via factory; API tests create two authenticated clients.
- **Manual verification**: After migration, inspect DB schema with `\d shared_foods` and `\d shared_food_portions` to verify columns, indexes, and constraints.

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Computed tsvector column fails in migration | High | Use exact same raw SQL pattern from migration 0010 (proven working). Test up+down on fresh DB. |
| New PostgreSQL enum types conflict with existing | Medium | Use `CREATE TYPE ... IF NOT EXISTS` in migration. Use distinct names (`visibility_enum`, `moderation_status_enum`). |
| Import flow creates orphan portions if product creation fails | Medium | Wrap entire import in a single transaction (`async with session.begin()`). |
| `search_vector` not populated for test-inserted rows | Medium | PostgreSQL GENERATED ALWAYS STORED columns auto-compute on INSERT/UPDATE. Verified this works in catalog tests. However, `Base.metadata.create_all` may not create the computed column correctly -- if so, add raw SQL in conftest like we do for enums. |
| Cross-user test fixtures are complex | Low | Reuse `_make_test_jwt` and `create_user` factory from existing conftest/factories. Document the pattern for second authenticated client. |
| `moderation_status` reset on edit is business logic that could be missed | Medium | Dedicated test case `test_update_shared_food_resets_moderation`. Service function has explicit check. |
| Table naming: `shared_foods` vs `shared_products` (ADR says `shared_products`) | Low | Issue says `shared_foods`. Confirm with user. Using `shared_foods` avoids confusion with existing `products` table. |

## Open Questions

1. **Table name**: The issue says `shared_foods` and `shared_templates`. ADR-008 says `shared_products` and `shared_meal_templates`. Which naming convention do we follow? This plan uses `shared_foods` + `shared_food_portions` per the issue. Please confirm.

2. **Shared meal templates**: Are they in scope for Phase 4? The issue mentions `shared_templates` but they have a fundamentally different structure (JSONB items array). This plan defers them. Should they be included or planned separately?

3. **Visibility of unlisted items**: The ADR says unlisted items are "accessible via direct link/ID but not in search results." For the `GET /shared/foods/{id}` endpoint, should any authenticated user be able to access an unlisted item by ID, or only users who have been explicitly given the link? (This plan assumes: any authenticated user can access unlisted items by ID, matching the ADR description.)

4. **403 vs 404 for unauthorized access**: When user B tries to edit/delete user A's shared food, should the API return 403 (Forbidden -- reveals existence) or 404 (Not Found -- hides existence)? Security best practice is 404, but 403 gives better UX. The existing product API uses 404 for cross-user access. This plan uses 403 for shared items since their existence is already publicly discoverable (if published). For private items accessed by non-owners, we use 404.

5. **Portion management**: Should portions have their own UPDATE and DELETE endpoints, or is the MVP to just add portions (with the ability to recreate by deleting and re-adding the shared food)? This plan only includes `POST .../portions` for adding. Full portion CRUD can be added later.
