import type { Database } from "../database";

// ---------------------------------------------------------------------------
// Row type
// ---------------------------------------------------------------------------

type CursorRow = {
  entity_type: string;
  last_server_updated_at: string;
  last_synced_at: string;
};

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const syncCursorRepository = {
  /**
   * Get the sync cursor value for a given entity type.
   * Returns 0 if no cursor exists (numeric, for compatibility with current sync engine).
   */
  getCursor: async (db: Database, entityType: string): Promise<number> => {
    const row = await db.getFirstAsync<CursorRow>(
      "SELECT * FROM sync_cursors WHERE entity_type = ?",
      [entityType],
    );
    if (!row) return 0;
    const parsed = Number(row.last_server_updated_at);
    return Number.isFinite(parsed) ? parsed : 0;
  },

  /**
   * Set the sync cursor for a given entity type.
   */
  setCursor: async (
    db: Database,
    entityType: string,
    version: number,
  ): Promise<void> => {
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_cursors (entity_type, last_server_updated_at, last_synced_at)
       VALUES (?, ?, ?)`,
      [entityType, String(version), new Date().toISOString()],
    );
  },
};
