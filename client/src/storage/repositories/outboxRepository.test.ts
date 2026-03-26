import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Database } from "../database";
import { outboxRepository } from "./outboxRepository";

const createMockDb = (): Database => ({
  execAsync: vi.fn(),
  runAsync: vi.fn(async () => ({ lastInsertRowId: 0, changes: 0 })),
  getFirstAsync: vi.fn(async () => null),
  getAllAsync: vi.fn(async () => []),
  withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => await fn()),
});

const sampleRow = {
  id: "product:p1",
  entity_type: "product",
  entity_id: "p1",
  action: "upsert",
  payload: '{"name":"Chicken"}',
  created_at: "2025-06-15T08:00:00.000Z",
  attempts: 0,
  last_error: null,
};

describe("outboxRepository", () => {
  let db: Database;

  beforeEach(() => {
    db = createMockDb();
  });

  describe("enqueue", () => {
    it("inserts entry with correct SQL", async () => {
      await outboxRepository.enqueue(db, {
        id: "product:p1",
        entityType: "product",
        entityId: "p1",
        action: "upsert",
        data: { name: "Chicken" },
        updatedAt: "2025-06-15T08:00:00.000Z",
      });

      expect(db.runAsync).toHaveBeenCalledTimes(1);
      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("INSERT OR REPLACE INTO sync_outbox");
      expect(call[1][0]).toBe("product:p1");
    });
  });

  describe("loadAll", () => {
    it("returns entries mapped from rows", async () => {
      (db.getAllAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        sampleRow,
      ]);

      const result = await outboxRepository.loadAll(db);

      expect(result).toHaveLength(1);
      expect(result[0].entityType).toBe("product");
      expect(result[0].data).toEqual({ name: "Chicken" });
    });
  });

  describe("remove", () => {
    it("deletes entries by ids", async () => {
      await outboxRepository.remove(db, ["id1", "id2"]);

      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("DELETE FROM sync_outbox WHERE id IN");
    });

    it("does nothing when ids empty", async () => {
      await outboxRepository.remove(db, []);
      expect(db.runAsync).not.toHaveBeenCalled();
    });
  });

  describe("markFailed", () => {
    it("increments attempts and sets error", async () => {
      await outboxRepository.markFailed(db, "product:p1", "Network error");

      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("attempts = attempts + 1");
      expect(call[1][0]).toBe("Network error");
      expect(call[1][1]).toBe("product:p1");
    });
  });

  describe("clear", () => {
    it("deletes all entries", async () => {
      await outboxRepository.clear(db);

      expect(db.runAsync).toHaveBeenCalledWith("DELETE FROM sync_outbox");
    });
  });

  describe("count", () => {
    it("returns count from query", async () => {
      (db.getFirstAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        cnt: 5,
      });

      const result = await outboxRepository.count(db);
      expect(result).toBe(5);
    });

    it("returns 0 when no result", async () => {
      const result = await outboxRepository.count(db);
      expect(result).toBe(0);
    });
  });
});
