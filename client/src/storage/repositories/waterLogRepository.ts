import type { WaterLog } from "@models/types";
import type { Database } from "../database";

// ---------------------------------------------------------------------------
// Row ↔ WaterLog mapping
// ---------------------------------------------------------------------------

type WaterLogRow = {
  id: string;
  user_id: string;
  day: string;
  amount_ml: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_dirty: number;
};

const rowToLog = (row: WaterLogRow): WaterLog => ({
  id: row.id,
  day: row.day,
  amountMl: row.amount_ml,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const waterLogRepository = {
  findAll: async (db: Database, userId: string): Promise<WaterLog[]> => {
    const rows = await db.getAllAsync<WaterLogRow>(
      "SELECT * FROM water_logs WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC",
      [userId],
    );
    return rows.map(rowToLog);
  },

  findByDay: async (
    db: Database,
    userId: string,
    day: string,
  ): Promise<WaterLog[]> => {
    const rows = await db.getAllAsync<WaterLogRow>(
      "SELECT * FROM water_logs WHERE user_id = ? AND day = ? AND deleted_at IS NULL ORDER BY created_at ASC",
      [userId, day],
    );
    return rows.map(rowToLog);
  },

  upsert: async (
    db: Database,
    userId: string,
    log: WaterLog,
  ): Promise<void> => {
    await db.runAsync(
      `INSERT OR REPLACE INTO water_logs (
        id, user_id, day, amount_ml, created_at, updated_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [log.id, userId, log.day, log.amountMl, log.createdAt, log.updatedAt],
    );
  },

  markDeleted: async (db: Database, id: string): Promise<void> => {
    await db.runAsync(
      "UPDATE water_logs SET deleted_at = ?, is_dirty = 1 WHERE id = ?",
      [new Date().toISOString(), id],
    );
  },

  findDirty: async (db: Database): Promise<WaterLog[]> => {
    const rows = await db.getAllAsync<WaterLogRow>(
      "SELECT * FROM water_logs WHERE is_dirty = 1",
    );
    return rows.map(rowToLog);
  },

  clearDirty: async (db: Database, ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(", ");
    await db.runAsync(
      `UPDATE water_logs SET is_dirty = 0 WHERE id IN (${placeholders})`,
      ids,
    );
  },

  deleteAll: async (db: Database, userId: string): Promise<void> => {
    await db.runAsync("DELETE FROM water_logs WHERE user_id = ?", [userId]);
  },
};
