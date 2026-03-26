---
type: plan
status: draft
last-updated: 2026-03-26
---

# Implementation Plan: Phase 5 — Rebuild Sync Around user_id with Delta-Based Multi-Device Support

## Overview

Replace the current per-entity sync queue (client) and cursor-based pull-only sync (backend) with a unified delta-based sync engine that supports multi-device usage. The backend gets a new `POST /v1/sync/push` endpoint and a rewritten `GET /v1/sync/pull` with paginated delta responses. The client gets a new sync engine that replaces `syncQueue.ts` with outbox + pull-then-push semantics. Water logs get a backend table and CRUD endpoints so they can participate in sync. All 6 entity types (products, portions, food_entries, body_weights, user_goals, water_logs) sync through one unified pipeline.

## Success Criteria

- [ ] Backend: `server_updated_at` (auto-set trigger) + `sync_version` (monotonic bigint) columns on all 6 syncable tables
- [ ] Backend: New `water_logs` table with CRUD endpoints (`GET/POST/PATCH/DELETE /v1/water-logs`)
- [ ] Backend: `GET /v1/sync/pull?since_version=0&limit=500` returns paginated deltas across all 6 entity types, ordered by sync_version, scoped to user_id
- [ ] Backend: `POST /v1/sync/push` accepts batch mutations with LWW (Last Writer Wins) conflict resolution using `updated_at` timestamps
- [ ] Client: New outbox module (`storage/outbox.ts`) replaces `syncQueue.ts`
- [ ] Client: New sync engine (`services/syncEngine.ts`) orchestrates pull-then-push
- [ ] Client: All entity hooks enqueue mutations to outbox instead of calling individual API endpoints
- [ ] Client: Automatic sync triggers (app foreground, network reconnect, periodic 5-min)
- [ ] Client: `useSyncStatus` hook exposes pull/push progress, last sync time, conflict count
- [ ] All existing tests pass; new tests cover sync pull, push, conflict resolution, water logs CRUD
- [ ] Water tracking works offline (same as other entities)

## Assumptions

- **Validated**: All 5 existing data tables already have `user_id`, `created_on_device_id`, `updated_on_device_id` columns (read from models)
- **Validated**: `get_owner_filter` uses `user_id` only (read `app/core/ownership.py`)
- **Validated**: No `sync_version` or `server_updated_at` columns exist yet (grep found nothing)
- **Validated**: Current sync has no tests (`backend/tests/*sync*` glob returned nothing)
- **Validated**: Water logs have no backend table (grep for "water" in `backend/app` only hit goal-related files)
- **Validated**: `useFoodEntries` and `useMealTypeEntries` do NOT use the sync queue — they call the API directly (read the hooks)
- **Validated**: `useMeals` is local-only (AsyncStorage, no sync queue, no API calls)
- **Validated**: Next migration number is `0015`
- **Assumption (needs confirmation)**: `useMeals` (legacy local meals) should NOT be included in sync — it will be deprecated in favor of food entries. If user wants meals in sync, that's a separate concern.
- **Assumption (needs confirmation)**: LWW conflict resolution uses `updated_at` from the client payload vs server's `updated_at`. Server wins on tie.
- **Assumption (needs confirmation)**: The periodic sync interval is 5 minutes. User may want a different default.
- **Assumption (needs confirmation)**: Water logs use a simple model: one row per add/remove event (matching current client `WaterLog` type), NOT a single aggregated row per day.

## Architecture Changes

### Backend

1. **New mixin**: `app/core/mixins.py` — Add `SyncMixin` with `server_updated_at` (server-set timestamp) and `sync_version` (monotonic bigint from a shared sequence)
2. **New migration 0015**: Add `server_updated_at` + `sync_version` columns to all 6 tables; create shared sequence `sync_version_seq`; create DB trigger to auto-set `server_updated_at` on INSERT/UPDATE
3. **New migration 0016**: Create `water_logs` table
4. **New feature module**: `app/features/water_logs/` — models, schemas, service, router
5. **Rewritten sync service**: `app/features/sync/service.py` — unified delta query across all 6 tables using `sync_version`
6. **Rewritten sync router**: `app/features/sync/router.py` — new `GET /pull` and `POST /push` endpoints
7. **New sync push service**: `app/features/sync/push_service.py` — batch upsert/delete with LWW

### Client

