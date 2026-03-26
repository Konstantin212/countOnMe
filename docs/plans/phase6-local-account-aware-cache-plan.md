---
type: plan
status: draft
last-updated: 2026-03-26
related-features:
  - supabase-migration
  - offline-first
  - local-storage
---

# Implementation Plan: Phase 6 — Local Account-Aware Cache (SecureStore + expo-sqlite)

## Overview

Migrate all syncable domain data from AsyncStorage (JSON key-value) to expo-sqlite (relational, transactional, indexed). Create a repository abstraction layer between hooks and storage. Keep AsyncStorage for preferences and ephemeral state only. Include a one-time migration that runs on app upgrade. This is a client-only change.

## Success Criteria

- [ ] expo-sqlite installed and database opens on app launch
- [ ] SQLite schema matches ADR-009 (9 tables + indexes)
- [ ] Repository layer provides typed CRUD for each entity, with `db` parameter for DI
- [ ] All hooks (useProducts, useMeals, useGoal, useBodyWeight, useWaterTracking) read/write through repositories instead of storage.ts
- [ ] Outbox moved from AsyncStorage to SQLite `sync_outbox` table
- [ ] Sync cursor moved from AsyncStorage to SQLite `sync_cursors` table
- [ ] Favourites and recents moved to SQLite tables
- [ ] syncEngine.ts uses repositories instead of storage.ts functions
- [ ] One-time migration reads AsyncStorage data and inserts into SQLite
- [ ] AsyncStorage keys for migrated data are deleted after successful migration
- [ ] Theme, draft meal, and device ID remain in AsyncStorage (unchanged)
- [ ] All existing tests pass (or are updated to mock the new repository layer)
- [ ] New repository tests run against in-memory SQLite
- [ ] Type check passes (`tsc --noEmit`)
- [ ] Lint passes

## Assumptions

- ADR-009 schema is the source of truth for SQLite table definitions — validated by reading `docs/architecture/adr-009-local-storage-strategy.md`
- `expo-sqlite` is NOT currently installed — validated by reading `package.json` (only `expo-secure-store` is present)
- Expo Go is already NOT used (barcode scanner requires dev build) — ADR-009 notes this, reducing risk of the native module
- `user_id` for SQLite rows will come from the Supabase auth session (Phase 1 complete) — needs confirmation on how to get the current user ID from the client auth context
- All hooks currently import from `@storage/storage` and `@storage/outbox` — validated by grep
- Screens that import directly from `@storage/storage`: SelectProduct (favourites/recents), AddFood (pushProductRecent), ProductConfirmScreen (favourites/recents), ProductFormScreen (favourites), ProfileScreen (clearAllFoodData) — these must be updated too
- `useMealTypeEntries` and `useFoodEntries` do NOT use local storage — they talk to the backend API directly — validated by reading hook source
- `useDayStats` and `useStatsRange` do NOT use local storage — they talk to the backend API directly
- The sync outbox format in SQLite (`sync_outbox` table) is compatible with the current `OutboxEntry` type from `outbox.ts` — validated by comparing fields

## Architecture Changes

Per ADR-009, the storage architecture changes from:

```
hooks → storage.ts (AsyncStorage)
hooks → outbox.ts (AsyncStorage)
syncEngine → storage.ts + outbox.ts
```

To:

```
hooks → repositories (SQLite)
syncEngine → repositories (SQLite)
AsyncStorage: theme, draft meal, device ID only
SecureStore: Supabase tokens (already done in Phase 1)
```

## Files Affected

### New Files

1. `client/src/storage/database.ts` — SQLite database initialization, schema DDL, PRAGMA user_version migration
2. `client/src/storage/database.test.ts` — Tests for DB init and schema versioning
3. `client/src/storage/repositories/productRepository.ts` — Product CRUD + dirty tracking
4. `client/src/storage/repositories/productRepository.test.ts` — Tests with in-memory DB
5. `client/src/storage/repositories/mealRepository.ts` — Meal + MealItem CRUD (meals table with JSON items column, matching current Meal type)
6. `client/src/storage/repositories/mealRepository.test.ts`
7. `client/src/storage/repositories/goalRepository.ts` — UserGoal CRUD (single active goal)
8. `client/src/storage/repositories/goalRepository.test.ts`
9. `client/src/storage/repositories/bodyWeightRepository.ts` — BodyWeightEntry CRUD
10. `client/src/storage/repositories/bodyWeightRepository.test.ts`
11. `client/src/storage/repositories/waterLogRepository.ts` — WaterLog CRUD
12. `client/src/storage/repositories/waterLogRepository.test.ts`
13. `client/src/storage/repositories/outboxRepository.ts` — sync_outbox CRUD (replaces outbox.ts)
14. `client/src/storage/repositories/outboxRepository.test.ts`
15. `client/src/storage/repositories/syncCursorRepository.ts` — sync_cursors CRUD
16. `client/src/storage/repositories/syncCursorRepository.test.ts`
17. `client/src/storage/repositories/favouriteRepository.ts` — Favourites with position
18. `client/src/storage/repositories/favouriteRepository.test.ts`
19. `client/src/storage/repositories/recentRepository.ts` — Recents (client-only, not synced)
20. `client/src/storage/repositories/recentRepository.test.ts`
21. `client/src/storage/repositories/index.ts` — Barrel export for all repositories
22. `client/src/storage/migrate.ts` — One-time AsyncStorage-to-SQLite migration logic
23. `client/src/storage/migrate.test.ts` — Migration tests
24. `client/src/storage/DatabaseProvider.tsx` — React context providing the SQLite db instance to the tree

