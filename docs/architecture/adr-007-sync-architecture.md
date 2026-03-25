---
type: adr
status: proposed
last-updated: 2026-03-25
related-features:
  - supabase-migration
  - offline-first
  - sync
---

# ADR-007: Sync Architecture — Delta-Based Sync by User ID

## Status

Proposed

## Context

CountOnMe is offline-first: the client must work without network access. Currently, data is stored in AsyncStorage (11 keys in `client/src/storage/storage.ts`) and a partial sync outbox exists in `client/src/storage/syncQueue.ts`.

The existing outbox (`syncQueue.ts`) supports only 3 resource types (`products`, `goals`, `body-weights`) with 3 actions each (`create`, `update`, `delete`). It uses AsyncStorage key `syncQueue:v1` and implements exponential backoff (1.5s base, 60s cap). The `flush()` function checks connectivity via NetInfo, iterates pending ops, and applies them via individual API calls. There is no pull mechanism -- it is push-only.

With Supabase migration (ADR-005, ADR-006), the sync model must expand to:
- Cover ALL private entities (products, portions, food entries, goals, body weights, water logs)
- Support bidirectional sync (pull server changes + push local changes)
- Handle multi-device conflict resolution (two devices editing the same row offline)
- Use `user_id` scoping instead of `device_id`

The client's local storage will move from AsyncStorage to expo-sqlite (see ADR-009), which provides the transactional guarantees needed for reliable sync metadata tracking.

## Decision

### 1. Delta-based sync, not full-dump

Each sync cycle transfers only rows that changed since the last sync, not the entire dataset. This is critical for:
- Battery and bandwidth efficiency on mobile
- Scaling as user data grows (months of food entries)
- Reducing server load

### 2. Sync metadata columns

Every syncable table (both server-side Postgres and client-side SQLite) carries these columns:

| Column | Type | Purpose |
|---|---|---|
| `updated_at` | TIMESTAMPTZ | Last modification time (server or client) |
| `server_updated_at` | TIMESTAMPTZ | Server's timestamp when this row was last written to Postgres |
| `deleted_at` | TIMESTAMPTZ | Soft delete marker (existing pattern) |
| `last_synced_at` | TIMESTAMPTZ | Client-only: when this row was last successfully synced |
| `is_dirty` | BOOLEAN | Client-only: true if local changes exist that haven't been pushed |

The `server_updated_at` column is set by the backend on every write (INSERT or UPDATE). It is the authoritative clock for delta queries. Client clocks are not trusted for ordering.

### 3. Sync cycle: Pull-then-Push

Each sync cycle follows this order:

```
┌─────────────────────────────────────────────┐
│                 PULL PHASE                   │
│  1. Client sends last_server_updated_at      │
│     per entity type                          │
│  2. Server returns all rows where            │
│     server_updated_at > cursor               │
│     (including soft-deleted rows)            │
│  3. Client upserts into local SQLite         │
│     (server wins on conflict)               │
│  4. Client updates local last_synced_at      │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│                 PUSH PHASE                   │
│  5. Client selects all rows where            │
│     is_dirty = true                          │
│  6. Client sends batch to server             │
│  7. Server applies changes, sets             │
│     server_updated_at = now()                │
│  8. Server returns accepted rows with        │
│     their server_updated_at values           │
│  9. Client clears is_dirty, updates          │
│     server_updated_at and last_synced_at     │
└─────────────────────────────────────────────┘
```

Pull-before-push ensures the client has the latest server state before attempting to push. This reduces conflicts because the client can detect and resolve them locally before sending.

### 4. Conflict resolution: last-write-wins with server_updated_at

When a pull returns a row that the client also modified locally (`is_dirty = true`):

1. Compare `server_updated_at` (from pull) with client's local `updated_at`
2. **Server wins**: The pulled version replaces the local version. The client's local change is discarded.
3. The `updated_on_device_id` audit column records which device last wrote the row on the server, providing a trail if conflicts need investigation.

