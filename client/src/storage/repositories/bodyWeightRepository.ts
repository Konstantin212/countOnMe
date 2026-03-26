import type { BodyWeightEntry } from "@models/types";
import type { Database } from "../database";

// ---------------------------------------------------------------------------
// Row ↔ BodyWeightEntry mapping
// ---------------------------------------------------------------------------

type BodyWeightRow = {
  id: string;
  user_id: string;
  day: string;
  weight_kg: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_dirty: number;
};

const rowToEntry = (row: BodyWeightRow): BodyWeightEntry => ({
  id: row.id,
  day: row.day,
  weightKg: row.weight_kg,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const bodyWeightRepository = {
  findAll: async (db: Database, userId: string): Promise<BodyWeightEntry[]> => {
    const rows = await db.getAllAsync<BodyWeightRow>(
      "SELECT * FROM body_weights WHERE user_id = ? AND deleted_at IS NULL ORDER BY day DESC",
      [userId],
    );
    return rows.map(rowToEntry);
  },

  findByDay: async (
    db: Database,
    userId: string,
    day: string,
  ): Promise<BodyWeightEntry | null> => {
    const row = await db.getFirstAsync<BodyWeightRow>(
      "SELECT * FROM body_weights WHERE user_id = ? AND day = ? AND deleted_at IS NULL",
      [userId, day],
    );
    return row ? rowToEntry(row) : null;
  },

  upsert: async (
    db: Database,
    userId: string,
    entry: BodyWeightEntry,
  ): Promise<void> => {
    await db.runAsync(
      `INSERT OR REPLACE INTO body_weights (
        id, user_id, day, weight_kg, created_at, updated_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        entry.id,
        userId,
        entry.day,
        entry.weightKg,
        entry.createdAt,
        entry.updatedAt,
      ],
    );
  },

  markDeleted: async (db: Database, id: string): Promise<void> => {
    await db.runAsync(
      "UPDATE body_weights SET deleted_at = ?, is_dirty = 1 WHERE id = ?",
      [new Date().toISOString(), id],
    );
  },

  findDirty: async (db: Database): Promise<BodyWeightEntry[]> => {
    const rows = await db.getAllAsync<BodyWeightRow>(
      "SELECT * FROM body_weights WHERE is_dirty = 1",
    );
    return rows.map(rowToEntry);
  },

  clearDirty: async (db: Database, ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(", ");
    await db.runAsync(
      `UPDATE body_weights SET is_dirty = 0 WHERE id IN (${placeholders})`,
      ids,
    );
  },

  deleteAll: async (db: Database, userId: string): Promise<void> => {
    await db.runAsync("DELETE FROM body_weights WHERE user_id = ?", [userId]);
  },
};