### Modified Files

1. `client/package.json` — Add `expo-sqlite` dependency
2. `client/src/hooks/useProducts.ts` — Import from repositories instead of storage.ts
3. `client/src/hooks/useMeals.ts` — Import from repositories instead of storage.ts
4. `client/src/hooks/useGoal.ts` — Import from repositories instead of storage.ts
5. `client/src/hooks/useBodyWeight.ts` — Import from repositories instead of storage.ts
6. `client/src/hooks/useWaterTracking.ts` — Import from repositories instead of storage.ts
7. `client/src/services/syncEngine.ts` — Import from repositories instead of storage.ts and outbox.ts
8. `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx` — Use favourite/recent repositories
9. `client/src/screens/AddMealFlow/components/AddFood/index.tsx` — Use recent repository
10. `client/src/screens/ProductFlow/ProductConfirmScreen.tsx` — Use favourite/recent repositories
11. `client/src/screens/ProductFlow/ProductFormScreen.tsx` — Use favourite repository
12. `client/src/screens/ProfileScreen.tsx` — `clearAllFoodData` moves to repository layer
13. `client/src/app/AppNavigator.tsx` — Wrap tree in DatabaseProvider
14. `client/src/storage/outbox.ts` — Deprecated (replaced by outboxRepository), but kept during transition
15. `client/src/test/setup.ts` — Add global mock for expo-sqlite
16. `client/vitest.config.ts` — Possibly add alias for expo-sqlite mock

### Files That Stay Unchanged

- `client/src/storage/storage.ts` — Theme, draft meal, and sync cursor functions stay (but product/meal/goal/weight/water functions become dead code and can be removed after migration is verified)
- `client/src/storage/device.ts` — Device ID stays in AsyncStorage
- `client/src/screens/AddMealFlow/context.tsx` — Draft meal stays in AsyncStorage
- `client/src/theme/ThemeContext.tsx` — Theme stays in AsyncStorage
- `client/src/hooks/useFoodEntries.ts` — No local storage, talks to API directly
- `client/src/hooks/useMealTypeEntries.ts` — No local storage, talks to API directly
- `client/src/hooks/useDayStats.ts` — No local storage
- `client/src/hooks/useStatsRange.ts` — No local storage

## Implementation Steps

### Phase 1: Database Foundation (6 new files)

**Goal**: Install expo-sqlite, create the database initialization module, and establish the testing pattern for repositories.

1. **Install expo-sqlite** (`client/package.json`)
   - Action: Run `cd client && pnpm add expo-sqlite`
   - Why: First-party Expo SQLite module required by ADR-009
   - Dependencies: None
   - Risk: Low — Expo 54 has first-class support for expo-sqlite
   - Test: `pnpm run type-check` passes

2. **Add expo-sqlite mock to test setup** (`client/src/test/setup.ts`)
   - Action: Add a `vi.mock("expo-sqlite", ...)` block that exports a factory creating an in-memory SQLite-like mock. The mock must provide `openDatabaseAsync`, `execAsync`, `getFirstAsync`, `getAllAsync`, `runAsync` methods. Use a simple Map-based stub since we will use real in-memory SQLite in repository tests (via a test helper), and only need this global mock to prevent import failures in hook tests.
   - Why: Tests that import hooks (which import repositories, which import expo-sqlite) need a valid mock at the module level
   - Dependencies: Step 1
   - Risk: Medium — The mock API must match expo-sqlite's actual interface. Consult expo-sqlite docs for the `SQLiteDatabase` interface.
   - Test: Existing tests still pass with the new mock in place

