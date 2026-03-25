---
type: adr
status: proposed
last-updated: 2026-03-25
related-features:
  - supabase-migration
  - offline-first
  - local-storage
---

# ADR-009: Local Storage Strategy — AsyncStorage to expo-sqlite

## Status

Proposed

## Context

CountOnMe stores all client-side data in AsyncStorage via `client/src/storage/storage.ts`. This file defines 11 storage keys and provides typed load/save functions for each data type. The current storage layout:

| Key | Type | Data |
|---|---|---|
| `@countOnMe/products/v1` | `Product[]` | Legacy products (migrated to v2 on read) |
| `@countOnMe/products/v2` | `Product[]` | Current products with scale/portion fields |
| `@countOnMe/meals/v1` | `Meal[]` | Legacy meals (migrated to v2 on read) |
| `@countOnMe/meals/v2` | `Meal[]` | Current meals with amount+unit items |
| `@countOnMe/products-favourites/v1` | `string[]` | Product IDs (max 5) |
| `@countOnMe/products-recents/v1` | `string[]` | Product IDs (max 50, newest first) |
| `@countOnMe/goal/v1` | `UserGoal` | Single goal object |
| `@countOnMe/body-weights/v1` | `BodyWeightEntry[]` | Weight entries |
| `@countOnMe/water-logs/v1` | `WaterLog[]` | Water intake entries |
| `@countOnMe/draft-meal/v1` | `StoredDraftMeal` | Ephemeral draft state |
| `@countOnMe/theme/v1` | `ThemeMode` | `"light"` / `"dark"` / `"system"` |

Additionally, device identity is stored separately in `client/src/storage/device.ts`:
| Key | Type | Data |
|---|---|---|
| `device:id` | `string` | UUID device identifier |
| `device:token` | `string` | Device auth token (to be removed per ADR-006) |

The sync outbox is in `client/src/storage/syncQueue.ts`:
| Key | Type | Data |
|---|---|---|
| `syncQueue:v1` | `SyncOp[]` | Pending sync operations |
| `syncQueue:lastSyncAt` | `number` | Last successful sync timestamp |
| `syncQueue:lastError` | `string` | Last sync error message |

### AsyncStorage limitations for sync

AsyncStorage works as a simple key-value store (JSON strings), which was fine for an offline-only app. With bidirectional sync (ADR-007), it falls short:

1. **No transactions**: AsyncStorage writes are not atomic. A crash between writing two related keys (e.g., saving a product and updating the sync outbox) leaves data inconsistent.
2. **No relational queries**: Fetching "all food entries for today" requires loading the entire array and filtering in JS. This degrades as data grows.
3. **No indexes**: No way to efficiently query by date, meal_type, or synced status.
4. **No schema enforcement**: Data structure is validated only by TypeScript types at call sites, not at storage level.
5. **Whole-collection reads**: Loading products means parsing the entire JSON array, even to read one product by ID.
6. **No sync metadata**: Cannot efficiently track `is_dirty`, `last_synced_at`, `server_updated_at` per row without serializing/deserializing entire collections.

## Decision

### 1. Three storage tiers

| Tier | Technology | Data | Reason |
|---|---|---|---|
| **Syncable domain data** | expo-sqlite | Products, portions, food entries, goals, body weights, water logs, favourites, sync outbox, sync cursors | Needs transactions, indexes, per-row sync metadata, relational queries |
| **Auth tokens** | expo-secure-store | `access_token`, `refresh_token` | Must be encrypted at rest (OS keychain) |
| **Preferences & ephemeral state** | AsyncStorage | Theme mode, draft meal state, device ID | Simple key-value, no sync needed, no security sensitivity |

### 2. expo-sqlite as the primary local database

Library: `expo-sqlite` (first-party Expo module, SQLite 3.x, synchronous API with async wrappers).