Last-write-wins is chosen for simplicity. The calorie tracking domain has low conflict probability:
- Most entities are append-only (food entries, body weights, water logs)
- Products and goals are edited infrequently
- Two devices editing the same product name simultaneously is a rare edge case

### 5. Sync API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/sync/pull` | Return changed rows since cursors |
| `POST` | `/v1/sync/push` | Accept batch of client mutations |

#### Pull request

```
GET /v1/sync/pull?products_since=2026-03-20T10:00:00Z&portions_since=...&food_entries_since=...
Authorization: Bearer {supabase_jwt}
```

Query parameters are ISO 8601 timestamps, one per entity type. On first sync, omit the parameter (server returns all rows for the user). Server response:

```json
{
  "products": [
    { "id": "...", "name": "...", "user_id": "...", "server_updated_at": "...", "deleted_at": null, ... }
  ],
  "portions": [...],
  "food_entries": [...],
  "goals": [...],
  "body_weights": [...],
  "water_logs": [...],
  "server_time": "2026-03-25T12:00:00Z"
}
```

The `server_time` field is the server's current clock, used by the client as the cursor for the next pull. This avoids clock skew issues -- the client never uses its own clock for sync cursors.

Pagination: if any entity type has more than 500 changed rows, the response includes a `has_more: true` flag and the client must re-pull with the latest `server_updated_at` from the returned batch.

#### Push request

```
POST /v1/sync/push
Authorization: Bearer {supabase_jwt}
Content-Type: application/json

{
  "device_id": "...",
  "products": [
    { "id": "...", "name": "...", "updated_at": "...", "_action": "upsert" }
  ],
  "portions": [...],
  "food_entries": [...],
  "goals": [...],
  "body_weights": [...],
  "water_logs": [...]
}
```

The `device_id` in the push body is used to set `updated_on_device_id` on the server. Each row includes an `_action` field: `"upsert"` (create or update) or `"delete"` (set `deleted_at`).

Push response:

```json
{
  "accepted": {
    "products": [
      { "id": "...", "server_updated_at": "2026-03-25T12:00:01Z" }
    ],
    ...
  },
  "rejected": {
    "products": [
      { "id": "...", "reason": "conflict", "server_version": { ... } }
    ]
  }
}
```

Rejected rows (if any) include the server's current version so the client can reconcile.

### 6. Entity coverage

All private entities participate in sync:

| Entity | Table | Sync Direction | Conflict Likelihood | Notes |
|---|---|---|---|---|
| Products | `products` | Bidirectional | Low | User-created foods, edited occasionally |
| Product Portions | `product_portions` | Bidirectional | Very low | Portion definitions rarely change |
| Food Entries | `food_entries` | Bidirectional | Very low | Append-mostly, day+meal_type scoped |
| User Goals | `user_goals` | Bidirectional | Low | Typically one active goal |
| Body Weights | `body_weights` | Bidirectional | Very low | One entry per day |
| Water Logs | `water_logs` | Bidirectional | Very low | Append-only, day scoped |

Global catalog tables (`catalog_products`, `catalog_portions`) are NOT synced -- they are server-only seed data accessed via read-only API.

### 7. Outbox table schema (client-side SQLite)

The existing AsyncStorage-based `syncQueue.ts` is replaced by a SQLite table:

```sql
-- Client-side SQLite
CREATE TABLE sync_outbox (
    id          TEXT PRIMARY KEY,      -- UUID
    entity_type TEXT NOT NULL,          -- 'products', 'portions', 'food_entries', etc.
    entity_id   TEXT NOT NULL,          -- UUID of the affected row
    action      TEXT NOT NULL,          -- 'upsert' or 'delete'
    payload     TEXT NOT NULL,          -- JSON serialized row data
    created_at  TEXT NOT NULL,          -- ISO 8601
    attempts    INTEGER NOT NULL DEFAULT 0,
    last_error  TEXT,
    UNIQUE(entity_type, entity_id)     -- Only latest mutation per entity matters
);
```

