---
type: plan
status: draft
last-updated: 2026-03-30
---

# Implementation Plan: ADR-010 Direct Catalog Reference in Food Entries

## Overview

Food entries currently require a private copy of catalog products/portions before tracking. This plan implements a direct `catalog_portion_id` FK on `food_entries`, allowing catalog items to be tracked with a single API call instead of 3-4. The change spans an Alembic migration, backend service/schema/router/stats/sync changes, client API types, two hooks, one screen, and test helpers. Seed scripts are updated to use UPSERT instead of DELETE+INSERT for catalog portions.

## Success Criteria

- [ ] Food entries can be created with `catalog_portion_id` instead of `product_id + portion_id`
- [ ] XOR validation: exactly one of (product_id + portion_id) or catalog_portion_id must be set
- [ ] Stats (day/daily) correctly sum nutrition from both private and catalog portions
- [ ] Sync push/pull includes `catalog_portion_id` for food entries
- [ ] `ProductConfirmScreen` tracks catalog food in 1 API call (no backend product/portion creation)
- [ ] `useMealTypeEntries` enriches catalog entries using local product copy + fallback
- [ ] All existing food entries (with product_id + portion_id) continue working unchanged
- [ ] Seed scripts use UPSERT for catalog portions (ON DELETE RESTRICT safety)
- [ ] Backend tests cover both paths (private + catalog) for create, stats, and sync
- [ ] Client tests cover catalog path in useFoodEntries and useMealTypeEntries
- [ ] CHECK constraint deployed after code is stable (Phase 4, can be deferred)

## Assumptions

- `CatalogPortion` has identical nutritional columns to `ProductPortion` (`base_amount`, `base_unit`, `calories`, `protein`, `carbs`, `fat`) -- validated by reading `backend/app/features/catalog/models.py`
- `calc_totals_for_entry` works with both portion types since it takes individual field params -- validated by reading `backend/app/features/stats/calculation.py`
- Seed scripts use raw asyncpg DELETE+INSERT for portions -- validated by reading `backend/scripts/seeders/usda.py` lines 240-245 and `off.py` lines 205-209
- Latest migration is `0018_moderation_tables` -- validated by listing `backend/alembic/versions/`
- `MealItem` type in `client/src/models/types.ts` currently has no `catalogPortionId` field -- validated by reading the file
- `FoodEntry` API type in `client/src/services/api/foodEntries.ts` currently has non-nullable `productId` and `portionId` -- validated
- `useMealTypeEntries.enrichEntry` resolves product name from local products map via `entry.productId` -- validated
- Favorites/recents store plain product ID strings and will continue to work with local product copies -- validated by ADR decision (Option A)

## Architecture Changes

1. **Database**: Add nullable `catalog_portion_id` FK to `food_entries`, make `product_id`/`portion_id` nullable, add partial index, add CHECK constraint (deferred)
2. **Backend service**: Dual create path in `create_food_entry` -- private vs catalog
3. **Backend stats**: Two queries (private portions + catalog portions) merged in Python
4. **Backend sync**: Add `catalog_portion_id` to push fields
5. **Backend schemas**: Nullable fields + XOR model validator on create request
6. **Backend router**: Pass through `catalog_portion_id` to service
7. **Seed scripts**: Replace DELETE+INSERT with UPSERT for catalog portions
8. **Client API types**: Nullable fields + discriminated union create request
9. **Client hooks**: Catalog path bypasses product/portion creation
10. **Client screen**: `ProductConfirmScreen` uses catalog path

## Files Affected

### New Files
- `backend/alembic/versions/0019_food_entries_catalog_portion.py` -- Alembic migration
- `backend/tests/services/test_food_entries_catalog_db.py` -- New test file for catalog path service tests
- `backend/tests/services/test_stats_catalog_db.py` -- New test file for stats with catalog entries

### Modified Files

**Backend:**
- `backend/app/features/meals/models.py` -- Add `catalog_portion_id` column, make `product_id`/`portion_id` nullable
- `backend/app/features/meals/schemas.py` -- Nullable fields, new field, XOR validator
- `backend/app/features/meals/service.py` -- Dual create path, `_get_catalog_portion` helper
- `backend/app/features/meals/router.py` -- Pass `catalog_portion_id` to service
- `backend/app/features/stats/service.py` -- Dual query for private + catalog portions
- `backend/app/features/sync/service.py` -- Add `catalog_portion_id` to `_PUSH_FIELDS`
- `backend/scripts/seeders/usda.py` -- UPSERT for catalog portions
- `backend/scripts/seeders/off.py` -- UPSERT for catalog portions
- `backend/tests/factories.py` -- Add `catalog_portion_id` param to `create_food_entry`
- `backend/tests/services/test_food_entries_db.py` -- Verify existing tests still pass (no changes needed)