Why expo-sqlite over alternatives:
- First-party Expo support -- no native module compatibility issues
- Synchronous API available for performance-critical reads
- Full SQL support including transactions, indexes, triggers
- Works in Expo managed workflow (no ejection needed)
- Mature SQLite engine with decades of battle-testing

### 3. SQLite schema for syncable entities

Each server table has a corresponding SQLite table with additional client-only columns:

```sql
-- Products
CREATE TABLE products (
    id                    TEXT PRIMARY KEY,  -- UUID as TEXT
    user_id               TEXT NOT NULL,
    name                  TEXT NOT NULL,
    barcode               TEXT,
    category              TEXT,
    portion_size          REAL,
    scale_type            TEXT,
    scale_unit            TEXT,
    allowed_units         TEXT,              -- JSON array
    calories_per_base     REAL,
    protein_per_base      REAL,
    carbs_per_base        REAL,
    fat_per_base          REAL,
    calories_per_100g     REAL NOT NULL,
    protein_per_100g      REAL,
    carbs_per_100g        REAL,
    fat_per_100g          REAL,
    source                TEXT NOT NULL DEFAULT 'user',
    created_at            TEXT NOT NULL,     -- ISO 8601
    updated_at            TEXT NOT NULL,     -- ISO 8601
    deleted_at            TEXT,              -- ISO 8601, soft delete
    -- Sync metadata (client-only columns)
    server_updated_at     TEXT,              -- NULL until first sync
    last_synced_at        TEXT,
    is_dirty              INTEGER NOT NULL DEFAULT 1,  -- 1=true (new rows are dirty)
    created_on_device_id  TEXT,
    updated_on_device_id  TEXT
);

CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_is_dirty ON products(is_dirty) WHERE is_dirty = 1;

-- Product Portions
CREATE TABLE product_portions (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    product_id            TEXT NOT NULL REFERENCES products(id),
    label                 TEXT NOT NULL,
    base_amount           REAL NOT NULL,
    base_unit             TEXT NOT NULL,
    calories              REAL NOT NULL,
    protein               REAL,
    carbs                 REAL,
    fat                   REAL,
    is_default            INTEGER NOT NULL DEFAULT 0,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    deleted_at            TEXT,
    server_updated_at     TEXT,
    last_synced_at        TEXT,
    is_dirty              INTEGER NOT NULL DEFAULT 1,
    created_on_device_id  TEXT,
    updated_on_device_id  TEXT
);

CREATE INDEX idx_portions_product_id ON product_portions(product_id);
CREATE INDEX idx_portions_is_dirty ON product_portions(is_dirty) WHERE is_dirty = 1;

-- Food Entries
CREATE TABLE food_entries (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    product_id            TEXT NOT NULL REFERENCES products(id),
    portion_id            TEXT NOT NULL REFERENCES product_portions(id),
    day                   TEXT NOT NULL,     -- YYYY-MM-DD
    meal_type             TEXT NOT NULL,
    amount                REAL NOT NULL,
    unit                  TEXT NOT NULL,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    deleted_at            TEXT,
    server_updated_at     TEXT,
    last_synced_at        TEXT,
    is_dirty              INTEGER NOT NULL DEFAULT 1,
    created_on_device_id  TEXT,
    updated_on_device_id  TEXT
);

CREATE INDEX idx_food_entries_day ON food_entries(day);
CREATE INDEX idx_food_entries_user_day ON food_entries(user_id, day);
CREATE INDEX idx_food_entries_is_dirty ON food_entries(is_dirty) WHERE is_dirty = 1;

-- User Goals
CREATE TABLE user_goals (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    goal_type             TEXT NOT NULL,
    gender                TEXT,
    birth_date            TEXT,
    height_cm             REAL,
    current_weight_kg     REAL,
    activity_level        TEXT,
    weight_goal_type      TEXT,
    target_weight_kg      REAL,
    weight_change_pace    TEXT,
    bmr_kcal              INTEGER,
    tdee_kcal             INTEGER,
    daily_calories_kcal   INTEGER NOT NULL,
    protein_percent       INTEGER NOT NULL,
    carbs_percent         INTEGER NOT NULL,
    fat_percent           INTEGER NOT NULL,
    protein_grams         INTEGER NOT NULL,
    carbs_grams           INTEGER NOT NULL,
    fat_grams             INTEGER NOT NULL,
    water_ml              INTEGER NOT NULL,
    healthy_weight_min_kg REAL,
    healthy_weight_max_kg REAL,
    current_bmi           REAL,
    bmi_category          TEXT,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    deleted_at            TEXT,
    server_updated_at     TEXT,
    last_synced_at        TEXT,
    is_dirty              INTEGER NOT NULL DEFAULT 1,
    created_on_device_id  TEXT,
    updated_on_device_id  TEXT
);

CREATE INDEX idx_goals_user_id ON user_goals(user_id);

-- Body Weights
CREATE TABLE body_weights (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    day                   TEXT NOT NULL,     -- YYYY-MM-DD
    weight_kg             REAL NOT NULL,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    deleted_at            TEXT,
    server_updated_at     TEXT,
    last_synced_at        TEXT,
    is_dirty              INTEGER NOT NULL DEFAULT 1,
    created_on_device_id  TEXT,
    updated_on_device_id  TEXT
);

CREATE INDEX idx_body_weights_user_day ON body_weights(user_id, day);
CREATE INDEX idx_body_weights_is_dirty ON body_weights(is_dirty) WHERE is_dirty = 1;

-- Water Logs
CREATE TABLE water_logs (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    day                   TEXT NOT NULL,     -- YYYY-MM-DD
    amount_ml             INTEGER NOT NULL,
    created_at            TEXT NOT NULL,
    deleted_at            TEXT,
    server_updated_at     TEXT,
    last_synced_at        TEXT,
    is_dirty              INTEGER NOT NULL DEFAULT 1,
    created_on_device_id  TEXT
);

CREATE INDEX idx_water_logs_user_day ON water_logs(user_id, day);
CREATE INDEX idx_water_logs_is_dirty ON water_logs(is_dirty) WHERE is_dirty = 1;

-- Favourites (synced)
CREATE TABLE favourites (
    user_id               TEXT NOT NULL,
    product_id            TEXT NOT NULL REFERENCES products(id),
    position              INTEGER NOT NULL,  -- 0-4 for 5-slot ordering
    created_at            TEXT NOT NULL,
    PRIMARY KEY (user_id, product_id)
);

-- Recents (client-only, not synced)
CREATE TABLE recents (
    product_id            TEXT PRIMARY KEY,
    last_used_at          TEXT NOT NULL       -- ISO 8601
);

-- Sync outbox (replaces syncQueue.ts)
CREATE TABLE sync_outbox (
    id                    TEXT PRIMARY KEY,
    entity_type           TEXT NOT NULL,
    entity_id             TEXT NOT NULL,
    action                TEXT NOT NULL,      -- 'upsert' or 'delete'
    payload               TEXT NOT NULL,      -- JSON
    created_at            TEXT NOT NULL,
    attempts              INTEGER NOT NULL DEFAULT 0,
    last_error            TEXT,
    UNIQUE(entity_type, entity_id)
);

-- Sync cursors
CREATE TABLE sync_cursors (
    entity_type           TEXT PRIMARY KEY,
    last_server_updated_at TEXT NOT NULL,
    last_synced_at        TEXT NOT NULL
);
```