3. **Create database initialization** (`client/src/storage/database.ts`)
   - Action: Create module that exports:
     - `SCHEMA_V1: string` — All CREATE TABLE + CREATE INDEX SQL from ADR-009
     - `initDatabase(db: SQLiteDatabase): Promise<void>` — Checks `PRAGMA user_version`, runs schema if < 1, sets version
     - `openAppDatabase(): Promise<SQLiteDatabase>` — Opens `countOnMe.db` and calls initDatabase
   - Why: Single source of truth for schema creation and versioning
   - Dependencies: Step 1
   - Risk: Medium — SQLite DDL syntax must be exact. Test with in-memory DB.
   - Test: Unit test opens in-memory DB, runs initDatabase, verifies tables exist via `SELECT name FROM sqlite_master WHERE type='table'`

4. **Create database.test.ts** (`client/src/storage/database.test.ts`)
   - Action: Test initDatabase creates all 9 tables (products, product_portions, food_entries, user_goals, body_weights, water_logs, favourites, recents, sync_outbox, sync_cursors — 10 tables total). Test PRAGMA user_version is set. Test idempotency (calling initDatabase twice does not error).
   - Why: Schema is the foundation — must be verified before building repositories on top
   - Dependencies: Step 3
   - Risk: Low
   - Test: `cd client && pnpm test -- database.test.ts`

5. **Create DatabaseProvider** (`client/src/storage/DatabaseProvider.tsx`)
   - Action: Create a React context + provider that:
     - Opens the database on mount (via `openAppDatabase()`)
     - Runs migration check (Phase 4)
     - Exposes `db` via `useDatabaseContext()` hook
     - Shows a loading state while DB initializes
   - Why: Repositories need the db instance. Context avoids prop drilling.
   - Dependencies: Step 3
   - Risk: Low — Standard React context pattern
   - Test: Render provider, verify context value is non-null after init

Verification: `cd client && pnpm run type-check && pnpm test`

---

### Phase 2: Core Repositories (14 new files)

**Goal**: Create repository modules for each entity. Each repository is a set of pure functions that accept a `db: SQLiteDatabase` parameter (dependency injection for testability). All repositories tested with in-memory SQLite.

**Test helper** (create first):

6. **Create test helper for in-memory DB** (`client/src/test/dbHelper.ts`)
   - Action: Export `createTestDb(): Promise<SQLiteDatabase>` that opens `:memory:` and runs `initDatabase`. Each test file calls this in `beforeEach`.
   - Why: Every repository test needs an isolated in-memory database
   - Dependencies: Phase 1
   - Risk: Low

**Note on expo-sqlite in tests**: expo-sqlite is a native module. In vitest/jsdom, it cannot actually run. There are two approaches:
- **Option A**: Mock expo-sqlite at the vitest level and test repositories with the mock (less valuable — tests exercise mock, not real SQL).
- **Option B**: Use `better-sqlite3` (Node.js native SQLite binding) as a test-only substitute. It provides the same SQL engine but runs in Node.js without React Native. Repository functions would need to accept an interface (not the concrete expo-sqlite type).

**Recommended approach**: Define a `Database` interface in `database.ts` with the methods repositories use (`getAllAsync`, `getFirstAsync`, `runAsync`, `execAsync`). In production, expo-sqlite satisfies this interface. In tests, use `better-sqlite3` wrapped to match the interface. This gives real SQL execution in tests.

This is an **Open Question** — see below.

7. **Create product repository** (`client/src/storage/repositories/productRepository.ts`)
   - Action: Export object with methods:
     - `findAll(db, userId): Promise<Product[]>` — SELECT WHERE user_id = ? AND deleted_at IS NULL
     - `findById(db, id): Promise<Product | null>`
     - `upsert(db, userId, product): Promise<void>` — INSERT OR REPLACE, set is_dirty=1
     - `markDeleted(db, id): Promise<void>` — UPDATE SET deleted_at, is_dirty=1
     - `findDirty(db): Promise<Product[]>` — WHERE is_dirty=1
     - `clearDirty(db, ids): Promise<void>` — SET is_dirty=0 WHERE id IN (...)
     - `deleteAll(db, userId): Promise<void>` — For "clear all data"
   - Why: Replaces loadProducts/saveProducts from storage.ts
   - Dependencies: Step 6
   - Risk: Medium — Must correctly map between Product (camelCase) and SQLite columns (snake_case). The `allowed_units` column stores a JSON array as TEXT.
   - Test: CRUD cycle test, findDirty returns only dirty rows, markDeleted soft-deletes