**Client:**
- `client/src/models/types.ts` -- Add `catalogPortionId?` to `MealItem`
- `client/src/services/api/foodEntries.ts` -- Nullable fields, union create type, transform update
- `client/src/hooks/useFoodEntries.ts` -- Catalog path in `saveMealToBackend`
- `client/src/hooks/useMealTypeEntries.ts` -- Enrichment branching for catalog entries
- `client/src/screens/ProductFlow/ProductConfirmScreen.tsx` -- Catalog path: no backend product creation, pass `catalogPortionId`
- `client/src/test/helpers.ts` -- Update `makeFoodEntry` with nullable fields, add catalog factory
- `client/src/hooks/useFoodEntries.test.tsx` -- Add catalog path tests
- `client/src/hooks/useMealTypeEntries.test.tsx` -- Add catalog entry enrichment tests

## Implementation Steps

### Phase 1: Database Migration + ORM Model (Backend)
Estimate: 3 files

**Why first**: Every other backend change depends on the schema. Migration must be applied before service/schema/router changes.

1. **Update FoodEntry ORM model** (`backend/app/features/meals/models.py`)
   - Action: Change `product_id` mapped type from `Mapped[uuid.UUID]` to `Mapped[uuid.UUID | None]`, set `nullable=True`
   - Action: Change `portion_id` mapped type from `Mapped[uuid.UUID]` to `Mapped[uuid.UUID | None]`, set `nullable=True`
   - Action: Add `catalog_portion_id: Mapped[uuid.UUID | None]` column with `ForeignKey("catalog_portions.id", ondelete="RESTRICT")`, `nullable=True`, `index=True`
   - Action: Add import for `CheckConstraint` from sqlalchemy
   - Action: Add `CheckConstraint` to `__table_args__` tuple:
     ```
     CheckConstraint(
         "(portion_id IS NOT NULL AND catalog_portion_id IS NULL) OR "
         "(portion_id IS NULL AND catalog_portion_id IS NOT NULL)",
         name="ck_food_entries_portion_xor",
     )
     ```
   - Why: ORM must match the target schema for autogenerate to work
   - Dependencies: None
   - Risk: Low
   - Test: `ruff check app/features/meals/models.py`

2. **Generate Alembic migration** (`backend/alembic/versions/0019_food_entries_catalog_portion.py`)
   - Action: Run `alembic revision --autogenerate -m "food_entries_catalog_portion"`
   - Action: Review the generated migration. It should contain:
     - `op.add_column('food_entries', sa.Column('catalog_portion_id', UUID, ForeignKey('catalog_portions.id', ondelete='RESTRICT'), nullable=True))`
     - `op.alter_column('food_entries', 'product_id', nullable=True)`
     - `op.alter_column('food_entries', 'portion_id', nullable=True)`
     - `op.create_index('ix_food_entries_catalog_portion_id', 'food_entries', ['catalog_portion_id'], postgresql_where=...)`
     - `op.create_check_constraint('ck_food_entries_portion_xor', ...)`
   - Action: **Important**: The CHECK constraint should be added BUT commented out with a note "Uncomment after all clients send valid data (Phase 4)". This follows the ADR's staged deployment strategy (steps 1-3 deploy first, step 4 adds constraint later). For now, we do NOT enforce the constraint at DB level -- only at schema validation level.
   - Action: In downgrade, drop the constraint, drop index, drop column, restore NOT NULL on `product_id` and `portion_id`
   - Why: Schema must exist before services can reference the new column
   - Dependencies: Step 1
   - Risk: Medium -- autogenerate may not handle partial index or check constraint correctly; manual review required
   - Test: `alembic upgrade head` then `alembic downgrade -1` then `alembic upgrade head` again

3. **Update test factory** (`backend/tests/factories.py`)
   - Action: Add `catalog_portion_id: uuid.UUID | None = None` parameter to `create_food_entry` function
   - Action: Add `"catalog_portion_id": catalog_portion_id` to the defaults dict
   - Why: Tests need to create food entries with catalog portions
   - Dependencies: Step 1 (ORM model)
   - Risk: Low
   - Test: `ruff check tests/factories.py`

Verification: `cd backend && ruff check app/ tests/ && alembic upgrade head && pytest --cov=app --cov-report=term-missing`

---

### Phase 2: Backend Service + Schema + Router (Backend)
Estimate: 5 files

**Why second**: Service logic, Pydantic schemas, and router wiring depend on the ORM model from Phase 1. Stats and sync are separate concerns handled in Phase 3.

1. **Update Pydantic schemas** (`backend/app/features/meals/schemas.py`)
   - Action: In `FoodEntryCreateRequest`:
     - Change `product_id: UUID` to `product_id: UUID | None = None`
     - Change `portion_id: UUID` to `portion_id: UUID | None = None`
     - Add `catalog_portion_id: UUID | None = None`
     - Add `from typing import Self` import
     - Add `from pydantic import model_validator` import
     - Add XOR model validator:
       ```python
       @model_validator(mode="after")
       def check_portion_xor(self) -> Self:
           has_private = self.product_id is not None and self.portion_id is not None
           has_catalog = self.catalog_portion_id is not None
           if has_private == has_catalog:
               raise ValueError(
                   "Provide either (product_id + portion_id) or catalog_portion_id, not both/neither"
               )
           return self
       ```
   - Action: In `FoodEntryUpdateRequest`:
     - Add `catalog_portion_id: UUID | None = None` (for changing portion type on an existing entry -- edge case, but schema should allow it)
   - Action: In `FoodEntryResponse`:
     - Change `product_id: UUID` to `product_id: UUID | None`
     - Change `portion_id: UUID` to `portion_id: UUID | None`
     - Add `catalog_portion_id: UUID | None`
   - Why: Schema validation must enforce XOR before data hits the service
   - Dependencies: Phase 1
   - Risk: Low
   - Test: Unit test the validator (inline or separate test file)

