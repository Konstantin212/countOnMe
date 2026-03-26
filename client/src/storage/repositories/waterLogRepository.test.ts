import { describe, expect, it, vi, beforeEach } from "vitest";

import type { WaterLog } from "@models/types";
import type { Database } from "../database";
import { waterLogRepository } from "./waterLogRepository";

const createMockDb = (): Database => ({
  execAsync: vi.fn(),
  runAsync: vi.fn(async () => ({ lastInsertRowId: 0, changes: 0 })),
  getFirstAsync: vi.fn(async () => null),
  getAllAsync: vi.fn(async () => []),
  withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => await fn()),
});

const sampleRow = {
  id: "wl-1",
  user_id: "user-1",
  day: "2025-06-15",
  amount_ml: 250,
  created_at: "2025-06-15T08:00:00.000Z",
  updated_at: "2025-06-15T08:00:00.000Z",
  deleted_at: null,
  is_dirty: 0,
};

describe("waterLogRepository", () => {
  let db: Database;

  beforeEach(() => {
    db = createMockDb();
  });

  describe("findAll", () => {
    it("returns logs mapped from rows", async () => {
      (db.getAllAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        sampleRow,
      ]);

      const result = await waterLogRepository.findAll(db, "user-1");

      expect(result).toHaveLength(1);
      expect(result[0].amountMl).toBe(250);
    });
  });

  describe("findByDay", () => {
    it("returns logs for specific day", async () => {
      (db.getAllAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        sampleRow,
      ]);

      const result = await waterLogRepository.findByDay(
        db,
        "user-1",
        "2025-06-15",
      );

      expect(result).toHaveLength(1);
      expect(result[0].day).toBe("2025-06-15");
    });
  });

  describe("upsert", () => {
    it("inserts log with correct parameters", async () => {
      const log: WaterLog = {
        id: "wl-1",
        day: "2025-06-15",
        amountMl: 250,
        createdAt: "2025-06-15T08:00:00.000Z",
        updatedAt: "2025-06-15T08:00:00.000Z",
      };

      await waterLogRepository.upsert(db, "user-1", log);

      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("INSERT OR REPLACE INTO water_logs");
    });
  });

  describe("markDeleted", () => {
    it("soft-deletes log", async () => {
      await waterLogRepository.markDeleted(db, "wl-1");

      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("UPDATE water_logs SET deleted_at");
    });
  });

  describe("deleteAll", () => {
    it("deletes all for user", async () => {
      await waterLogRepository.deleteAll(db, "user-1");

      expect(db.runAsync).toHaveBeenCalledWith(
        "DELETE FROM water_logs WHERE user_id = ?",
        ["user-1"],
      );
    });
  });
});