8. **Create meal repository** (`client/src/storage/repositories/mealRepository.ts`)
   - Action: Since the `Meal` type has an `items: MealItem[]` field (array of objects), the meals table will store items as a JSON TEXT column (matching the current AsyncStorage approach). This avoids a junction table for a type that is NOT synced to the backend (meals are local-only; food_entries are backend-synced).
   - Methods: `findAll(db, userId)`, `findById(db, id)`, `upsert(db, userId, meal)`, `remove(db, id)`, `deleteAll(db, userId)`
   - Note: Meals do NOT have `is_dirty` or sync metadata because they are local-only (useMeals has no outbox/sync logic). Use a simpler schema: `id, user_id, name, meal_type, items (JSON), total_calories, created_at, updated_at`.
   - Why: Replaces loadMeals/saveMeals
   - Dependencies: Step 6
   - Risk: Low — Simple CRUD with JSON items column
   - Test: Insert meal with items, read back, verify items are deserialized correctly

   **Schema deviation from ADR-009**: ADR-009 does not include a `meals` table because meals are local-only (not synced). We need to add one. The existing `food_entries` table in ADR-009 is for backend-synced food entries (from `useFoodEntries`), which is a different concept. Meals (from `useMeals`) are local meal records with embedded items.

9. **Create goal repository** (`client/src/storage/repositories/goalRepository.ts`)
   - Methods: `getCurrent(db, userId)`, `upsert(db, userId, goal)`, `remove(db, id)`, `findDirty(db)`, `clearDirty(db, ids)`, `deleteAll(db, userId)`
   - Why: Replaces loadGoal/saveGoal/clearGoal
   - Dependencies: Step 6
   - Risk: Low — Single-row semantics (one active goal per user)
   - Test: Upsert overwrites previous goal, getCurrent returns latest

10. **Create body weight repository** (`client/src/storage/repositories/bodyWeightRepository.ts`)
    - Methods: `findAll(db, userId)`, `findByDay(db, userId, day)`, `upsert(db, userId, entry)`, `markDeleted(db, id)`, `findDirty(db)`, `clearDirty(db, ids)`, `deleteAll(db, userId)`
    - Why: Replaces loadBodyWeights/saveBodyWeights
    - Dependencies: Step 6
    - Risk: Low
    - Test: Insert, update, soft delete, query by day

11. **Create water log repository** (`client/src/storage/repositories/waterLogRepository.ts`)
    - Methods: `findAll(db, userId)`, `findByDay(db, userId, day)`, `upsert(db, userId, log)`, `markDeleted(db, id)`, `findDirty(db)`, `clearDirty(db, ids)`, `deleteAll(db, userId)`
    - Why: Replaces loadWaterLogs/saveWaterLogs
    - Dependencies: Step 6
    - Risk: Low
    - Test: Insert, query by day

12. **Create outbox repository** (`client/src/storage/repositories/outboxRepository.ts`)
    - Methods: `enqueue(db, entry)` (dedup by entity_type+entity_id), `loadAll(db)` (sorted by created_at), `remove(db, ids)`, `markFailed(db, id, error)`, `clear(db)`, `count(db)`
    - Why: Replaces outbox.ts AsyncStorage implementation
    - Dependencies: Step 6
    - Risk: Low — Direct mapping from OutboxEntry fields to sync_outbox columns
    - Test: Enqueue, dedup, load sorted, remove, markFailed increments attempts

13. **Create sync cursor repository** (`client/src/storage/repositories/syncCursorRepository.ts`)
    - Methods: `getCursor(db, entityType)`, `setCursor(db, entityType, version, syncedAt)`
    - Note: ADR-009 schema uses `last_server_updated_at` as a TEXT timestamp. Current code uses a single numeric cursor (`loadSyncCursor` returns a number). The sync engine currently uses a single cursor for all entity types. Decide: keep a single "global" cursor (entity_type = 'global') or split per entity type. Current sync engine uses one cursor for the unified `/sync/pull` endpoint, so keep a single entry with entity_type = 'all'.
    - Why: Replaces loadSyncCursor/saveSyncCursor in storage.ts
    - Dependencies: Step 6
    - Risk: Low
    - Test: Set cursor, read it back

14. **Create favourite repository** (`client/src/storage/repositories/favouriteRepository.ts`)
    - Methods: `getAll(db, userId)` (returns product IDs ordered by position), `set(db, userId, productId, position)`, `remove(db, userId, productId)`, `isFavourite(db, userId, productId)`, `toggle(db, userId, productId)`, `deleteAll(db, userId)`
    - Why: Replaces loadProductFavourites/saveProductFavourites
    - Dependencies: Step 6
    - Risk: Low
    - Test: Add favourite, check position ordering, toggle removes then adds

