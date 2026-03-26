import { describe, expect, it, vi, beforeEach } from "vitest";

import type { BodyWeightEntry } from "@models/types";
import type { Database } from "../database";
import { bodyWeightRepository } from "./bodyWeightRepository";

const createMockDb = (): Database => ({
  execAsync: vi.fn(),
  runAsync: vi.fn(async () => ({ lastInsertRowId: 0, changes: 0 })),
  getFirstAsync: vi.fn(async () => null),
  getAllAsync: vi.fn(async () => []),
  withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => await fn()),
});

const sampleRow = {
  id: "w1",
  user_id: "user-1",
  day: "2025-06-15",
  weight_kg: 80,
  created_at: "2025-06-15T00:00:00.000Z",
  updated_at: "2025-06-15T00:00:00.000Z",
  deleted_at: null,
  is_dirty: 0,
};

describe("bodyWeightRepository", () => {
  let db: Database;

  beforeEach(() => {
    db = createMockDb();
  });

  describe("findAll", () => {
    it("returns entries mapped from rows", async () => {
      (db.getAllAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        sampleRow,
      ]);

      const result = await bodyWeightRepository.findAll(db, "user-1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("w1");
      expect(result[0].weightKg).toBe(80);
    });
  });

  describe("findByDay", () => {
    it("returns entry for specific day", async () => {
      (db.getFirstAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        sampleRow,
      );

      const result = await bodyWeightRepository.findByDay(
        db,
        "user-1",
        "2025-06-15",
      );

      expect(result).not.toBeNull();
      expect(result?.day).toBe("2025-06-15");
    });

    it("returns null when no entry for day", async () => {
      const result = await bodyWeightRepository.findByDay(
        db,
        "user-1",
        "2099-01-01",
      );
      expect(result).toBeNull();
    });
  });

  describe("upsert", () => {
    it("inserts entry with correct parameters", async () => {
      const entry: BodyWeightEntry = {
        id: "w1",
        day: "2025-06-15",
        weightKg: 80,
        createdAt: "2025-06-15T00:00:00.000Z",
        updatedAt: "2025-06-15T00:00:00.000Z",
      };

      await bodyWeightRepository.upsert(db, "user-1", entry);

      expect(db.runAsync).toHaveBeenCalledTimes(1);
      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("INSERT OR REPLACE INTO body_weights");
    });
  });

  describe("markDeleted", () => {
    it("soft-deletes entry", async () => {
      await bodyWeightRepository.markDeleted(db, "w1");

      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("UPDATE body_weights SET deleted_at");
    });
  });

  describe("clearDirty", () => {
    it("does nothing when ids empty", async () => {
      await bodyWeightRepository.clearDirty(db, []);
      expect(db.runAsync).not.toHaveBeenCalled();
    });
  });

  describe("deleteAll", () => {
    it("deletes all for user", async () => {
      await bodyWeightRepository.deleteAll(db, "user-1");

      expect(db.runAsync).toHaveBeenCalledWith(
        "DELETE FROM body_weights WHERE user_id = ?",
        ["user-1"],
      );
    });
  });
});
