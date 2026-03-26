import type { OutboxEntry } from "../outbox";
import type { Database } from "../database";

// ---------------------------------------------------------------------------
// Row ↔ OutboxEntry mapping
// ---------------------------------------------------------------------------

type OutboxRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  payload: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
};

const rowToEntry = (row: OutboxRow): OutboxEntry => ({
  id: row.id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  action: row.action as OutboxEntry["action"],
  data: JSON.parse(row.payload),
  updatedAt: row.created_at,
  createdAt: new Date(row.created_at).getTime(),
  attempts: row.attempts,
  lastError: row.last_error ?? undefined,
});

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const outboxRepository = {
  /**
   * Enqueue a mutation. Deduplicates by entity_type + entity_id.
   */
  enqueue: async (
    db: Database,
    entry: Omit<OutboxEntry, "createdAt" | "attempts">,
  ): Promise<void> => {
    const payload = JSON.stringify(entry.data);
    const createdAt = new Date().toISOString();

    await db.runAsync(
      `INSERT OR REPLACE INTO sync_outbox (
        id, entity_type, entity_id, action, payload, created_at, attempts
      ) VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [
        entry.id,
        entry.entityType,
        entry.entityId,
        entry.action,
        payload,
        createdAt,
      ],
    );
  },

  /**
   * Load all pending entries, sorted by created_at ascending.
   */
  loadAll: async (db: Database): Promise<OutboxEntry[]> => {
    const rows = await db.getAllAsync<OutboxRow>(
      "SELECT * FROM sync_outbox ORDER BY created_at ASC",
    );
    return rows.map(rowToEntry);
  },

  /**
   * Remove entries by their ids.
   */
  remove: async (db: Database, ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(", ");
    await db.runAsync(
      `DELETE FROM sync_outbox WHERE id IN (${placeholders})`,
      ids,
    );
  },

  /**
   * Mark an entry as failed, incrementing attempts.
   */
  markFailed: async (
    db: Database,
    id: string,
    error: string,
  ): Promise<void> => {
    await db.runAsync(
      "UPDATE sync_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?",
      [error, id],
    );
  },

  /**
   * Clear all outbox entries.
   */
  clear: async (db: Database): Promise<void> => {
    await db.runAsync("DELETE FROM sync_outbox");
  },

  /**
   * Get the count of pending entries.
   */
  count: async (db: Database): Promise<number> => {
    const row = await db.getFirstAsync<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM sync_outbox",
    );
    return row?.cnt ?? 0;
  },
};