### 4. Repository pattern

The current storage layer (`storage.ts`) exports flat functions like `loadProducts()` / `saveProducts()`. These are replaced by repository classes that abstract the SQLite implementation:

```
hooks/ (consumers)
  ↓ calls
repositories/ (new layer inside storage/)
  ↓ queries
SQLite database
```

Each entity gets a repository:

```typescript
// storage/repositories/productRepository.ts
export const productRepository = {
  findAll: (userId: string): Product[] => { /* SELECT * FROM products WHERE user_id = ? AND deleted_at IS NULL */ },
  findById: (id: string): Product | null => { /* SELECT * FROM products WHERE id = ? */ },
  upsert: (product: Product): void => { /* INSERT OR REPLACE ... */ },
  markDeleted: (id: string): void => { /* UPDATE products SET deleted_at = ?, is_dirty = 1 */ },
  findDirty: (): Product[] => { /* SELECT * FROM products WHERE is_dirty = 1 */ },
  clearDirty: (ids: string[]): void => { /* UPDATE products SET is_dirty = 0 WHERE id IN (...) */ },
};
```

Hooks call repositories instead of raw storage functions. This means the SQLite implementation is swappable (e.g., for testing with an in-memory DB).

Repository files live in `client/src/storage/repositories/` (under the existing `storage/` directory, consistent with the folder structure rules).