1. **New module**: `client/src/storage/outbox.ts` — AsyncStorage-backed outbox replacing `syncQueue.ts`
2. **New module**: `client/src/services/syncEngine.ts` — pull-then-push orchestrator
3. **New API service**: `client/src/services/api/sync.ts` — `pullDeltas()` and `pushMutations()` API calls
4. **New API service**: `client/src/services/api/waterLogs.ts` — water log CRUD (for direct API calls before sync is integrated)
5. **Modified hooks**: All hooks that currently call `enqueue()` will be updated to use the new outbox
6. **Modified hook**: `useWaterTracking` — add outbox enqueue for sync
7. **Rewritten hook**: `useSyncStatus` — expose new sync engine state
8. **New hook**: `useAutoSync` — AppState/NetInfo listeners for automatic sync triggers

## Files Affected

### New Files — Backend

- `backend/alembic/versions/0015_add_sync_columns.py` — Migration: sync_version_seq, sync_version + server_updated_at on all tables, trigger
- `backend/alembic/versions/0016_water_logs.py` — Migration: water_logs table
- `backend/app/features/water_logs/__init__.py`
- `backend/app/features/water_logs/models.py` — WaterLog ORM model
- `backend/app/features/water_logs/schemas.py` — Request/response schemas
- `backend/app/features/water_logs/service.py` — CRUD service
- `backend/app/features/water_logs/router.py` — CRUD router
- `backend/app/features/sync/push_service.py` — Batch push with LWW conflict resolution
- `backend/tests/api/test_sync_pull.py` — Pull endpoint integration tests
- `backend/tests/api/test_sync_push.py` — Push endpoint integration tests
- `backend/tests/api/test_water_logs.py` — Water logs CRUD tests
- `backend/tests/services/test_sync_service.py` — Sync service unit tests
- `backend/tests/services/test_water_logs_db.py` — Water logs service tests

### New Files — Client

- `client/src/storage/outbox.ts` — New outbox module
- `client/src/storage/outbox.test.ts` — Outbox tests
- `client/src/services/syncEngine.ts` — Sync engine orchestrator
- `client/src/services/syncEngine.test.ts` — Sync engine tests
- `client/src/services/api/sync.ts` — Sync API client
- `client/src/services/api/waterLogs.ts` — Water logs API client
- `client/src/hooks/useAutoSync.ts` — Auto-sync trigger hook
- `client/src/hooks/useAutoSync.test.ts` — Auto-sync tests

### Modified Files — Backend

- `backend/app/core/mixins.py` — Add SyncMixin
- `backend/app/features/sync/router.py` — Rewrite: `/pull` + `/push` endpoints (replace `/since`)
- `backend/app/features/sync/service.py` — Rewrite: unified delta query using sync_version
- `backend/app/features/sync/schemas.py` — Rewrite: new request/response schemas for pull/push
- `backend/app/main.py` — Register water_logs router
- `backend/tests/conftest.py` — Import WaterLog model for table creation

### Modified Files — Client

- `client/src/storage/syncQueue.ts` — Deprecate (keep temporarily for migration, then delete)
- `client/src/hooks/useSyncStatus.ts` — Rewrite to use new sync engine
- `client/src/hooks/useProducts.ts` — Switch from `enqueue` to new outbox
- `client/src/hooks/useGoal.ts` — Switch from `enqueue` to new outbox
- `client/src/hooks/useBodyWeight.ts` — Switch from `enqueue` to new outbox
- `client/src/hooks/useWaterTracking.ts` — Add outbox enqueue for sync
- `client/src/models/types.ts` — Add `updatedAt` to `WaterLog` type (needed for LWW)
- `client/src/storage/storage.ts` — Add `syncCursor` storage key

## Implementation Steps

### Phase 1: Backend — Sync Infrastructure (Migration + Mixin)

Estimate: 4 files

1. **Add SyncMixin** (`backend/app/core/mixins.py`)
   - Action: Add a `SyncMixin` class with two columns: `server_updated_at` (DateTime, server-set, not null, default now()) and `sync_version` (BigInteger, not null, auto-assigned from sequence). Do NOT add these to `TimestampMixin` — they're separate concerns. Models that participate in sync will inherit both.
   - Why: `sync_version` is a monotonically increasing integer that enables efficient delta pagination. `server_updated_at` provides a server-authoritative timestamp distinct from the client-settable `updated_at`.
   - Dependencies: None
   - Risk: Low
   - Test: Verify mixin columns exist in the model metadata

2. **Add SyncMixin to all 6 syncable models** (6 model files)
   - Action: Add `SyncMixin` as a base class to `Product`, `ProductPortion`, `FoodEntry`, `BodyWeight`, `UserGoal`. The new `WaterLog` model (Phase 2) will also include it.
   - Files: `products/models.py`, `portions/models.py`, `meals/models.py`, `weights/models.py`, `goals/models.py`
   - Why: All syncable tables need these columns
   - Dependencies: Step 1
   - Risk: Low — adding a mixin is non-breaking; the migration handles the actual column addition

