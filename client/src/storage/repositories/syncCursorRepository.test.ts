import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Database } from "../database";
import { syncCursorRepository } from "./syncCursorRepository";

const createMockDb = (): Database => ({
  execAsync: vi.fn(),
  runAsync: vi.fn(async () => ({ lastInsertRowId: 0, changes: 0 })),
  getFirstAsync: vi.fn(async () => null),
  getAllAsync: vi.fn(async () => []),
  withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => await fn()),
});

describe("syncCursorRepository", () => {
  let db: Database;

  beforeEach(() => {
    db = createMockDb();
  });

  describe("getCursor", () => {
    it("returns 0 when no cursor exists", async () => {
      const result = await syncCursorRepository.getCursor(db, "all");
      expect(result).toBe(0);
    });

    it("returns numeric value when cursor exists", async () => {
      (db.getFirstAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        entity_type: "all",
        last_server_updated_at: "42",
        last_synced_at: "2025-06-15T00:00:00.000Z",
      });

      const result = await syncCursorRepository.getCursor(db, "all");
      expect(result).toBe(42);
    });
  });

  describe("setCursor", () => {
    it("inserts or replaces cursor row", async () => {
      await syncCursorRepository.setCursor(db, "all", 42);

      expect(db.runAsync).toHaveBeenCalledTimes(1);
      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("INSERT OR REPLACE INTO sync_cursors");
      expect(call[1][0]).toBe("all");
      expect(call[1][1]).toBe("42");
    });
  });
});