2. **Add `_get_catalog_portion` helper and update `create_food_entry`** (`backend/app/features/meals/service.py`)
   - Action: Add import for `CatalogPortion` from `app.features.catalog.models`
   - Action: Add helper function:
     ```python
     async def _get_catalog_portion(
         session: AsyncSession,
         catalog_portion_id: uuid.UUID,
     ) -> CatalogPortion | None:
         stmt = select(CatalogPortion).where(
             CatalogPortion.id == catalog_portion_id,
         ).limit(1)
         res = await session.execute(stmt)
         return res.scalar_one_or_none()
     ```
   - Action: Update `create_food_entry` signature:
     - Change `product_id: uuid.UUID` to `product_id: uuid.UUID | None = None`
     - Change `portion_id: uuid.UUID` to `portion_id: uuid.UUID | None = None`
     - Add `catalog_portion_id: uuid.UUID | None = None`
   - Action: Add branching logic at the top of `create_food_entry`:
     ```python
     if catalog_portion_id is not None:
         cat_portion = await _get_catalog_portion(session, catalog_portion_id)
         if cat_portion is None:
             return None
         entry = FoodEntry(
             user_id=user_id,
             device_id=device_id,
             created_on_device_id=device_id,
             catalog_portion_id=catalog_portion_id,
             day=day,
             meal_type=meal_type,
             amount=amount,
             unit=unit,
         )
         session.add(entry)
         await session.commit()
         await session.refresh(entry)
         return entry
     ```
   - Action: Keep existing private-product path in the `else` branch (product_id/portion_id validation unchanged)
   - Why: Core business logic for the dual-path creation
   - Dependencies: Phase 1 step 1 (ORM model)
   - Risk: Medium -- must ensure None handling is correct for the private path when product_id/portion_id could theoretically be None (though schema validator prevents this)
   - Test: New test file (step 4)

3. **Update router** (`backend/app/features/meals/router.py`)
   - Action: In `food_entries_create`, update the `create_food_entry` call to pass `catalog_portion_id`:
     ```python
     entry = await create_food_entry(
         session,
         user_id=user_id,
         product_id=body.product_id,
         portion_id=body.portion_id,
         catalog_portion_id=body.catalog_portion_id,
         day=body.day,
         meal_type=body.meal_type,
         amount=body.amount,
         unit=body.unit,
         device_id=device_id,
     )
     ```
   - Why: Router must pass the new field through to the service
   - Dependencies: Step 2
   - Risk: Low
   - Test: API tests (step 5)

4. **Write service tests for catalog path** (`backend/tests/services/test_food_entries_catalog_db.py`)
   - Action: Create new test file with tests:
     - `test_create_food_entry_catalog_success` -- create with valid catalog_portion_id, assert entry.catalog_portion_id is set, product_id and portion_id are None
     - `test_create_food_entry_catalog_portion_not_found` -- non-existent catalog_portion_id returns None
     - `test_create_food_entry_catalog_no_device_scoping` -- catalog portion is global; any user can reference it
     - `test_list_food_entries_includes_catalog_entries` -- list returns both private and catalog entries
     - `test_get_food_entry_catalog` -- get by ID works for catalog entries
     - `test_soft_delete_food_entry_catalog` -- soft delete works for catalog entries
     - `test_update_food_entry_catalog_amount` -- updating amount on catalog entry works
   - Action: Use `create_catalog_product` and `create_catalog_portion` factories (already exist) to set up test data
   - Action: Use updated `create_food_entry` factory with `catalog_portion_id` param, passing `product_id=None, portion_id=None`
   - Why: TDD -- tests for the new path before verifying
   - Dependencies: Phase 1 step 3 (factory), Phase 2 step 2 (service)
   - Risk: Low
   - Test: `pytest tests/services/test_food_entries_catalog_db.py -v`

5. **Write API tests for catalog create endpoint** (add to existing `backend/tests/api/` or create `test_food_entries_api.py`)
   - Action: Check if `backend/tests/api/test_food_entries_api.py` exists; if not, create it
   - Action: Tests:
     - `test_create_food_entry_catalog_201` -- POST with `catalog_portion_id` returns 201 with correct response
     - `test_create_food_entry_catalog_portion_not_found_404` -- non-existent catalog_portion_id returns 404
     - `test_create_food_entry_both_paths_422` -- sending both `product_id+portion_id` AND `catalog_portion_id` returns 422 (validation error)
     - `test_create_food_entry_neither_path_422` -- sending neither returns 422
     - `test_list_food_entries_includes_catalog` -- GET returns both types
     - `test_get_food_entry_catalog_response_shape` -- verify response has nullable fields
   - Why: End-to-end verification of the API contract
   - Dependencies: Steps 1-3
   - Risk: Low
   - Test: `pytest tests/api/test_food_entries_api.py -v`