3. **Create migration 0015** (`backend/alembic/versions/0015_add_sync_columns.py`)
   - Action: Hand-write migration (do NOT autogenerate — need custom sequence + trigger):
     - Create sequence `sync_version_seq`
     - Add `server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` to all 5 existing tables
     - Add `sync_version BIGINT NOT NULL DEFAULT nextval('sync_version_seq')` to all 5 existing tables
     - Create index `ix_{table}_sync_version` on each table
     - Create a PostgreSQL trigger function `trg_bump_sync_version()` that sets `sync_version = nextval('sync_version_seq')` and `server_updated_at = now()` on every INSERT or UPDATE
     - Attach trigger to all 5 tables
   - Why: The trigger ensures sync_version increments on every mutation, including mutations from CRUD endpoints that don't know about sync. The sequence is shared across all tables so the pull endpoint can interleave results.
   - Dependencies: Step 2
   - Risk: Medium — triggers are powerful but must be tested. The `nextval()` default handles initial INSERT; the trigger handles subsequent UPDATEs.
   - Test: Run migration, insert a row, update it, verify sync_version increments

4. **Backfill existing rows** (in migration 0015)
   - Action: In the same migration, after adding columns, run `UPDATE products SET server_updated_at = updated_at, sync_version = nextval('sync_version_seq') WHERE sync_version = 0` (or use the default). Actually, since we set `DEFAULT nextval(...)`, existing rows will already have values if we use a two-step approach: add column with default (which populates existing rows in PostgreSQL 11+). Verify this.
   - Why: Existing rows need valid sync_version values so they appear in the first pull.
   - Dependencies: Step 3
   - Risk: Low — PostgreSQL sets the default on ADD COLUMN for existing rows

Verification: `cd backend && alembic upgrade head && pytest --cov=app --cov-report=term-missing`

---

### Phase 2: Backend — Water Logs Feature

Estimate: 7 files

1. **Create WaterLog model** (`backend/app/features/water_logs/models.py`)
   - Action: Create `WaterLog(Base, TimestampMixin, SyncMixin)` with columns: `id` (UUID PK), `user_id` (FK users.id), `device_id` (FK devices.id, nullable), `created_on_device_id` (UUID, nullable), `updated_on_device_id` (UUID, nullable), `day` (Date, not null), `amount_ml` (Integer, not null — can be negative for removals). Index on `(user_id, deleted_at)` and `(user_id, day)`.
   - Why: Water logs need to persist in the DB for multi-device sync. The current client model stores individual log events (not aggregates), so we mirror that.
   - Dependencies: Phase 1
   - Risk: Low

2. **Create migration 0016** (`backend/alembic/versions/0016_water_logs.py`)
   - Action: Autogenerate migration for the new `water_logs` table. Manually add the sync trigger attachment for this table. Also create index on `sync_version`.
   - Dependencies: Step 1
   - Risk: Low

3. **Create water log schemas** (`backend/app/features/water_logs/schemas.py`)
   - Action: Define `WaterLogCreateRequest(day: date, amount_ml: int)`, `WaterLogUpdateRequest(amount_ml: int | None)`, `WaterLogResponse(id, day, amount_ml, created_at, updated_at)`.
   - Dependencies: Step 1
   - Risk: Low

4. **Create water log service** (`backend/app/features/water_logs/service.py`)
   - Action: Implement `create_water_log`, `list_water_logs` (with day range filter), `get_water_log`, `update_water_log`, `soft_delete_water_log`. Follow the exact pattern from `weights/service.py`. No uniqueness constraint per day (multiple logs per day allowed).
   - Dependencies: Steps 1, 3
   - Risk: Low

5. **Create water log router** (`backend/app/features/water_logs/router.py`)
   - Action: `GET /water-logs` (list with from/to query params), `POST /water-logs`, `GET /water-logs/{id}`, `PATCH /water-logs/{id}`, `DELETE /water-logs/{id}`. Follow `weights/router.py` pattern exactly.
   - Dependencies: Step 4
   - Risk: Low

6. **Register router** (`backend/app/main.py`)
   - Action: Import and include `water_logs_router` in v1 router
   - Dependencies: Step 5
   - Risk: Low

7. **Update conftest** (`backend/tests/conftest.py`)
   - Action: Import `WaterLog` model in the model registration line (line 87)
   - Dependencies: Step 1
   - Risk: Low