15. **Create recent repository** (`client/src/storage/repositories/recentRepository.ts`)
    - Methods: `getAll(db, limit?)` (ordered by last_used_at DESC), `push(db, productId)` (upsert with current timestamp, evict beyond 50), `deleteAll(db)`
    - Note: No user_id column (recents are client-only per ADR-009 schema)
    - Why: Replaces loadProductRecents/saveProductRecents/pushProductRecent
    - Dependencies: Step 6
    - Risk: Low
    - Test: Push 3 items, verify order is newest-first; push existing item moves it to front

16. **Create barrel export** (`client/src/storage/repositories/index.ts`)
    - Action: Re-export all repository modules
    - Dependencies: Steps 7-15

Verification: `cd client && pnpm run type-check && pnpm test`

---

### Phase 3: Migration Module (2 new files)

**Goal**: One-time migration from AsyncStorage to SQLite, run on app upgrade.

17. **Create migration module** (`client/src/storage/migrate.ts`)
    - Action: Export `migrateAsyncStorageToSqlite(db: SQLiteDatabase, userId: string): Promise<void>` that:
      1. Checks `migration:complete` flag in AsyncStorage — skip if already done
      2. Reads all AsyncStorage domain keys (products/v2, meals/v2, goal/v1, body-weights/v1, water-logs/v1, products-favourites/v1, products-recents/v1, outbox/v1, sync-cursor/v1)
      3. Falls back to v1 keys for products/meals (using existing migration functions from storage.ts)
      4. Wraps all SQLite inserts in a single transaction (`db.withTransactionAsync`)
      5. Inserts products, meals (new meals table), goal, body weights, water logs, favourites (with position), recents (with timestamps), outbox entries, sync cursor
      6. Sets all rows `is_dirty = 1`, `server_updated_at = NULL` (to force re-sync)
      7. On success: sets `@countOnMe/migration:complete` in AsyncStorage, then removes migrated AsyncStorage keys
      8. On failure: transaction rolls back, does not set flag, app retries on next launch
    - Why: Users upgrading from AsyncStorage to SQLite must not lose data
    - Dependencies: Phase 2 (repositories exist)
    - Risk: High — This is the most critical and error-prone step. Must handle:
      - Empty AsyncStorage (fresh install — no migration needed)
      - Malformed JSON in AsyncStorage keys (skip bad rows, log warnings)
      - Legacy v1 product/meal format (reuse existing migration functions)
      - Products without `source` field (existing patchProductSource logic)
    - Test: See step 18

18. **Create migration tests** (`client/src/storage/migrate.test.ts`)
    - Action: Test cases:
      1. Fresh install (no AsyncStorage data) — sets flag, no SQL inserts
      2. Products (v2 format) migrated correctly
      3. Products (v1 format) migrated through V1-to-V2 conversion
      4. Meals migrated with JSON items
      5. Goal migrated as single row
      6. Body weights migrated
      7. Water logs migrated
      8. Favourites migrated with position 0..N
      9. Recents migrated with timestamps
      10. Outbox entries migrated
      11. Sync cursor migrated
      12. Malformed JSON in one key does not abort migration of other keys
      13. Already-migrated flag prevents re-migration
      14. AsyncStorage keys are deleted after successful migration
    - Dependencies: Step 17
    - Risk: Medium — Test setup must mock AsyncStorage with specific data
    - Test: `cd client && pnpm test -- migrate.test.ts`

Verification: `cd client && pnpm run type-check && pnpm test`

---

### Phase 4: Wire Hooks to Repositories (7 modified files)

**Goal**: Change all hooks to use the new repository layer instead of AsyncStorage functions. The hooks will get the `db` instance from the DatabaseProvider context.

**Pattern change**: Each hook currently imports `loadX`/`saveX` from `@storage/storage`. After this phase, they will:
1. Get `db` from `useDatabaseContext()` (from DatabaseProvider)
2. Call repository functions like `productRepository.findAll(db, userId)`
3. Get `userId` from the auth context (Supabase session)

This introduces two new dependencies for hooks: `db` (from DatabaseProvider) and `userId` (from auth context). Both are available via React context.

**Alternative for userId**: Instead of requiring auth context in every hook, the DatabaseProvider could accept `userId` as a prop and embed it in the context alongside `db`. Hooks then get both from the same context. This keeps hooks simpler.

19. **Update DatabaseProvider to include userId** (`client/src/storage/DatabaseProvider.tsx`)
    - Action: Accept `userId` prop (from auth context in AppNavigator). Export `useDatabaseContext()` returning `{ db, userId }`.
    - Why: Repositories need userId for all queries; centralizing it avoids repeating auth context access in every hook
    - Dependencies: Phase 1 Step 5
    - Risk: Low