Verification: `cd backend && ruff check app/ tests/ && pytest --cov=app --cov-report=term-missing`

---

### Phase 3: Backend Stats + Sync (Backend)
Estimate: 4 files

**Why third**: Stats and sync depend on the schema/model changes from Phases 1-2 but are independent of each other and can be implemented in parallel.

1. **Update stats service** (`backend/app/features/stats/service.py`)
   - Action: Add import for `CatalogPortion` from `app.features.catalog.models`
   - Action: In `get_day_stats`, extract the existing query into a helper or duplicate with modification:
     - Query 1 (existing, modified): Add filter `FoodEntry.portion_id.is_not(None)` to restrict to private entries
     - Query 2 (new): Select `(FoodEntry, CatalogPortion)` joined on `CatalogPortion.id == FoodEntry.catalog_portion_id`, filtered by `FoodEntry.catalog_portion_id.is_not(None)` and same user/day/deleted_at filters. Note: `CatalogPortion` has no `deleted_at` so skip that filter for catalog portions.
   - Action: Process both result sets through the same accumulation logic (they both feed into `totals` and `by_meal`)
   - Action: Extract the entry processing loop into a helper to avoid duplication:
     ```python
     def _accumulate(
         results, totals: MacroTotals, by_meal: dict[MealType, MacroTotals]
     ) -> tuple[MacroTotals, dict[MealType, MacroTotals]]:
         for entry, portion in results:
             entry_totals = calc_totals_for_entry(
                 entry_amount=entry.amount,
                 entry_unit=entry.unit,
                 portion_base_amount=portion.base_amount,
                 portion_base_unit=portion.base_unit,
                 portion_calories=portion.calories,
                 portion_protein=portion.protein,
                 portion_carbs=portion.carbs,
                 portion_fat=portion.fat,
             )
             totals = _add(totals, entry_totals)
             by_meal[entry.meal_type] = _add(by_meal[entry.meal_type], entry_totals)
         return totals, by_meal
     ```
   - Why: Stats must correctly include catalog entries or users will see 0 calories for catalog-tracked food
   - Dependencies: Phase 1 (model)
   - Risk: Medium -- this is the most critical change; incorrect stats would break the app's core value proposition
   - Test: New test file (step 2)

2. **Write stats tests for catalog entries** (`backend/tests/services/test_stats_catalog_db.py`)
   - Action: Create new test file:
     - `test_get_day_stats_catalog_entry` -- single catalog entry produces correct totals
     - `test_get_day_stats_mixed_entries` -- mix of private + catalog entries sums correctly
     - `test_get_day_stats_catalog_by_meal_type` -- catalog entries grouped by meal type correctly
     - `test_get_day_stats_catalog_deleted_excluded` -- soft-deleted catalog entries excluded
     - `test_get_daily_stats_catalog` -- daily range includes catalog entries
   - Action: Use `create_catalog_product`, `create_catalog_portion`, and `create_food_entry(catalog_portion_id=...)` factories
   - Why: TDD for the most critical code path
   - Dependencies: Phase 2 step 4 (factory + service for creating catalog entries)
   - Risk: Low
   - Test: `pytest tests/services/test_stats_catalog_db.py -v`

3. **Update sync push fields** (`backend/app/features/sync/service.py`)
   - Action: Add `"catalog_portion_id"` to `_PUSH_FIELDS["food_entries"]` set:
     ```python
     "food_entries": {
         "product_id", "portion_id", "catalog_portion_id",
         "day", "meal_type", "amount", "unit",
     },
     ```
   - Why: Sync push must accept `catalog_portion_id` from clients
   - Dependencies: Phase 1 (model)
   - Risk: Low -- pull side needs no changes (ORM serialization includes all columns)
   - Test: Existing sync tests should still pass; add a targeted test

4. **Add sync push test for catalog_portion_id** (add to `backend/tests/services/test_sync_service.py` or `backend/tests/api/test_sync_push.py`)
   - Action: Add test `test_push_food_entry_with_catalog_portion_id` -- push a food entry mutation with `catalog_portion_id` in data, verify it's accepted and the row has the correct value
   - Why: Verify sync handles the new field
   - Dependencies: Step 3
   - Risk: Low
   - Test: `pytest tests/ -k "sync" -v`

Verification: `cd backend && ruff check app/ tests/ && pytest --cov=app --cov-report=term-missing`

---

### Phase 4: Seed Script Update (Backend)
Estimate: 2 files

**Why fourth**: Seed scripts are deployment infrastructure, not application logic. They need updating before the next re-seed, but not before the app code.