### 5. Database initialization and schema versioning

The SQLite database is created on first app launch after login. Schema versioning uses `PRAGMA user_version`:

```typescript
const DB_VERSION = 1;

const initDatabase = async (db: SQLiteDatabase) => {
  const { user_version } = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );

  if (user_version < 1) {
    await db.execAsync(SCHEMA_V1); // All CREATE TABLE statements
    await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
  }

  // Future: if (user_version < 2) { migrate... }
};
```

Database file: `countOnMe.db` in the app's document directory.

### 6. One-time migration from AsyncStorage to SQLite

On app update (detected by the absence of the SQLite database when AsyncStorage data exists), a migration runs:

```
1. Open/create SQLite database
2. Read all AsyncStorage keys (products/v2, meals/v2, goal/v1, etc.)
3. For each collection:
   a. Parse JSON from AsyncStorage
   b. INSERT rows into corresponding SQLite tables
   c. Set is_dirty = 1 (so they get pushed to server on next sync)
   d. Set server_updated_at = NULL (not yet synced)
4. Migrate syncQueue:v1 ops to sync_outbox table
5. Migrate favourites string[] to favourites table with position
6. Migrate recents string[] to recents table
7. Delete migrated AsyncStorage keys
8. Set a migration-complete flag in AsyncStorage
```

The migration is wrapped in a SQLite transaction. If it fails partway, the transaction rolls back and the app retries on next launch. AsyncStorage data is not deleted until the migration is confirmed complete.

### 7. What stays in AsyncStorage

| Key | Reason |
|---|---|
| `@countOnMe/theme/v1` | Simple string preference, no sync needed, no relations |
| `@countOnMe/draft-meal/v1` | Ephemeral form state, can be lost without consequence |
| `device:id` | Device UUID, read infrequently, non-sensitive |
| `migration:complete` | One-time flag to prevent re-running migration |

### 8. What moves to SecureStore

| Key | Reason |
|---|---|
| Supabase `access_token` | Must be encrypted at rest (see ADR-006) |
| Supabase `refresh_token` | Must be encrypted at rest (see ADR-006) |

### 9. Parallel storage during transition

During the transition period (between app update and completed migration):

```
┌─────────────────────┐       ┌──────────────────┐
│   AsyncStorage      │       │    SQLite         │
│   (legacy data)     │──────►│   (new data)      │
│                     │ migrate│                   │
│   theme, draft,     │       │   products,       │
│   deviceId          │       │   entries,         │
│   (stays here)      │       │   goals, etc.     │
└─────────────────────┘       └──────────────────┘
                                      │
                              ┌───────┴────────┐
                              │  SecureStore    │
                              │  access_token   │
                              │  refresh_token  │
                              └────────────────┘
```

The app checks `migration:complete` flag on startup. If false, it runs the migration before showing the main UI (with a progress screen). Once complete, all reads/writes go through SQLite repositories.

### 10. Testing strategy