20. **Update useProducts hook** (`client/src/hooks/useProducts.ts`)
    - Action:
      - Remove imports of `loadProducts`, `saveProducts` from `@storage/storage`
      - Add import of `useDatabaseContext` from `@storage/DatabaseProvider`
      - Add import of `productRepository` from `@storage/repositories`
      - In the hook body: `const { db, userId } = useDatabaseContext()`
      - Replace `loadProducts()` with `productRepository.findAll(db, userId)`
      - Replace `saveProducts(next)` in `applyChanges` with `productRepository.upsert(db, userId, changedProduct)` (upsert individual product, not rewrite entire collection)
      - Replace delete with `productRepository.markDeleted(db, id)`
    - Why: Core migration from AsyncStorage to SQLite
    - Dependencies: Phase 2 Step 7, Phase 4 Step 19
    - Risk: Medium — The `applyChanges` pattern currently replaces the entire array. With SQLite, we upsert/delete individual rows. This changes the internal flow but preserves the external hook API.
    - Test: Update `useProducts.test.tsx` to mock repository module instead of storage module

21. **Update useMeals hook** (`client/src/hooks/useMeals.ts`)
    - Action: Same pattern as step 20 but with `mealRepository`
    - Dependencies: Phase 2 Step 8, Phase 4 Step 19
    - Risk: Low — Meals are simpler (no outbox, no sync)
    - Test: Update `useMeals.test.tsx`

22. **Update useGoal hook** (`client/src/hooks/useGoal.ts`)
    - Action: Same pattern. Replace `loadGoal`/`saveGoal`/`clearGoal` with `goalRepository` methods.
    - Dependencies: Phase 2 Step 9, Phase 4 Step 19
    - Risk: Low
    - Test: Update `useGoal.test.tsx`

23. **Update useBodyWeight hook** (`client/src/hooks/useBodyWeight.ts`)
    - Action: Same pattern. Replace `loadBodyWeights`/`saveBodyWeights` with `bodyWeightRepository` methods.
    - Dependencies: Phase 2 Step 10, Phase 4 Step 19
    - Risk: Low
    - Test: Update `useBodyWeight.test.tsx`

24. **Update useWaterTracking hook** (`client/src/hooks/useWaterTracking.ts`)
    - Action: Same pattern. Replace `loadWaterLogs`/`saveWaterLogs` with `waterLogRepository` methods.
    - Dependencies: Phase 2 Step 11, Phase 4 Step 19
    - Risk: Low
    - Test: Update `useWaterTracking.test.tsx`

25. **Update outbox imports in hooks**
    - Action: In `useProducts.ts`, `useGoal.ts`, `useBodyWeight.ts`, `useWaterTracking.ts` — replace `import { enqueueOutbox } from "@storage/outbox"` with `import { outboxRepository } from "@storage/repositories"` and call `outboxRepository.enqueue(db, ...)`.
    - Dependencies: Phase 2 Step 12, Phase 4 Step 19
    - Risk: Low — 1:1 replacement
    - Test: Existing hook tests verify outbox enqueue is called

Verification: `cd client && pnpm run type-check && pnpm test`

---

### Phase 5: Wire SyncEngine and Screens (6 modified files)

**Goal**: Update the sync engine and screen components that directly access storage.

26. **Update syncEngine.ts** (`client/src/services/syncEngine.ts`)
    - Action:
      - The sync engine is a module-level singleton (not a React component), so it cannot use React context. It needs the `db` instance passed in.
      - Change exported functions (`pull`, `push`, `sync`) to accept a `db` parameter, OR create a `setDatabase(db)` init function that the DatabaseProvider calls on mount.
      - Recommended: `setDatabase(db: SQLiteDatabase)` stored in module scope. The DatabaseProvider calls `setDatabase(db)` after opening. `sync()` uses the stored reference.
      - Replace all `loadProducts`/`saveProducts`/etc. calls in merge functions with repository calls.
      - Replace `loadOutbox`/`removeFromOutbox`/`markFailed` with `outboxRepository` equivalents.
      - Replace `loadSyncCursor`/`saveSyncCursor` with `syncCursorRepository` equivalents.
      - Remove the `migrateLegacyQueue` function (legacy syncQueue migration is now handled by the AsyncStorage-to-SQLite migration in Phase 3).
    - Why: The sync engine is the heaviest consumer of storage functions
    - Dependencies: Phase 2, Phase 4 Step 19
    - Risk: High — The sync engine is complex. Must be updated carefully. The merge functions (mergeProducts, mergeBodyWeights, mergeGoals, mergeWaterLogs) currently load/save entire collections. With SQLite, they upsert individual rows (much more efficient).
    - Test: `syncEngine.test.ts` (if it exists — currently it does not; create basic tests)