1. **Update USDA seeder** (`backend/scripts/seeders/usda.py`)
   - Action: Replace the DELETE + INSERT pattern (lines ~240-290) with:
     - Keep the existing product UPSERT (ON CONFLICT DO UPDATE) unchanged
     - For portions, replace `DELETE FROM catalog_portions WHERE catalog_product_id = ANY($1::uuid[])` with:
       - First, collect all new portion data with deterministic IDs (hash of product_id + label + base_unit) or use existing IDs where available
       - Use INSERT ... ON CONFLICT to upsert: need a unique constraint on `(catalog_product_id, label, base_unit)` or use the existing `id` PK
     - **Simpler approach**: Since portions don't have a natural unique key beyond PK, and IDs are auto-generated:
       - SELECT existing portion IDs for the batch's products
       - For each product, UPDATE existing portions (match by `catalog_product_id` + `label` + `base_unit`) and INSERT new ones
       - DELETE only portions that are no longer in the seed data AND have no referencing food entries:
         ```sql
         DELETE FROM catalog_portions
         WHERE catalog_product_id = ANY($1::uuid[])
           AND id NOT IN (SELECT catalog_portion_id FROM food_entries WHERE catalog_portion_id IS NOT NULL)
           AND (catalog_product_id, label, base_unit) NOT IN (VALUES ...)
         ```
     - **Recommended approach**: Add a unique constraint on `(catalog_product_id, label, base_unit)` in migration 0019, then use `INSERT ... ON CONFLICT (catalog_product_id, label, base_unit) DO UPDATE SET ...`
   - Why: DELETE will fail with RESTRICT FK once food entries reference catalog portions
   - Dependencies: Phase 1 (migration -- add unique constraint to catalog_portions)
   - Risk: Medium -- seed scripts are complex raw SQL; must test carefully
   - Test: Manual dry-run with `--dry-run` flag, then verify with a small dataset

2. **Update OFF seeder** (`backend/scripts/seeders/off.py`)
   - Action: Same pattern as step 1 -- replace DELETE + INSERT with UPSERT
   - Why: Same RESTRICT FK issue
   - Dependencies: Same as step 1
   - Risk: Medium -- same as step 1
   - Test: Same as step 1

