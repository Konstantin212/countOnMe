import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Database } from "../database";
import { goalRepository } from "./goalRepository";
import { makeUserGoal } from "../../test/helpers";

const createMockDb = (): Database => ({
  execAsync: vi.fn(),
  runAsync: vi.fn(async () => ({ lastInsertRowId: 0, changes: 0 })),
  getFirstAsync: vi.fn(async () => null),
  getAllAsync: vi.fn(async () => []),
  withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => await fn()),
});

const sampleRow = {
  id: "goal-1",
  user_id: "user-1",
  goal_type: "manual",
  gender: null,
  birth_date: null,
  height_cm: null,
  current_weight_kg: null,
  activity_level: null,
  weight_goal_type: null,
  target_weight_kg: null,
  weight_change_pace: null,
  bmr_kcal: null,
  tdee_kcal: null,
  daily_calories_kcal: 2000,
  protein_percent: 30,
  carbs_percent: 40,
  fat_percent: 30,
  protein_grams: 150,
  carbs_grams: 200,
  fat_grams: 67,
  water_ml: 2000,
  healthy_weight_min_kg: null,
  healthy_weight_max_kg: null,
  current_bmi: null,
  bmi_category: null,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  deleted_at: null,
  is_dirty: 0,
};

describe("goalRepository", () => {
  let db: Database;

  beforeEach(() => {
    db = createMockDb();
  });

  describe("getCurrent", () => {
    it("returns goal when found", async () => {
      (db.getFirstAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        sampleRow,
      );

      const result = await goalRepository.getCurrent(db, "user-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("goal-1");
      expect(result?.dailyCaloriesKcal).toBe(2000);
      expect(result?.goalType).toBe("manual");
    });

    it("returns null when no goal exists", async () => {
      const result = await goalRepository.getCurrent(db, "user-1");
      expect(result).toBeNull();
    });
  });

  describe("upsert", () => {
    it("inserts goal with correct parameters", async () => {
      const goal = makeUserGoal();

      await goalRepository.upsert(db, "user-1", goal);

      expect(db.runAsync).toHaveBeenCalledTimes(1);
      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("INSERT OR REPLACE INTO user_goals");
      expect(call[1][0]).toBe(goal.id);
      expect(call[1][1]).toBe("user-1");
    });
  });

  describe("remove", () => {
    it("soft-deletes goal", async () => {
      await goalRepository.remove(db, "goal-1");

      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("UPDATE user_goals SET deleted_at");
      expect(call[1][1]).toBe("goal-1");
    });
  });

  describe("findDirty", () => {
    it("returns dirty goals", async () => {
      (db.getAllAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { ...sampleRow, is_dirty: 1 },
      ]);

      const result = await goalRepository.findDirty(db);

      expect(result).toHaveLength(1);
    });
  });

  describe("clearDirty", () => {
    it("clears dirty flag", async () => {
      await goalRepository.clearDirty(db, ["goal-1"]);

      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("UPDATE user_goals SET is_dirty = 0");
    });

    it("does nothing when ids empty", async () => {
      await goalRepository.clearDirty(db, []);
      expect(db.runAsync).not.toHaveBeenCalled();
    });
  });

  describe("deleteAll", () => {
    it("deletes all goals for user", async () => {
      await goalRepository.deleteAll(db, "user-1");

      expect(db.runAsync).toHaveBeenCalledWith(
        "DELETE FROM user_goals WHERE user_id = ?",
        ["user-1"],
      );
    });
  });
});