The `UNIQUE(entity_type, entity_id)` constraint means if a user edits a product twice offline, only the latest version is in the outbox. This is correct because we push the current row state, not individual operations.

### 8. Sync cursors (client-side SQLite)

```sql
-- Client-side SQLite
CREATE TABLE sync_cursors (
    entity_type TEXT PRIMARY KEY,
    last_server_updated_at TEXT NOT NULL,  -- ISO 8601, from server_time in pull response
    last_synced_at         TEXT NOT NULL   -- ISO 8601, client local time
);
```

### 9. Sync triggers

Sync runs automatically:
- **On app foreground** (AppState change to "active")
- **On network reconnect** (NetInfo listener detects connectivity restored)
- **After local mutation** (debounced, 3-second delay to batch rapid edits)
- **Manual pull-to-refresh** on relevant screens

Sync does NOT run:
- When offline (skip gracefully)
- When no dirty rows exist and cursors are fresh (within last 5 minutes)

### 10. Migration from existing syncQueue

The existing `syncQueue:v1` AsyncStorage key is drained during the migration:
1. Read all pending `SyncOp` items from AsyncStorage
2. Convert each to the new SQLite `sync_outbox` format
3. Write to SQLite
4. Delete the AsyncStorage key
5. The old `syncQueue.ts` module is removed after migration

## Consequences

### Positive
- Full bidirectional sync covers all entity types (up from 3)
- Delta-based sync is bandwidth-efficient and scales with data growth
- Pull-then-push ordering reduces conflict frequency
- Server timestamps (`server_updated_at`) eliminate client clock skew issues
- SQLite outbox with UNIQUE constraint deduplicates mutations automatically
- Batched push reduces HTTP round-trips compared to per-operation sync

### Negative
- Last-write-wins can silently discard edits in rare conflict scenarios (two devices editing same product offline simultaneously)
- The pull endpoint must query 6 tables per request, which requires careful indexing
- Sync metadata columns (`server_updated_at`, `is_dirty`, `last_synced_at`) add storage overhead to every row
- The sync system is significantly more complex than the current push-only outbox

### Risks
- **Pull performance**: Large initial sync (user with months of food entries) could be slow. Mitigation: pagination at 500 rows per entity type; progress indicator in UI.
- **Push atomicity**: If the push partially succeeds (some entities accepted, some rejected), the client must handle mixed state. Mitigation: server processes push within a single transaction -- all or nothing per push request.
- **Stale cursors**: If a user does not open the app for months, the delta pull could return thousands of rows. Mitigation: server-side pagination and the same 500-row batch limit.
- **Conflict data loss**: Last-write-wins means the "losing" edit is permanently discarded. Mitigation: acceptable for this domain; add `updated_on_device_id` audit trail so conflicts can be investigated retroactively if needed. A future version could implement per-field merge for complex entities like goals.

## Alternatives Considered

### A. Full-dump sync (send entire dataset each time)
Rejected because: does not scale. A user with 6 months of food entries (3 meals/day * 3 items * 180 days = 1620 entries) would transfer the full dataset every sync cycle. Wasteful on mobile bandwidth and battery.

### B. Operation-based sync (CRDT / event sourcing)
Rejected because: dramatically increases complexity for minimal benefit in this domain. Calorie tracking data is low-conflict and mostly append-only. CRDTs solve a problem we are unlikely to have at meaningful scale. The implementation and debugging cost is not justified.

### C. Supabase Realtime subscriptions for live sync
Rejected because: Supabase Realtime requires a persistent WebSocket connection, which is not reliable on mobile (background kills, network transitions). Delta polling is more resilient for an offline-first mobile app. Realtime could be added later as an optimization for "live" multi-device scenarios.

### D. Keep the existing push-only outbox, add pull separately
Rejected because: the existing outbox is stored in AsyncStorage (not transactional), supports only 3 resource types, and uses individual API calls per operation. It would need to be substantially rewritten anyway. A clean replacement with SQLite-backed sync is simpler than evolving the existing system.
