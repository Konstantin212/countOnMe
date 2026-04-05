import { describe, expect, it, vi, beforeEach } from "vitest";

import type { FastingSession } from "@models/types";
import type { Database } from "../database";
import { fastingRepository } from "./fastingRepository";

const createMockDb = (): Database => ({
  execAsync: vi.fn(),
  runAsync: vi.fn(async () => ({ lastInsertRowId: 0, changes: 0 })),
  getFirstAsync: vi.fn(async () => null),
  getAllAsync: vi.fn(async () => []),
  withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => await fn()),
});

const sampleRow = {
  id: "fs1",
  user_id: "user-1",
  technique: "16:8",
  fasting_hours: 16,
  started_at: "2026-04-01T20:00:00.000Z",
  target_end_at: "2026-04-02T12:00:00.000Z",
  ended_at: null,
  paused_at: null,
  completed: 0,
  created_at: "2026-04-01T20:00:00.000Z",
  updated_at: "2026-04-01T20:00:00.000Z",
  deleted_at: null,
  is_dirty: 0,
};

describe("fastingRepository", () => {
  let db: Database;

  beforeEach(() => {
    db = createMockDb();
  });

  describe("findAll", () => {
    it("returns sessions mapped from rows", async () => {
      (db.getAllAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        sampleRow,
      ]);

      const result = await fastingRepository.findAll(db, "user-1");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("fs1");
      expect(result[0].technique).toBe("16:8");
      expect(result[0].fastingHours).toBe(16);
      expect(result[0].completed).toBe(false);
      expect(result[0].endedAt).toBeNull();
    });

    it("returns empty array when no sessions", async () => {
      const result = await fastingRepository.findAll(db, "user-1");
      expect(result).toEqual([]);
    });
  });

  describe("findActive", () => {
    it("returns active session when one exists", async () => {
      (db.getFirstAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        sampleRow,
      );

      const result = await fastingRepository.findActive(db, "user-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("fs1");
      expect(result?.endedAt).toBeNull();
    });

    it("returns null when no active session", async () => {
      const result = await fastingRepository.findActive(db, "user-1");
      expect(result).toBeNull();
    });
  });

  describe("upsert", () => {
    it("inserts session with correct parameters", async () => {
      const session: FastingSession = {
        id: "fs1",
        technique: "16:8",
        fastingHours: 16,
        startedAt: "2026-04-01T20:00:00.000Z",
        targetEndAt: "2026-04-02T12:00:00.000Z",
        endedAt: null,
        pausedAt: null,
        completed: false,
        createdAt: "2026-04-01T20:00:00.000Z",
        updatedAt: "2026-04-01T20:00:00.000Z",
      };

      await fastingRepository.upsert(db, "user-1", session);

      expect(db.runAsync).toHaveBeenCalledTimes(1);
      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("INSERT OR REPLACE INTO fasting_sessions");
    });

    it("maps completed boolean to integer", async () => {
      const session: FastingSession = {
        id: "fs1",
        technique: "16:8",
        fastingHours: 16,
        startedAt: "2026-04-01T20:00:00.000Z",
        targetEndAt: "2026-04-02T12:00:00.000Z",
        endedAt: "2026-04-02T12:30:00.000Z",
        pausedAt: null,
        completed: true,
        createdAt: "2026-04-01T20:00:00.000Z",
        updatedAt: "2026-04-02T12:30:00.000Z",
      };

      await fastingRepository.upsert(db, "user-1", session);

      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      // completed is the 8th parameter (index 7 in the array)
      const params = call[1];
      expect(params).toContain(1); // true mapped to 1
    });
  });

  describe("markDeleted", () => {
    it("soft-deletes session", async () => {
      await fastingRepository.markDeleted(db, "fs1");

      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("UPDATE fasting_sessions SET deleted_at");
    });
  });

  describe("findDirty", () => {
    it("returns dirty sessions", async () => {
      const dirtyRow = { ...sampleRow, is_dirty: 1 };
      (db.getAllAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        dirtyRow,
      ]);

      const result = await fastingRepository.findDirty(db);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("fs1");
    });
  });

  describe("clearDirty", () => {
    it("does nothing when ids empty", async () => {
      await fastingRepository.clearDirty(db, []);
      expect(db.runAsync).not.toHaveBeenCalled();
    });

    it("clears dirty flag for given ids", async () => {
      await fastingRepository.clearDirty(db, ["fs1", "fs2"]);

      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("UPDATE fasting_sessions SET is_dirty = 0");
      expect(call[0]).toContain("?, ?");
      expect(call[1]).toEqual(["fs1", "fs2"]);
    });
  });

  describe("deleteAll", () => {
    it("deletes all for user", async () => {
      await fastingRepository.deleteAll(db, "user-1");

      expect(db.runAsync).toHaveBeenCalledWith(
        "DELETE FROM fasting_sessions WHERE user_id = ?",
        ["user-1"],
      );
    });
  });
});
