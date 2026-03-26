import type { UserGoal } from "@models/types";
import type { Database } from "../database";

// ---------------------------------------------------------------------------
// Row ↔ UserGoal mapping
// ---------------------------------------------------------------------------

type GoalRow = {
  id: string;
  user_id: string;
  goal_type: string;
  gender: string | null;
  birth_date: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  activity_level: string | null;
  weight_goal_type: string | null;
  target_weight_kg: number | null;
  weight_change_pace: string | null;
  bmr_kcal: number | null;
  tdee_kcal: number | null;
  daily_calories_kcal: number;
  protein_percent: number;
  carbs_percent: number;
  fat_percent: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  water_ml: number;
  healthy_weight_min_kg: number | null;
  healthy_weight_max_kg: number | null;
  current_bmi: number | null;
  bmi_category: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_dirty: number;
};

const rowToGoal = (row: GoalRow): UserGoal => ({
  id: row.id,
  goalType: row.goal_type as UserGoal["goalType"],
  gender: (row.gender as UserGoal["gender"]) ?? undefined,
  birthDate: row.birth_date ?? undefined,
  heightCm: row.height_cm ?? undefined,
  currentWeightKg: row.current_weight_kg ?? undefined,
  activityLevel: (row.activity_level as UserGoal["activityLevel"]) ?? undefined,
  weightGoalType:
    (row.weight_goal_type as UserGoal["weightGoalType"]) ?? undefined,
  targetWeightKg: row.target_weight_kg ?? undefined,
  weightChangePace:
    (row.weight_change_pace as UserGoal["weightChangePace"]) ?? undefined,
  bmrKcal: row.bmr_kcal ?? undefined,
  tdeeKcal: row.tdee_kcal ?? undefined,
  dailyCaloriesKcal: row.daily_calories_kcal,
  proteinPercent: row.protein_percent,
  carbsPercent: row.carbs_percent,
  fatPercent: row.fat_percent,
  proteinGrams: row.protein_grams,
  carbsGrams: row.carbs_grams,
  fatGrams: row.fat_grams,
  waterMl: row.water_ml,
  healthyWeightMinKg: row.healthy_weight_min_kg ?? undefined,
  healthyWeightMaxKg: row.healthy_weight_max_kg ?? undefined,
  currentBmi: row.current_bmi ?? undefined,
  bmiCategory: (row.bmi_category as UserGoal["bmiCategory"]) ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const goalRepository = {
  getCurrent: async (
    db: Database,
    userId: string,
  ): Promise<UserGoal | null> => {
    const row = await db.getFirstAsync<GoalRow>(
      "SELECT * FROM user_goals WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1",
      [userId],
    );
    return row ? rowToGoal(row) : null;
  },

  upsert: async (
    db: Database,
    userId: string,
    goal: UserGoal,
  ): Promise<void> => {
    await db.runAsync(
      `INSERT OR REPLACE INTO user_goals (
        id, user_id, goal_type, gender, birth_date, height_cm, current_weight_kg,
        activity_level, weight_goal_type, target_weight_kg, weight_change_pace,
        bmr_kcal, tdee_kcal, daily_calories_kcal, protein_percent, carbs_percent, fat_percent,
        protein_grams, carbs_grams, fat_grams, water_ml,
        healthy_weight_min_kg, healthy_weight_max_kg, current_bmi, bmi_category,
        created_at, updated_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        goal.id,
        userId,
        goal.goalType,
        goal.gender ?? null,
        goal.birthDate ?? null,
        goal.heightCm ?? null,
        goal.currentWeightKg ?? null,
        goal.activityLevel ?? null,
        goal.weightGoalType ?? null,
        goal.targetWeightKg ?? null,
        goal.weightChangePace ?? null,
        goal.bmrKcal ?? null,
        goal.tdeeKcal ?? null,
        goal.dailyCaloriesKcal,
        goal.proteinPercent,
        goal.carbsPercent,
        goal.fatPercent,
        goal.proteinGrams,
        goal.carbsGrams,
        goal.fatGrams,
        goal.waterMl,
        goal.healthyWeightMinKg ?? null,
        goal.healthyWeightMaxKg ?? null,
        goal.currentBmi ?? null,
        goal.bmiCategory ?? null,
        goal.createdAt,
        goal.updatedAt,
      ],
    );
  },

  remove: async (db: Database, id: string): Promise<void> => {
    await db.runAsync(
      "UPDATE user_goals SET deleted_at = ?, is_dirty = 1 WHERE id = ?",
      [new Date().toISOString(), id],
    );
  },

  findDirty: async (db: Database): Promise<UserGoal[]> => {
    const rows = await db.getAllAsync<GoalRow>(
      "SELECT * FROM user_goals WHERE is_dirty = 1",
    );
    return rows.map(rowToGoal);
  },

  clearDirty: async (db: Database, ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(", ");
    await db.runAsync(
      `UPDATE user_goals SET is_dirty = 0 WHERE id IN (${placeholders})`,
      ids,
    );
  },

  deleteAll: async (db: Database, userId: string): Promise<void> => {
    await db.runAsync("DELETE FROM user_goals WHERE user_id = ?", [userId]);
  },
};