8. **Write tests** (`backend/tests/api/test_water_logs.py`, `backend/tests/services/test_water_logs_db.py`)
   - Action: Test CRUD operations, user scoping (user A cannot see user B's logs), soft delete, day range filtering. Mirror `test_weights_db.py` pattern.
   - Dependencies: Steps 5, 7
   - Risk: Low

Verification: `cd backend && alembic upgrade head && pytest --cov=app --cov-report=term-missing`

---

### Phase 3: Backend — New Sync Pull Endpoint

Estimate: 5 files

1. **Rewrite sync schemas** (`backend/app/features/sync/schemas.py`)
   - Action: Replace existing schemas with:
     - `SyncPullResponse`: `{ items: list[SyncItem], next_version: int | None, has_more: bool }`
     - `SyncItem`: `{ entity_type: str, id: UUID, data: dict, sync_version: int, updated_at: datetime, deleted_at: datetime | None }` — `entity_type` is one of `"product"`, `"portion"`, `"food_entry"`, `"body_weight"`, `"user_goal"`, `"water_log"`. `data` contains the entity-specific fields (same as current Sync* schemas but flattened into a dict).
     - Keep `SyncProduct`, `SyncPortion`, `SyncFoodEntry` as inner detail schemas but add `SyncBodyWeight`, `SyncUserGoal`, `SyncWaterLog`.
   - Why: A unified item type with `entity_type` discriminator lets the client process all entities in one paginated stream, ordered by sync_version.
   - Dependencies: Phase 2
   - Risk: Medium — this is a breaking change to the sync API. Since sync has no consumers yet in production, this is acceptable.

2. **Rewrite sync service** (`backend/app/features/sync/service.py`)
   - Action: Replace the three `get_changed_*` functions with a single `get_deltas(session, user_id, since_version, limit)` function that:
     - Queries all 6 tables with `WHERE user_id = :uid AND sync_version > :since` (includes soft-deleted rows)
     - Uses `UNION ALL` or sequential queries, collects results, sorts by `sync_version ASC`
     - Returns at most `limit` items (default 500)
     - Returns `(items, has_more)` tuple
   - Implementation approach: Use 6 separate queries rather than UNION ALL. Fetch `limit + 1` from each, merge in Python, sort by `sync_version`, truncate to `limit`. This is simpler and avoids heterogeneous UNION column issues.
   - Why: Single version-ordered stream is simpler for the client to process and enables efficient pagination.
   - Dependencies: Phase 1 (sync_version column exists)
   - Risk: Medium — performance with 6 queries. Mitigated by index on `sync_version` and reasonable page size (500).

3. **Rewrite sync router** (`backend/app/features/sync/router.py`)
   - Action: Replace `GET /since` with `GET /pull`:
     - Query params: `since_version: int = 0`, `limit: int = 500` (max 500)
     - Returns `SyncPullResponse`
     - Remove `_parse_cursor` and `_format_cursor` functions
   - Keep `POST /push` for Phase 4.
   - Dependencies: Steps 1, 2
   - Risk: Low — old `/since` endpoint has no production clients

4. **Write sync pull tests** (`backend/tests/api/test_sync_pull.py`)
   - Action: Test scenarios:
     - Empty pull (new user, since_version=0) returns empty items
     - After creating products/entries, pull returns them ordered by sync_version
     - Pagination: create >500 items, verify has_more=true, next_version allows continuation
     - Soft-deleted items appear in pull results (with deleted_at set)
     - User scoping: user A's data not visible to user B
     - Different entity types interleave correctly
   - Dependencies: Step 3
   - Risk: Low

5. **Write sync service tests** (`backend/tests/services/test_sync_service.py`)
   - Action: Unit test `get_deltas` with various data combinations
   - Dependencies: Step 2
   - Risk: Low

Verification: `cd backend && pytest --cov=app --cov-report=term-missing`

---

### Phase 4: Backend — New Sync Push Endpoint

Estimate: 4 files

1. **Define push schemas** (`backend/app/features/sync/schemas.py` — extend)
   - Action: Add to the schemas file:
     - `SyncPushRequest`: `{ mutations: list[SyncMutation] }`
     - `SyncMutation`: `{ entity_type: str, action: "upsert" | "delete", id: UUID, data: dict | None, updated_at: datetime, device_id: UUID | None }`
     - `SyncPushResponse`: `{ accepted: int, rejected: int, conflicts: list[SyncConflict] }`
     - `SyncConflict`: `{ entity_type: str, id: UUID, reason: str, server_version: dict }`
   - Why: Batch push with explicit conflict reporting enables the client to handle conflicts gracefully.
   - Dependencies: Phase 3 Step 1 (schema file restructured)
   - Risk: Low

2. **Implement push service** (`backend/app/features/sync/push_service.py`)
   - Action: Create `process_push(session, user_id, mutations, device_id)` that:
     - For each mutation, looks up the existing row by `(id, user_id)`
     - LWW: If mutation.updated_at > existing.updated_at, apply the change. If <=, skip and record as conflict.
     - `upsert` action: If row doesn't exist, INSERT. If exists and LWW wins, UPDATE fields from `data`.
     - `delete` action: Soft-delete (set deleted_at). LWW still applies — if server version is newer, reject.
     - Set `updated_on_device_id = device_id` on all writes
     - All mutations in a single transaction
     - Return `(accepted_count, rejected_count, conflicts_list)`
   - Entity dispatch: Use a registry dict mapping `entity_type` string to `(model_class, upsert_function)`. Each upsert function knows which fields to map from the `data` dict.
   - Why: Centralized push processing with LWW is the standard approach for offline-first sync.
   - Dependencies: Phase 3
   - Risk: High — This is the most complex piece. Careful handling of: FK constraints (product must exist before portion/food_entry), ordering of mutations within a batch, and proper transaction isolation.
   - Mitigation: Process mutations in dependency order (products first, then portions, then food_entries/body_weights/goals/water_logs). Validate FKs within the batch.

3. **Add push route** (`backend/app/features/sync/router.py` — extend)
   - Action: Add `POST /push` endpoint:
     - Body: `SyncPushRequest`
     - Depends: `get_current_user_id`, `get_optional_device_id`, `get_session`
     - Returns: `SyncPushResponse`
   - Dependencies: Steps 1, 2
   - Risk: Low

4. **Write push tests** (`backend/tests/api/test_sync_push.py`)
   - Action: Test scenarios:
     - Simple upsert: new product pushed, appears in DB
     - LWW: push older mutation, server version wins (conflict reported)
     - LWW: push newer mutation, client version wins
     - Delete: soft-delete via push
     - Batch ordering: portion pushed with product in same batch (product processed first)
     - FK validation: food_entry referencing non-existent product fails gracefully
     - User scoping: cannot push to another user's entities
     - Empty batch returns {accepted: 0, rejected: 0, conflicts: []}
   - Dependencies: Step 3
   - Risk: Low

Verification: `cd backend && pytest --cov=app --cov-report=term-missing`

---

### Phase 5: Client — Outbox + Sync API Client

Estimate: 5 files

1. **Create sync API client** (`client/src/services/api/sync.ts`)
   - Action: Define types and functions:
     - `SyncPullParams: { sinceVersion: number; limit?: number }`
     - `SyncPullResponse: { items: SyncItem[]; nextVersion: number | null; hasMore: boolean }`
     - `SyncItem: { entityType: string; id: string; data: Record<string, unknown>; syncVersion: number; updatedAt: string; deletedAt: string | null }`
     - `SyncMutation: { entityType: string; action: "upsert" | "delete"; id: string; data: Record<string, unknown> | null; updatedAt: string }`
     - `SyncPushResponse: { accepted: number; rejected: number; conflicts: SyncConflict[] }`
     - `pullDeltas(params: SyncPullParams): Promise<SyncPullResponse>` — calls `GET /v1/sync/pull`
     - `pushMutations(mutations: SyncMutation[]): Promise<SyncPushResponse>` — calls `POST /v1/sync/push`
   - Why: Clean typed API layer for sync operations
   - Dependencies: None (uses existing `apiFetch`)
   - Risk: Low

2. **Create water logs API client** (`client/src/services/api/waterLogs.ts`)
   - Action: CRUD functions: `listWaterLogs(from?, to?)`, `createWaterLog(day, amountMl)`, `updateWaterLog(id, amountMl)`, `deleteWaterLog(id)`. Follow `bodyWeights.ts` pattern.
   - Why: Needed for direct API calls and sync push payload construction
   - Dependencies: None
   - Risk: Low

3. **Create outbox module** (`client/src/storage/outbox.ts`)
   - Action: Replace `syncQueue.ts` semantics with a cleaner model:
     - `OutboxEntry: { id: string; entityType: string; action: "upsert" | "delete"; entityId: string; data: Record<string, unknown> | null; updatedAt: string; createdAt: number; attempts: number }`
     - `OUTBOX_STORAGE_KEY = "@countOnMe/outbox/v1"`
     - `enqueueOutbox(entry: Omit<OutboxEntry, "createdAt" | "attempts">): Promise<void>`
     - `loadOutbox(): Promise<OutboxEntry[]>`
     - `clearOutbox(): Promise<void>`
     - `removeFromOutbox(ids: string[]): Promise<void>`
     - `markFailed(id: string, error: string): Promise<void>`
     - Deduplication: If an entry with the same `entityType + entityId` already exists, replace it (last mutation wins locally).
   - Why: The outbox stores pending mutations. Unlike the current sync queue which dispatches to individual API endpoints, the outbox stores raw mutation data for the batch push endpoint.
   - Dependencies: None
   - Risk: Low

4. **Write outbox tests** (`client/src/storage/outbox.test.ts`)
   - Action: Test enqueue, dedup, load, clear, remove, markFailed
   - Dependencies: Step 3
   - Risk: Low

5. **Add sync cursor storage** (`client/src/storage/storage.ts`)
   - Action: Add `STORAGE_KEYS.syncCursor: "@countOnMe/sync-cursor/v1"`. Add `loadSyncCursor(): Promise<number>` (returns 0 if not set) and `saveSyncCursor(version: number): Promise<void>`.
   - Why: The client needs to remember the last sync_version it received so it can resume from there.
   - Dependencies: None
   - Risk: Low

Verification: `cd client && pnpm run verify`

---

### Phase 6: Client — Sync Engine

Estimate: 4 files

1. **Create sync engine** (`client/src/services/syncEngine.ts`)
   - Action: Implement the core sync orchestrator:
     - `SyncState: { status: "idle" | "pulling" | "pushing" | "error"; lastSyncAt: number | null; lastError: string | null; pendingCount: number; pullProgress: number; pushProgress: number }`
     - `syncEngine` object with:
       - `pull()`: Load syncCursor from storage, call `pullDeltas` in a loop (handling pagination/hasMore), apply each delta to local storage (call entity-specific merge functions), update syncCursor after each page.
       - `push()`: Load outbox, batch into chunks of 50, call `pushMutations` for each chunk, remove accepted entries from outbox, handle conflicts (log + remove from outbox — LWW means server is right).
       - `sync()`: Pull first, then push. This order ensures the client has the latest server state before pushing, reducing conflicts.
       - `getState(): SyncState`
       - `subscribe(listener: (state: SyncState) => void): () => void` — event emitter pattern for UI updates
     - Entity merge functions (called during pull):
       - Products: upsert into `loadProducts/saveProducts` by id
       - Portions: no local storage currently — skip or add
       - FoodEntries: no local storage currently — skip (they use direct API)
       - BodyWeights: upsert into `loadBodyWeights/saveBodyWeights` by id
       - Goals: upsert into `loadGoal/saveGoal` (single object — replace if newer)
       - WaterLogs: upsert into `loadWaterLogs/saveWaterLogs` by id
   - Why: Central sync logic decoupled from React hooks enables testing and reuse
   - Dependencies: Phase 5
   - Risk: High — merge logic must be correct. Mitigated by explicit test cases for each entity type.

2. **Write sync engine tests** (`client/src/services/syncEngine.test.ts`)
   - Action: Test:
     - Pull applies deltas to local storage
     - Pull handles pagination (multiple pages)
     - Push sends outbox contents and clears accepted
     - Push handles conflicts gracefully
     - sync() runs pull then push in order
     - State transitions are correct
   - Dependencies: Step 1
   - Risk: Low

3. **Rewrite useSyncStatus** (`client/src/hooks/useSyncStatus.ts`)
   - Action: Replace current implementation:
     - Subscribe to `syncEngine.subscribe()` on mount
     - Expose: `{ status, lastSyncAt, lastError, pendingCount, isOnline, syncNow, isSyncing }`
     - Remove references to old `flush`, `getQueue`, `getLastSyncAt`, `getLastSyncError`
     - `syncNow()` calls `syncEngine.sync()`
   - Why: Single source of truth for sync state
   - Dependencies: Steps 1, Phase 5 Step 3
   - Risk: Medium — consumers of `useSyncStatus` need to be updated for the new return type

4. **Create useAutoSync hook** (`client/src/hooks/useAutoSync.ts`)
   - Action: Hook that triggers sync automatically:
     - On mount: initial sync
     - AppState change to "active" (foreground): sync if >30s since last sync
     - NetInfo reconnect: sync immediately
     - Periodic: `setInterval` every 5 minutes (only if not already syncing)
     - Cleanup: unsubscribe all listeners on unmount
     - Use in the root navigator or app layout component
   - Why: Users should never have to manually trigger sync. Automatic triggers keep data fresh.
   - Dependencies: Step 3
   - Risk: Low

Verification: `cd client && pnpm run verify`

---

### Phase 7: Client — Hook Migration (Switch to Outbox)

Estimate: 7 files

1. **Update WaterLog type** (`client/src/models/types.ts`)
   - Action: Add `updatedAt: ISODateString` to `WaterLog` type (needed for LWW)
   - Dependencies: None
   - Risk: Low — additive change. Update `useWaterTracking` to set `updatedAt` when creating logs.

2. **Update useProducts** (`client/src/hooks/useProducts.ts`)
   - Action: Replace `import { enqueue } from "@storage/syncQueue"` with `import { enqueueOutbox } from "@storage/outbox"`. Update all 3 `enqueue()` calls to use the new outbox format:
     ```
     enqueueOutbox({
       id: `product:${newProduct.id}`,
       entityType: "product",
       action: "upsert",
       entityId: newProduct.id,
       data: { name: newProduct.name, barcode: newProduct.barcode },
       updatedAt: newProduct.updatedAt,
     })
     ```
   - Why: Hooks should write to the outbox, not dispatch to individual API endpoints
   - Dependencies: Phase 5 Step 3
   - Risk: Low

3. **Update useGoal** (`client/src/hooks/useGoal.ts`)
   - Action: Same pattern — replace `enqueue` with `enqueueOutbox`. The goal hook currently calls the API directly AND enqueues. After this change, it should only write to local storage + enqueue to outbox. The sync engine will handle API calls.
   - **Decision needed**: Currently `useGoal` calls `apiCreateCalculatedGoal` directly (which needs server-side calculation). This creates a dependency on being online. For Phase 5, keep the direct API call for `calculateGoal` (which is a pure computation request) and `saveCalculatedGoal`/`saveManualGoal` (which need server response for the computed fields). Only the subsequent updates and deletes should go through the outbox.
   - Dependencies: Phase 5 Step 3
   - Risk: Medium — goal creation has server-side dependencies (calculation)

4. **Update useBodyWeight** (`client/src/hooks/useBodyWeight.ts`)
   - Action: Replace `enqueue` with `enqueueOutbox`. Also change the hook to be truly offline-first: generate the entry locally (with client-generated UUID and timestamps), save to local storage, enqueue to outbox. Don't call `apiCreateBodyWeight` directly anymore.
   - Why: Consistent offline-first pattern across all hooks
   - Dependencies: Phase 5 Step 3
   - Risk: Medium — currently `useBodyWeight.logWeight` calls `apiCreateBodyWeight` first and only enqueues after success. Switching to offline-first means handling 409 conflicts during sync push instead.

5. **Update useWaterTracking** (`client/src/hooks/useWaterTracking.ts`)
   - Action: Add `import { enqueueOutbox } from "@storage/outbox"`. In `addWater` and `removeWater`, after saving to local storage, enqueue to outbox. In `deleteWaterLog`, enqueue a delete mutation. Add `updatedAt` to the WaterLog objects created in the hook.
   - Dependencies: Phase 5 Step 3, Step 1
   - Risk: Low

6. **Deprecate syncQueue.ts** (`client/src/storage/syncQueue.ts`)
   - Action: Add a deprecation comment at the top. Do NOT delete yet — leave for one release cycle in case rollback is needed. Remove all imports of `enqueue` from hooks (done in steps 2-5). Remove the `applyOp` function and `flush` function exports. Keep `getQueue` temporarily for migration (to drain any pending ops on upgrade).
   - Why: Gradual deprecation is safer than immediate deletion
   - Dependencies: Steps 2-5
   - Risk: Low

7. **Add migration drain** (in `syncEngine.ts` — extend Phase 6 Step 1)
   - Action: In the sync engine's `sync()` method, before the first real sync, check if the old sync queue has any pending ops (`getQueue()`). If so, convert them to outbox entries and add them. Then clear the old queue. This is a one-time migration.
   - Why: Users upgrading from the old sync system shouldn't lose pending mutations
   - Dependencies: Phase 6 Step 1
   - Risk: Low

Verification: `cd client && pnpm run verify`

---

### Phase 8: Integration + Wire useAutoSync

Estimate: 3 files

1. **Wire useAutoSync into app** (`client/src/app/AppNavigator.tsx` or root layout)
   - Action: Call `useAutoSync()` at the top level of the app (in the navigator or a provider). This activates automatic sync for the entire app lifetime.
   - Dependencies: Phase 6 Step 4
   - Risk: Low

2. **Update Profile/Debug screen** (wherever `useSyncStatus` is consumed)
   - Action: Update UI to reflect new `useSyncStatus` return type (status enum instead of boolean flushing, etc.)
   - Dependencies: Phase 6 Step 3
   - Risk: Low

3. **End-to-end manual test**
   - Action: Verify the full flow: create product offline, come online, see it sync; create on device B, pull on device A; water logs sync bidirectionally; conflicts resolve via LWW.
   - Dependencies: All phases
   - Risk: N/A

Verification: `cd client && pnpm run verify && cd ../backend && pytest --cov=app --cov-report=term-missing`

---

## Testing Strategy

### Unit tests (backend)
- `tests/services/test_sync_service.py` — `get_deltas` with various entity combinations, pagination, user scoping
- `tests/services/test_water_logs_db.py` — CRUD, soft delete, day range filter
- `tests/api/test_sync_pull.py` — HTTP-level pull endpoint tests
- `tests/api/test_sync_push.py` — HTTP-level push endpoint tests, LWW, conflicts, batch ordering
- `tests/api/test_water_logs.py` — HTTP-level CRUD tests

### Unit tests (client)
- `storage/outbox.test.ts` — enqueue, dedup, load, clear, remove
- `services/syncEngine.test.ts` — pull, push, sync, state transitions, error handling
- `hooks/useAutoSync.test.ts` — trigger conditions, debouncing, cleanup

### Integration tests
- Backend: Create data via CRUD endpoints, verify it appears in pull; push mutations, verify they appear in CRUD reads
- Client: Mock API responses, verify sync engine correctly updates local storage

### Manual verification
- Create product on device A, verify it appears on device B after sync
- Create water log offline, verify it syncs when coming online
- Edit same product on two devices, verify LWW resolves correctly
- Delete product on device A, verify soft-delete propagates to device B

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| sync_version trigger performance on high-write tables | Medium | Index on sync_version; trigger is lightweight (single nextval + now()) |
| Push endpoint FK ordering (portion before product) | High | Sort mutations by entity_type dependency order before processing; reject orphan FKs with clear error |
| Concurrent push from two devices creating duplicate entries | Medium | LWW + server-generated sync_version ensures deterministic ordering; no split-brain |
| Old syncQueue data lost during migration | Low | Phase 7 Step 7 drains old queue into new outbox before deleting |
| Pull returning too much data on first sync | Medium | 500 item page limit; client processes pages incrementally |
| useGoal server dependency (calculation needs online) | Medium | Keep direct API call for calculate/create; only updates/deletes go through outbox |
| Entity merge during pull overwrites local changes | Medium | Pull runs before push; local outbox mutations are pushed after pull completes; LWW on server handles remaining conflicts |
| Breaking change to GET /sync/since | Low | No production consumers; endpoint unused in client (client uses individual CRUD endpoints) |

## Open Questions

1. **Should `useMeals` (legacy local-only meals) participate in sync?** Recommendation: No — meals are a legacy concept being replaced by food entries. Confirm with user.

2. **LWW tie-breaking**: When `updated_at` is identical between client and server, who wins? Recommendation: Server wins (simpler, avoids clock-skew issues).

3. **Periodic sync interval**: Currently planned as 5 minutes. Is this acceptable or should it be configurable?

4. **Water log model**: Should we keep the current design (one row per add/remove event, amount can be negative) or switch to a single row per day with aggregated total? Recommendation: Keep per-event rows — they're more granular and match the current client model. The daily total is derived.

5. **Food entries + portions in sync**: Currently `useFoodEntries` and `useMealTypeEntries` call the API directly (no local storage for food entries). Should Phase 5 add local storage for food entries to enable offline food logging? Recommendation: Yes, but as a follow-up task (Phase 5.5 or Phase 6) — it's a significant change to the food entry flow. For now, food entries and portions participate in pull (so device B sees device A's entries) but push only handles the 4 entities that already have local storage (products, goals, body_weights, water_logs).

6. **Push batch size**: Plan says 50 mutations per chunk. Is this a good default? The server processes all in one transaction.

## Parallelization

Backend Phases 1-4 and Client Phases 5-7 have a dependency boundary at the API contract (schemas). Once schemas are agreed in Phase 3 Step 1 and Phase 4 Step 1, client and backend work can proceed in parallel:

```
Phase 1 (Backend: migration + mixin)
  └─→ Phase 2 (Backend: water logs) ──────────────┐
  └─→ Phase 3 (Backend: pull endpoint) ────────────┤
       └─→ Phase 4 (Backend: push endpoint) ───────┤
                                                    │
Phase 5 (Client: outbox + API client) ─────────────┤ (can start after schema agreement)
  └─→ Phase 6 (Client: sync engine) ───────────────┤
       └─→ Phase 7 (Client: hook migration) ───────┤
                                                    │
                                          Phase 8 (Integration)
```

Backend Phases 1-4 can be a single backend PR. Client Phases 5-7 can be a separate client PR. Phase 8 is the integration/wiring PR.