**Open Question**: Should we add a unique constraint `(catalog_product_id, label, base_unit)` on `catalog_portions` in the 0019 migration to enable clean UPSERT? This is the cleanest approach but adds a constraint that didn't exist before. Alternative: use a CTE to identify referenced portions and skip deletion. **Recommendation**: Add the unique constraint -- it's semantically correct (a product shouldn't have two portions with the same label + unit) and enables clean UPSERT.

Verification: `cd backend && ruff check scripts/ && python -m scripts.seed_catalog --dry-run`

---

### Phase 5: Client API Types + Test Helpers (Client)
Estimate: 3 files

**Why fifth**: Client types are the foundation for all client-side changes. Can be done in parallel with backend Phases 2-4.

1. **Update `MealItem` type** (`client/src/models/types.ts`)
   - Action: Add optional `catalogPortionId` field to `MealItem`:
     ```typescript
     export type MealItem = {
       productId: string;
       amount: number;
       unit: Unit;
       catalogPortionId?: string;
     };
     ```
   - Why: `MealItem` is the input to `saveMealToBackend`; catalog items need to carry the catalog portion ID
   - Dependencies: None
   - Risk: Low -- additive change, no existing code breaks
   - Test: `npx tsc --noEmit`

2. **Update food entry API types** (`client/src/services/api/foodEntries.ts`)
   - Action: Update `FoodEntryApiResponse`:
     - Change `product_id: string` to `product_id: string | null`
     - Change `portion_id: string` to `portion_id: string | null`
     - Add `catalog_portion_id: string | null`
   - Action: Update `FoodEntry`:
     - Change `productId: string` to `productId: string | null`
     - Change `portionId: string` to `portionId: string | null`
     - Add `catalogPortionId: string | null`
   - Action: Update `FoodEntryCreateRequest` to a discriminated union:
     ```typescript
     export type FoodEntryCreateRequest =
       | {
           product_id: string;
           portion_id: string;
           day: string;
           meal_type: MealType;
           amount: string | number;
           unit: Unit;
         }
       | {
           catalog_portion_id: string;
           day: string;
           meal_type: MealType;
           amount: string | number;
           unit: Unit;
         };
     ```
   - Action: Update `transformFoodEntryResponse` to map nullable fields:
     ```typescript
     productId: response.product_id,        // null for catalog entries
     portionId: response.portion_id,        // null for catalog entries
     catalogPortionId: response.catalog_portion_id,  // null for private entries
     ```
   - Why: Client must understand the dual-shape API contract
   - Dependencies: None
   - Risk: Medium -- nullable `productId`/`portionId` may break type checks in consumers. Need to verify all `FoodEntry` consumers handle nulls.
   - Test: `npx tsc --noEmit` (will surface all type errors from nullable change)

3. **Update test helpers** (`client/src/test/helpers.ts`)
   - Action: Update `makeFoodEntry` to include nullable fields with defaults:
     ```typescript
     export const makeFoodEntry = (
       overrides: Partial<FoodEntry> = {},
     ): FoodEntry => ({
       id: "entry-1",
       productId: "prod-1",
       portionId: "portion-1",
       catalogPortionId: null,
       day: "2025-06-01",
       mealType: "breakfast",
       amount: 200,
       unit: "g",
       createdAt: "2025-06-01T08:00:00Z",
       updatedAt: "2025-06-01T08:00:00Z",
       ...overrides,
     });
     ```
   - Action: Add `makeCatalogFoodEntry` helper:
     ```typescript
     export const makeCatalogFoodEntry = (
       overrides: Partial<FoodEntry> = {},
     ): FoodEntry => ({
       id: "catalog-entry-1",
       productId: null,
       portionId: null,
       catalogPortionId: "cat-portion-1",
       day: "2025-06-01",
       mealType: "breakfast",
       amount: 200,
       unit: "g",
       createdAt: "2025-06-01T08:00:00Z",
       updatedAt: "2025-06-01T08:00:00Z",
       ...overrides,
     });
     ```
   - Action: Update `makeMealItem` to accept optional `catalogPortionId`:
     Already handled by `Partial<MealItem>` spread -- no change needed since the field is optional on `MealItem`.
   - Why: Test helpers must match new types
   - Dependencies: Step 2 (FoodEntry type)
   - Risk: Low
   - Test: `npx tsc --noEmit`

Verification: `cd client && npx tsc --noEmit && pnpm test`

---

### Phase 6: Client Hooks + Screen (Client)
Estimate: 5 files (including tests)

**Why sixth**: Hooks and screen depend on the updated types from Phase 5.

1. **Update `useFoodEntries` hook** (`client/src/hooks/useFoodEntries.ts`)
   - Action: In `saveMealToBackend`, add branching for catalog items:
     ```typescript
     for (const item of items) {
       const product = products.find((p) => p.id === item.productId);
       if (!product) {
         console.warn("Product not found:", item.productId);
         continue;
       }

       let request: FoodEntryCreateRequest;

       if (item.catalogPortionId) {
         // Catalog path -- single API call, no product/portion creation
         request = {
           catalog_portion_id: item.catalogPortionId,
           day: entryDay,
           meal_type: mealType,
           amount: item.amount,
           unit: item.unit,
         };
       } else {
         // Private product path -- existing flow
         let portionId: string;
         try {
           portionId = await getOrCreateDefaultPortion(item.productId, product);
         } catch (err) {
           console.error("Failed to get/create portion:", err);
           continue;
         }
         request = {
           product_id: item.productId,
           portion_id: portionId,
           day: entryDay,
           meal_type: mealType,
           amount: item.amount,
           unit: item.unit,
         };
       }

       try {
         const entry = await createFoodEntry(request);
         createdEntries.push(entry);
       } catch (err) {
         console.error("Failed to create food entry:", err);
       }
     }
     ```
   - Why: Core hook must support both paths
   - Dependencies: Phase 5
   - Risk: Low -- additive branching, existing path unchanged
   - Test: Step 4

2. **Update `useMealTypeEntries` hook** (`client/src/hooks/useMealTypeEntries.ts`)
   - Action: In `enrichEntry`, add branching for catalog entries:
     - Check `if (entry.catalogPortionId !== null && entry.productId === null)` -- this is a catalog entry
     - For catalog entries: skip `getPortionsForProduct` (no product_id to look up)
     - Instead, use the local product copy (still resolved via `entry.productId`) -- **wait, productId is null for catalog entries**
   - **Design issue**: `enrichEntry` currently uses `entry.productId` to look up the product name. But catalog entries have `productId: null`. The `ProductConfirmScreen` creates a local product copy with `source: "catalog"`, but the food entry from the backend won't reference that local product ID.
   - **Resolution**: `enrichEntry` needs a fallback lookup mechanism for catalog entries. Options:
     - **(A)** `ProductConfirmScreen` stores the local product ID alongside the catalog entry somehow (not possible since food entry doesn't store local product IDs)
     - **(B)** Add a `catalogProductName` field to `EnrichedFoodEntry` and resolve it from the catalog API
     - **(C)** The backend response includes a resolved product name (future enhancement from ADR)
     - **(D)** Maintain a local mapping `catalogPortionId -> productId` in AsyncStorage
     - **(E)** Simplest: Keep creating a local product copy AND use it for display. The entry's `productId` is null on the backend, but locally we can maintain a `catalogPortionId -> localProductId` map.
   - **Recommendation**: **(D/E hybrid)** -- In `ProductConfirmScreen`, after tracking, store a mapping `catalogPortionId -> { productName, productId }` in a lightweight cache (module-level Map or AsyncStorage key). `enrichEntry` checks this cache when `entry.catalogPortionId` is not null. This avoids an API call and works offline.
   - **Simpler alternative**: The `ProductConfirmScreen` already creates a local product. We can store the relationship `catalogPortionId -> localProductId` in the local product's metadata. But this couples the screen to the enrichment hook.
   - **Simplest pragmatic approach**: Add a new `catalogPortionProductMap` (Map<catalogPortionId, { name, calories, protein, carbs, fat, baseAmount, baseUnit }>) at module level in `useMealTypeEntries.ts`. `ProductConfirmScreen` populates it before saving. `enrichEntry` reads from it for catalog entries. This is a volatile cache that clears on app restart, and a full refresh would require the backend to provide resolved names (future enhancement).
   - **Even simpler**: Modify the backend `FoodEntryResponse` to include optional resolved fields RIGHT NOW (just `catalog_product_name` and portion nutrition fields). This front-loads the "future enhancement" from the ADR but makes the client dramatically simpler.

   **Decision needed from user -- see Open Questions.**

   - **For this plan, assume the pragmatic client-side cache approach**:
     - Action: Add a module-level `catalogPortionCache: Map<string, { productName: string; baseAmount: number; baseUnit: string; calories: number; protein: number; carbs: number; fat: number }>` at the top of `useMealTypeEntries.ts`
     - Action: Export a `setCatalogPortionInfo(catalogPortionId, info)` function
     - Action: In `enrichEntry`, when `entry.catalogPortionId` is not null:
       - Look up from `catalogPortionCache`
       - If found, compute nutrition from cache data
       - If not found, return a minimal entry with "Unknown Catalog Item" name (graceful degradation)
     - Action: Export a `clearCatalogPortionCache()` alongside the existing `clearMealTypeEntriesCache()`
   - Why: Catalog entries need display names and nutrition for the meal type cards
   - Dependencies: Phase 5 (types)
   - Risk: Medium -- cache volatility means catalog entries may show as "Unknown" after app restart until backend enrichment is implemented
   - Test: Step 5

3. **Update `ProductConfirmScreen`** (`client/src/screens/ProductFlow/ProductConfirmScreen.tsx`)
   - Action: Import `setCatalogPortionInfo` from `@hooks/useMealTypeEntries`
   - Action: In `handleTrackFood`, replace the existing flow:
     ```typescript
     // BEFORE: const newProduct = await addProduct({...});
     // AFTER:
     const productName = externalProduct.brands
       ? `${externalProduct.name} (${externalProduct.brands})`
       : externalProduct.name;

     // Still create local product copy for display name resolution (favorites, recents)
     const newProduct = await addProduct({
       name: productName,
       barcode: externalProduct.code,
       caloriesPer100g: externalProduct.caloriesPer100g,
       proteinPer100g: externalProduct.proteinPer100g,
       carbsPer100g: externalProduct.carbsPer100g,
       fatPer100g: externalProduct.fatPer100g,
       source: "catalog",
     });

     // Cache catalog portion info for meal type entries enrichment
     setCatalogPortionInfo(selectedPortion.id, {
       productName,
       baseAmount: selectedPortion.baseAmount,
       baseUnit: selectedPortion.baseUnit,
       calories: selectedPortion.calories,
       protein: selectedPortion.protein ?? 0,
       carbs: selectedPortion.carbs ?? 0,
       fat: selectedPortion.fat ?? 0,
     });

     const entryAmount = portionMode === "serving"
       ? qty * (selectedPortion.gramWeight ?? selectedPortion.baseAmount)
       : toGrams(wt, weightUnit);

     const entryUnit: Unit = "g";

     await saveMealToBackend(
       mealType,
       [{
         productId: newProduct.id,
         amount: entryAmount,
         unit: entryUnit,
         catalogPortionId: selectedPortion.id,  // NEW: pass catalog portion ID
       }],
       [newProduct],
     );
     ```
   - Action: Note: `selectedPortion.id` will be `"off-100g"` for synthesized portions (when catalogPortions are not available). Need to handle this: only use `catalogPortionId` when the portion has a real UUID (not the synthetic `"off-100g"` ID). Add a check:
     ```typescript
     const isRealCatalogPortion = selectedPortion.id !== "off-100g" &&
       !selectedPortion.id.startsWith("off-");
     ```
     Only set `catalogPortionId` when `isRealCatalogPortion` is true.
   - Why: This is the primary UX improvement -- 1 API call instead of 3-4
   - Dependencies: Steps 1-2, Phase 5
   - Risk: Medium -- the synthesized portion edge case needs careful handling
   - Test: Manual verification in app + existing tests

4. **Update `useFoodEntries` tests** (`client/src/hooks/useFoodEntries.test.tsx`)
   - Action: Add test: "creates catalog food entry with catalog_portion_id":
     - Create a MealItem with `catalogPortionId: "cat-portion-1"`
     - Assert `createFoodEntry` is called with `{ catalog_portion_id: "cat-portion-1", day, meal_type, amount, unit }` (no product_id/portion_id)
     - Assert `ensureProductInBackend` and `getOrCreateDefaultPortion` are NOT called
   - Action: Add test: "falls back to private path when no catalogPortionId":
     - Existing test coverage handles this, but add explicit assertion that catalog path is NOT taken
   - Why: Verify the branching logic
   - Dependencies: Steps 1, Phase 5 step 3 (helpers)
   - Risk: Low
   - Test: `pnpm test -- useFoodEntries`

5. **Update `useMealTypeEntries` tests** (`client/src/hooks/useMealTypeEntries.test.tsx`)
   - Action: Update local `makeFoodEntry` helper to include nullable fields (`catalogPortionId: null`)
   - Action: Add test: "enriches catalog entry from cache":
     - Set up `setCatalogPortionInfo` with known data
     - Create a food entry with `productId: null, portionId: null, catalogPortionId: "cat-1"`
     - Assert enriched entry has correct nutrition values from cache
   - Action: Add test: "returns null for catalog entry without cache and no matching product":
     - Catalog entry with no cache data and no product match should gracefully degrade
   - Why: Verify catalog enrichment path
   - Dependencies: Step 2
   - Risk: Low
   - Test: `pnpm test -- useMealTypeEntries`

Verification: `cd client && npx tsc --noEmit && pnpm test && pnpm run lint`

---

### Phase 7: EnrichedFoodEntry Type Update (Client)
Estimate: 1 file

This phase handles the type ripple effect from making `productId`/`portionId` nullable on `EnrichedFoodEntry`.

1. **Update `EnrichedFoodEntry` type** (`client/src/models/types.ts`)
   - Action: Change `productId: string` to `productId: string | null`
   - Action: Change `portionId: string` to `portionId: string | null`
   - Action: Add `catalogPortionId: string | null`
   - Action: Check all consumers of `EnrichedFoodEntry` (via grep) and ensure they handle null `productId`. Key consumers:
     - `useMealTypeEntries.ts` -- `enrichEntry` already handles this (Phase 6)
     - Any screen rendering enriched entries -- check for `entry.productId` usage without null check
   - Why: Type consistency between API response and enriched display type
   - Dependencies: Phase 5 (FoodEntry type is already nullable)
   - Risk: Medium -- may surface many type errors in consumers
   - Test: `npx tsc --noEmit`

Verification: `cd client && npx tsc --noEmit && pnpm test`

---

## Testing Strategy

### Backend Unit Tests
- `tests/services/test_food_entries_catalog_db.py` -- 7+ tests for catalog create/list/get/delete/update paths
- `tests/services/test_stats_catalog_db.py` -- 5+ tests for stats with catalog entries
- `tests/services/test_food_entries_db.py` -- existing 13 tests must still pass (regression)
- `tests/services/test_stats_db.py` -- existing 6 tests must still pass (regression)

### Backend API Tests
- `tests/api/test_food_entries_api.py` -- 6+ tests for HTTP-level contract validation
- `tests/api/test_sync_push.py` -- 1+ test for catalog_portion_id in sync push

### Client Unit Tests
- `client/src/hooks/useFoodEntries.test.tsx` -- 2+ new tests for catalog path
- `client/src/hooks/useMealTypeEntries.test.tsx` -- 2+ new tests for catalog enrichment

### Manual Verification
1. Scan a barcode for a catalog product -> confirm single API call in network tab
2. Check MyDay stats include the catalog-tracked entry
3. Track a user-created product -> confirm existing 3-call flow still works
4. Verify "My Products" does not show catalog copies differently than before

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Stats query returns wrong totals for catalog entries | High | Comprehensive test coverage (Phase 3 step 2); verify with mixed entries |
| Nullable `productId`/`portionId` breaks existing client code | Medium | Run `tsc --noEmit` after Phase 5 step 2 to surface all breaks immediately; fix in Phase 7 |
| Seed script UPSERT fails on existing data | Medium | Test with `--dry-run` first; add unique constraint to enable clean ON CONFLICT |
| `useMealTypeEntries` enrichment cache is volatile (clears on restart) | Medium | Acceptable for MVP; future backend enrichment (ADR "Future Enhancement") eliminates this |
| CHECK constraint blocks old clients | Low | Constraint is deferred (commented out) per ADR migration safety plan |
| `update_food_entry` with `portion_id` patch on catalog entry crashes | Medium | Add guard in `update_food_entry`: if entry has `catalog_portion_id`, skip `portion.product_id != entry.product_id` check (entry.product_id is None) |
| Synthesized `"off-100g"` portion ID sent as `catalog_portion_id` to backend | High | Guard in `ProductConfirmScreen`: only set `catalogPortionId` for real UUIDs |

## Open Questions

1. **Client enrichment strategy**: Should we implement the "Future Enhancement" from the ADR now (backend returns `resolved_product_name`, `resolved_portion_label`, `resolved_calories_per_base` on `FoodEntryResponse`) instead of the client-side cache approach? This would be cleaner but adds backend work to Phase 2.
   - **Recommendation**: Use the client-side cache for now (Phase 6 step 2) and implement backend enrichment as a follow-up. Keeps this ADR focused.

2. **Unique constraint on `catalog_portions`**: Should we add `UNIQUE(catalog_product_id, label, base_unit)` to enable clean UPSERT in seed scripts?
   - **Recommendation**: Yes. It's semantically correct and simplifies seed scripts significantly.

3. **`update_food_entry` for catalog entries**: When updating a catalog entry's portion (changing from one catalog portion to another, or from catalog to private), what's the expected behavior? The current `update_food_entry` validates `portion.product_id != entry.product_id` which won't work for catalog entries.
   - **Recommendation**: For MVP, catalog entries can only update `amount` and `unit` (not `portion_id` or `catalog_portion_id`). Portion changes require delete + re-create. Add a guard to reject `portion_id` patches on catalog entries.
