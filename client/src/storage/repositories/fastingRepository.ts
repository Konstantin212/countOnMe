import type { FastingSession } from "@models/types";
import type { Database } from "../database";

// ---------------------------------------------------------------------------
// Row <-> FastingSession mapping
// ---------------------------------------------------------------------------

type FastingSessionRow = {
  id: string;
  user_id: string;
  technique: string;
  fasting_hours: number;
  started_at: string;
  target_end_at: string;
  ended_at: string | null;
  completed: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_dirty: number;
};

const rowToSession = (row: FastingSessionRow): FastingSession => ({
  id: row.id,
  technique: row.technique as FastingSession["technique"],
  fastingHours: row.fasting_hours,
  startedAt: row.started_at,
  targetEndAt: row.target_end_at,
  endedAt: row.ended_at,
  completed: row.completed === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const fastingRepository = {
  findAll: async (db: Database, userId: string): Promise<FastingSession[]> => {
    const rows = await db.getAllAsync<FastingSessionRow>(
      "SELECT * FROM fasting_sessions WHERE user_id = ? AND deleted_at IS NULL ORDER BY started_at DESC",
      [userId],
    );
    return rows.map(rowToSession);
  },

  findActive: async (
    db: Database,
    userId: string,
  ): Promise<FastingSession | null> => {
    const row = await db.getFirstAsync<FastingSessionRow>(
      "SELECT * FROM fasting_sessions WHERE user_id = ? AND ended_at IS NULL AND deleted_at IS NULL ORDER BY started_at DESC LIMIT 1",
      [userId],
    );
    return row ? rowToSession(row) : null;
  },

  upsert: async (
    db: Database,
    userId: string,
    session: FastingSession,
  ): Promise<void> => {
    await db.runAsync(
      `INSERT OR REPLACE INTO fasting_sessions (
        id, user_id, technique, fasting_hours, started_at, target_end_at,
        ended_at, completed, created_at, updated_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        session.id,
        userId,
        session.technique,
        session.fastingHours,
        session.startedAt,
        session.targetEndAt,
        session.endedAt,
        session.completed ? 1 : 0,
        session.createdAt,
        session.updatedAt,
      ],
    );
  },

  markDeleted: async (db: Database, id: string): Promise<void> => {
    await db.runAsync(
      "UPDATE fasting_sessions SET deleted_at = ?, is_dirty = 1 WHERE id = ?",
      [new Date().toISOString(), id],
    );
  },

  findDirty: async (db: Database): Promise<FastingSession[]> => {
    const rows = await db.getAllAsync<FastingSessionRow>(
      "SELECT * FROM fasting_sessions WHERE is_dirty = 1",
    );
    return rows.map(rowToSession);
  },

  clearDirty: async (db: Database, ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(", ");
    await db.runAsync(
      `UPDATE fasting_sessions SET is_dirty = 0 WHERE id IN (${placeholders})`,
      ids,
    );
  },

  deleteAll: async (db: Database, userId: string): Promise<void> => {
    await db.runAsync("DELETE FROM fasting_sessions WHERE user_id = ?", [
      userId,
    ]);
  },
};
