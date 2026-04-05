import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

// ---------------------------------------------------------------------------
// Database interface for DI (repositories accept this, not concrete expo type)
// ---------------------------------------------------------------------------

export type Database = Pick<
  SQLiteDatabase,
  | "execAsync"
  | "runAsync"
  | "getFirstAsync"
  | "getAllAsync"
  | "withTransactionAsync"
>;

// ---------------------------------------------------------------------------
// Schema v1 — matches ADR-009 tables + local meals table
// ---------------------------------------------------------------------------

export const SCHEMA_V1 = `
-- Products
CREATE TABLE IF NOT EXISTS products (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    name                  TEXT NOT NULL,
    barcode               TEXT,
    category              TEXT,
    portion_size          REAL,
    scale_type            TEXT,
    scale_unit            TEXT,
    allowed_units         TEXT,
    calories_per_base     REAL,
    protein_per_base      REAL,
    carbs_per_base        REAL,
    fat_per_base          REAL,
    calories_per_100g     REAL NOT NULL,
    protein_per_100g      REAL,
    carbs_per_100g        REAL,
    fat_per_100g          REAL,
    source                TEXT NOT NULL DEFAULT 'user',
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    deleted_at            TEXT,
    server_updated_at     TEXT,
    last_synced_at        TEXT,
    is_dirty              INTEGER NOT NULL DEFAULT 1,
    created_on_device_id  TEXT,
    updated_on_device_id  TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_is_dirty ON products(is_dirty) WHERE is_dirty = 1;

-- Product Portions (empty for now — future use)
CREATE TABLE IF NOT EXISTS product_portions (
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

CREATE INDEX IF NOT EXISTS idx_portions_product_id ON product_portions(product_id);
CREATE INDEX IF NOT EXISTS idx_portions_is_dirty ON product_portions(is_dirty) WHERE is_dirty = 1;

-- Food Entries (empty for now — future use)
CREATE TABLE IF NOT EXISTS food_entries (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    product_id            TEXT NOT NULL REFERENCES products(id),
    portion_id            TEXT NOT NULL REFERENCES product_portions(id),
    day                   TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_food_entries_day ON food_entries(day);
CREATE INDEX IF NOT EXISTS idx_food_entries_user_day ON food_entries(user_id, day);
CREATE INDEX IF NOT EXISTS idx_food_entries_is_dirty ON food_entries(is_dirty) WHERE is_dirty = 1;

-- User Goals
CREATE TABLE IF NOT EXISTS user_goals (
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

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON user_goals(user_id);

-- Body Weights
CREATE TABLE IF NOT EXISTS body_weights (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    day                   TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_body_weights_user_day ON body_weights(user_id, day);
CREATE INDEX IF NOT EXISTS idx_body_weights_is_dirty ON body_weights(is_dirty) WHERE is_dirty = 1;

-- Water Logs
CREATE TABLE IF NOT EXISTS water_logs (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    day                   TEXT NOT NULL,
    amount_ml             INTEGER NOT NULL,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    deleted_at            TEXT,
    server_updated_at     TEXT,
    last_synced_at        TEXT,
    is_dirty              INTEGER NOT NULL DEFAULT 1,
    created_on_device_id  TEXT
);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_day ON water_logs(user_id, day);
CREATE INDEX IF NOT EXISTS idx_water_logs_is_dirty ON water_logs(is_dirty) WHERE is_dirty = 1;

-- Favourites (synced)
CREATE TABLE IF NOT EXISTS favourites (
    user_id               TEXT NOT NULL,
    product_id            TEXT NOT NULL,
    position              INTEGER NOT NULL,
    created_at            TEXT NOT NULL,
    PRIMARY KEY (user_id, product_id)
);

-- Recents (client-only, not synced)
CREATE TABLE IF NOT EXISTS recents (
    product_id            TEXT PRIMARY KEY,
    last_used_at          TEXT NOT NULL
);

-- Sync outbox
CREATE TABLE IF NOT EXISTS sync_outbox (
    id                    TEXT PRIMARY KEY,
    entity_type           TEXT NOT NULL,
    entity_id             TEXT NOT NULL,
    action                TEXT NOT NULL,
    payload               TEXT NOT NULL,
    created_at            TEXT NOT NULL,
    attempts              INTEGER NOT NULL DEFAULT 0,
    last_error            TEXT,
    UNIQUE(entity_type, entity_id)
);

-- Sync cursors
CREATE TABLE IF NOT EXISTS sync_cursors (
    entity_type           TEXT PRIMARY KEY,
    last_server_updated_at TEXT NOT NULL,
    last_synced_at        TEXT NOT NULL
);
`;

// ---------------------------------------------------------------------------
// Schema v2 — Fasting sessions table
// ---------------------------------------------------------------------------

export const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS fasting_sessions (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL,
    technique             TEXT NOT NULL,
    fasting_hours         INTEGER NOT NULL,
    started_at            TEXT NOT NULL,
    target_end_at         TEXT NOT NULL,
    ended_at              TEXT,
    completed             INTEGER NOT NULL DEFAULT 0,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    deleted_at            TEXT,
    server_updated_at     TEXT,
    last_synced_at        TEXT,
    is_dirty              INTEGER NOT NULL DEFAULT 1,
    created_on_device_id  TEXT,
    updated_on_device_id  TEXT
);

CREATE INDEX IF NOT EXISTS idx_fasting_sessions_user_id ON fasting_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_fasting_sessions_dirty ON fasting_sessions(is_dirty) WHERE is_dirty = 1;
`;

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Initialise the database schema.
 * Uses PRAGMA user_version to track schema version.
 * Idempotent — safe to call on every app launch.
 */
export const initDatabase = async (db: Database): Promise<void> => {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(SCHEMA_V1);
    await db.execAsync("PRAGMA user_version = 1");
  }

  if (currentVersion < 2) {
    await db.execAsync(SCHEMA_V2);
    await db.execAsync("PRAGMA user_version = 2");
  }
};

/**
 * Open the app database and initialise the schema.
 */
export const openAppDatabase = async (): Promise<SQLiteDatabase> => {
  const db = await openDatabaseAsync("countOnMe.db");
  await initDatabase(db);
  return db;
};

/**
 * Delete all data for a specific user across all domain tables.
 * Used by "Reset all data" on Profile screen.
 */
export const clearAllUserData = async (
  db: Database,
  userId: string,
): Promise<void> => {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM fasting_sessions WHERE user_id = ?", userId);
    await db.runAsync("DELETE FROM water_logs WHERE user_id = ?", userId);
    await db.runAsync("DELETE FROM body_weights WHERE user_id = ?", userId);
    await db.runAsync("DELETE FROM user_goals WHERE user_id = ?", userId);
    await db.runAsync("DELETE FROM food_entries WHERE user_id = ?", userId);
    await db.runAsync("DELETE FROM product_portions WHERE user_id = ?", userId);
    await db.runAsync("DELETE FROM products WHERE user_id = ?", userId);
    await db.runAsync("DELETE FROM favourites WHERE user_id = ?", userId);
    await db.runAsync("DELETE FROM recents");
    await db.runAsync("DELETE FROM sync_outbox");
    await db.runAsync("DELETE FROM sync_cursors");
  });
};