27. **Update SelectProduct screen** (`client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`)
    - Action: Replace `loadProductFavourites`, `loadProductRecents`, `saveProductFavourites` imports from `@storage/storage` with `favouriteRepository` and `recentRepository` from `@storage/repositories`. Get `db` and `userId` from `useDatabaseContext()`.
    - Dependencies: Phase 2 Steps 14-15, Phase 4 Step 19
    - Risk: Low — Direct replacement
    - Test: Manual verification (screen loads favourites and recents correctly)

28. **Update AddFood screen** (`client/src/screens/AddMealFlow/components/AddFood/index.tsx`)
    - Action: Replace `pushProductRecent` import with `recentRepository.push(db, productId)`.
    - Dependencies: Phase 2 Step 15, Phase 4 Step 19
    - Risk: Low
    - Test: Manual verification

29. **Update ProductConfirmScreen** (`client/src/screens/ProductFlow/ProductConfirmScreen.tsx`)
    - Action: Replace favourites/recents storage imports with repository calls.
    - Dependencies: Phase 2 Steps 14-15, Phase 4 Step 19
    - Risk: Low
    - Test: Manual verification

30. **Update ProductFormScreen** (`client/src/screens/ProductFlow/ProductFormScreen.tsx`)
    - Action: Replace `loadProductFavourites`/`saveProductFavourites` with `favouriteRepository`.
    - Dependencies: Phase 2 Step 14, Phase 4 Step 19
    - Risk: Low
    - Test: Manual verification

31. **Update ProfileScreen** (`client/src/screens/ProfileScreen.tsx`)
    - Action: Replace `clearAllFoodData` import from `@storage/storage` with a new function that clears all SQLite tables for the current user. This could be a method on a "data management" service or a function in database.ts: `clearAllUserData(db, userId)`.
    - Dependencies: Phase 2 (all repos have `deleteAll`), Phase 4 Step 19
    - Risk: Low
    - Test: Manual verification

Verification: `cd client && pnpm run type-check && pnpm test`

---

### Phase 6: App Startup Integration (2 modified files)

**Goal**: Wire everything together in the app startup flow.

32. **Wrap app tree in DatabaseProvider** (`client/src/app/AppNavigator.tsx`)
    - Action:
      - Import `DatabaseProvider` from `@storage/DatabaseProvider`
      - Get current userId from auth context (Supabase session)
      - Wrap the navigation tree inside `<DatabaseProvider userId={userId}>`
      - The provider handles: open DB → run migration → expose db to tree
      - Show a loading/splash screen while DB initializes + migration runs
    - Dependencies: All previous phases
    - Risk: Medium — Must not break existing navigation or DraftMealProvider wrapping
    - Test: App launches, migration runs, data is accessible

33. **Initialize sync engine DB reference** (`client/src/storage/DatabaseProvider.tsx`)
    - Action: After opening the DB, call `syncEngine.setDatabase(db)` so the sync engine can access the SQLite database without React context.
    - Dependencies: Phase 5 Step 26
    - Risk: Low
    - Test: Sync works after app launch

Verification: `cd client && pnpm run verify`

---

### Phase 7: Cleanup (3 files)

**Goal**: Remove dead code from the AsyncStorage era.

34. **Remove migrated functions from storage.ts** (`client/src/storage/storage.ts`)
    - Action: Remove `loadProducts`, `saveProducts`, `loadMeals`, `saveMeals`, `loadGoal`, `saveGoal`, `clearGoal`, `loadBodyWeights`, `saveBodyWeights`, `loadWaterLogs`, `saveWaterLogs`, `loadProductFavourites`, `saveProductFavourites`, `loadProductRecents`, `saveProductRecents`, `pushProductRecent`, `loadSyncCursor`, `saveSyncCursor`, `clearAllFoodData`, and all V1-to-V2 migration functions. Keep: `loadThemePreference`, `saveThemePreference`, `loadDraftMeal`, `saveDraftMeal`, `clearDraftMeal`, and STORAGE_KEYS for theme/draft-meal only.
    - Why: Dead code removal after migration
    - Dependencies: All hooks and screens are updated (Phases 4-6)
    - Risk: Medium — Must verify no remaining imports reference removed functions
    - Test: Grep for removed function names; type check passes

35. **Deprecate outbox.ts** (`client/src/storage/outbox.ts`)
    - Action: Remove file entirely. All consumers now use `outboxRepository`.
    - Dependencies: Phase 4 Step 25, Phase 5 Step 26
    - Risk: Low — Grep confirms no remaining imports
    - Test: Type check passes

36. **Update storage.test.ts** (`client/src/storage/storage.test.ts`)
    - Action: Remove tests for functions that no longer exist. Keep tests for theme and draft meal.
    - Dependencies: Step 34
    - Risk: Low
    - Test: `pnpm test` passes