Repositories are tested using an in-memory SQLite database:

```typescript
// In test setup
const db = await SQLite.openDatabaseAsync(':memory:');
await initDatabase(db);
```

This allows fast, isolated tests without file system I/O. The repository functions accept a `db` parameter (dependency injection) for testability.

## Consequences

### Positive
- SQLite provides ACID transactions, eliminating the partial-write corruption risk in AsyncStorage
- Indexed queries (by day, user_id, is_dirty) are orders of magnitude faster than JSON parse + filter
- Per-row sync metadata (`is_dirty`, `server_updated_at`) enables efficient delta sync without serializing entire collections
- The repository pattern decouples hooks from storage implementation, making the SQLite migration testable and reversible
- Schema versioning via `PRAGMA user_version` supports future migrations cleanly
- In-memory SQLite for tests means the test suite does not depend on file system or async I/O

### Negative
- expo-sqlite adds a native dependency that requires a development build (not compatible with Expo Go)
- SQLite schema must be manually kept in sync with server-side Postgres schema (no auto-generation)
- The one-time AsyncStorage-to-SQLite migration adds complexity and must be tested thoroughly on real devices
- SQL queries in repositories are less type-safe than the current TypeScript-native AsyncStorage functions
- Additional ~2MB binary size from SQLite engine (negligible for a modern app)

### Risks
- **Migration failure on real devices**: AsyncStorage data could be malformed (legacy v1 formats, missing fields). Mitigation: the migration function reuses the existing `migrateProductsV1ToV2()` and `migrateMealsV1ToV2()` logic from `storage.ts`; add comprehensive error handling with per-row try/catch (skip bad rows, log warnings, do not abort).
- **Schema drift**: Server Postgres adds a column but client SQLite is not updated. Mitigation: version the SQLite schema; include migration checks in the app startup flow; document that server schema changes require a corresponding client SQLite migration.
- **Expo Go incompatibility**: expo-sqlite requires a development build. Mitigation: this is already required by the barcode scanner (expo-camera native module), so the team already uses development builds.
- **Large dataset migration**: A user with thousands of entries might experience a slow migration. Mitigation: wrap in a transaction (fast for SQLite), show a progress screen, and test with large synthetic datasets during development.

## Alternatives Considered

### A. Stay with AsyncStorage, add sync metadata via wrapper
Rejected because: AsyncStorage fundamentally lacks transactions and indexes. Wrapping it with sync metadata means serializing/deserializing entire JSON arrays for every sync check (is_dirty scan). This does not scale past a few hundred entries and makes crash recovery unreliable.

### B. Use WatermelonDB (SQLite with ORM + sync)
Rejected because: WatermelonDB adds an opinionated ORM layer, a custom sync protocol, and a significant learning curve. CountOnMe's sync requirements are straightforward (delta pull/push with last-write-wins). The added abstraction would obscure the sync logic and make debugging harder. Raw expo-sqlite with a thin repository layer is simpler and more transparent.

### C. Use expo-sqlite/next (new synchronous API)
This is what we ARE using. The `expo-sqlite` package (Expo SDK 54) provides both synchronous and asynchronous APIs. We use the synchronous API for reads (faster, simpler) and async transactions for writes (to avoid blocking the JS thread on batch operations).

### D. Use Supabase local-first (PowerSync or ElectricSQL)
Rejected because: PowerSync and ElectricSQL are third-party solutions with their own sync protocols, and they are not part of the Supabase managed service. They add significant dependencies and lock the app into their sync model. Building a simple delta sync on top of expo-sqlite gives full control and avoids vendor lock-in beyond Supabase itself.

### E. Keep all data in AsyncStorage, use SQLite only for sync outbox
Rejected because: this creates a split-brain storage model where domain data is in one system and sync metadata is in another. A crash between updating AsyncStorage and SQLite leaves them inconsistent. Collocating domain data and sync metadata in the same SQLite database ensures atomicity.