Verification: `cd client && pnpm run verify`

## Testing Strategy

### Unit Tests (Repository Layer)
- Each repository gets its own test file (8 test files total)
- Tests use in-memory SQLite (via `better-sqlite3` or expo-sqlite mock — see Open Questions)
- Test CRUD operations, dirty tracking, soft deletes, constraint violations
- Location: Co-located with source (e.g., `productRepository.test.ts` next to `productRepository.ts`)

### Unit Tests (Migration)
- `migrate.test.ts` tests the full migration path with mocked AsyncStorage data
- Tests both fresh install (no data) and upgrade (existing data) scenarios
- Tests malformed data handling (partial migration)

### Unit Tests (Hooks)
- Existing hook test files updated to mock the repository layer instead of storage.ts
- The mock pattern changes from `vi.mock("../storage/storage", ...)` to `vi.mock("../storage/repositories", ...)` and `vi.mock("../storage/DatabaseProvider", ...)`
- Hook test coverage should remain at current levels or improve

### Integration Tests
- Sync engine integration test: mock API, use in-memory SQLite, verify full pull/push cycle
- Migration integration test: seed AsyncStorage, run migration, verify all data in SQLite

### Manual Verification
- Install on device with existing AsyncStorage data
- Verify migration runs (progress screen appears briefly)
- Verify all data is present after migration
- Verify CRUD operations work (add product, log weight, etc.)
- Verify sync still works (outbox enqueue + flush)
- Verify theme and draft meal persist correctly (still in AsyncStorage)
- Verify "Clear all data" on Profile screen works

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| expo-sqlite not compatible with jsdom tests | High | Define a `Database` interface; use `better-sqlite3` as test double in Node.js. Alternatively, mock expo-sqlite entirely in tests and rely on manual/E2E testing for SQL correctness. |
| Migration fails on real device with malformed data | High | Per-row try/catch in migration; skip bad rows with warning log; do not abort entire migration for one bad record. Extensive test coverage with malformed inputs. |
| Breaking hook APIs during repository migration | Medium | Hook return types (`UseProductsResult`, etc.) do NOT change. Only internal implementation changes. Existing hook tests serve as regression safety net. |
| Sync engine crash after db reference change | Medium | The `setDatabase` approach means sync cannot run before DB is initialized. Add null check: if db not set, skip sync silently. |
| Large dataset migration takes too long | Low | SQLite transaction with batch inserts is fast (thousands of rows in <1s). Show progress screen as UX mitigation. |
| Schema drift from ADR-009 | Low | Meals table not in ADR-009 (local-only). Document the addition. All other tables match ADR-009 exactly. |
| userId not available for guest users | Medium | If user is not authenticated (guest mode from Phase 2), use a placeholder userId like `"guest"` or the device ID. The DatabaseProvider should handle this. |

## Open Questions

1. **Testing expo-sqlite in jsdom/vitest**: expo-sqlite is a native module that cannot run in Node.js. The recommended approach is to define a `Database` interface and use `better-sqlite3` (npm package, runs in Node.js) as a test substitute. This requires adding `better-sqlite3` as a dev dependency and creating a thin wrapper to match the expo-sqlite API. **Alternative**: mock expo-sqlite entirely and test SQL queries in E2E tests only. Which approach does the team prefer?

2. **userId source**: The plan assumes userId comes from the Supabase auth context. Where exactly is the current user ID available on the client? Is there an `useAuth()` hook or similar that exposes `user.id`? If guest mode (Phase 2) is active, what userId is used for SQLite rows?

3. **Meals table schema**: ADR-009 does not include a `meals` table because meals are local-only. The plan proposes adding a simple meals table (`id, user_id, name, meal_type, items JSON, total_calories, created_at, updated_at`). Is this acceptable, or should meals remain in AsyncStorage?

4. **Sync engine DB injection**: The plan proposes a `setDatabase(db)` module-level setter for the sync engine (since it's not a React component). Alternative: make the sync engine a class instance created by the DatabaseProvider. Which is preferred?

5. **Migration timing**: Should the migration run before or after the user authenticates? If before, we don't have a userId for SQLite rows. If after, the user sees a blank app until they authenticate and the migration runs. The plan assumes migration runs after authentication (userId available).

6. **product_portions and food_entries tables**: ADR-009 includes these tables, but they are currently backend-only (managed by `useFoodEntries` and `useMealTypeEntries` which talk directly to the API). Should Phase 6 create these tables (empty, for future local caching) or defer them? The plan currently includes them in the schema DDL (since ADR-009 specifies them) but does NOT create repositories for them — those would come in a future phase when food entries get offline support.
