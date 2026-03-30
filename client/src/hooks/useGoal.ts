import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

import {
  GoalCalculateRequest,
  GoalCalculateResponse,
  GoalCreateCalculatedRequest,
  GoalCreateManualRequest,
  UserGoal,
} from "@models/types";
import {
  calculateGoal as apiCalculateGoal,
  getCurrentGoal as apiGetCurrentGoal,
} from "@services/api/goals";
import { useDatabaseContext } from "@storage/DatabaseProvider";
import { goalRepository, outboxRepository } from "@storage/repositories";
import { debouncedSync } from "@services/syncEngine";

export type UseGoalResult = {
  goal: UserGoal | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  calculateGoal: (
    request: GoalCalculateRequest,
  ) => Promise<GoalCalculateResponse>;
  saveCalculatedGoal: (
    request: GoalCreateCalculatedRequest,
  ) => Promise<UserGoal>;
  saveManualGoal: (request: GoalCreateManualRequest) => Promise<UserGoal>;
  updateGoal: (patch: {
    dailyCaloriesKcal?: number;
    proteinPercent?: number;
    carbsPercent?: number;
    fatPercent?: number;
    waterMl?: number;
  }) => Promise<UserGoal | null>;
  deleteGoal: () => Promise<boolean>;
};

/** Build full outbox data for a goal upsert. */
const buildGoalOutboxData = (goal: UserGoal): Record<string, unknown> => ({
  goal_type: goal.goalType,
  gender: goal.gender,
  birth_date: goal.birthDate,
  height_cm: goal.heightCm,
  current_weight_kg: goal.currentWeightKg,
  activity_level: goal.activityLevel,
  weight_goal_type: goal.weightGoalType,
  target_weight_kg: goal.targetWeightKg,
  weight_change_pace: goal.weightChangePace,
  bmr_kcal: goal.bmrKcal,
  tdee_kcal: goal.tdeeKcal,
  daily_calories_kcal: goal.dailyCaloriesKcal,
  protein_percent: goal.proteinPercent,
  carbs_percent: goal.carbsPercent,
  fat_percent: goal.fatPercent,
  protein_grams: goal.proteinGrams,
  carbs_grams: goal.carbsGrams,
  fat_grams: goal.fatGrams,
  water_ml: goal.waterMl,
  healthy_weight_min_kg: goal.healthyWeightMinKg,
  healthy_weight_max_kg: goal.healthyWeightMaxKg,
  current_bmi: goal.currentBmi,
  bmi_category: goal.bmiCategory,
  created_at: goal.createdAt,
});

/** Compute macro grams from percent + daily calories. */
const computeGrams = (
  dailyCal: number,
  protPct: number,
  carbsPct: number,
  fatPct: number,
): { proteinGrams: number; carbsGrams: number; fatGrams: number } => ({
  proteinGrams: Math.round((dailyCal * (protPct / 100)) / 4),
  carbsGrams: Math.round((dailyCal * (carbsPct / 100)) / 4),
  fatGrams: Math.round((dailyCal * (fatPct / 100)) / 9),
});

export const useGoal = (): UseGoalResult => {
  const { db, userId } = useDatabaseContext();
  const [goal, setGoal] = useState<UserGoal | null>(null);
  const goalRef = useRef<UserGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const localGoal = await goalRepository.getCurrent(db, userId);

      if (isMountedRef.current) {
        goalRef.current = localGoal;
        setGoal(localGoal);
      }

      try {
        const remoteGoal = await apiGetCurrentGoal();

        if (isMountedRef.current) {
          if (remoteGoal) {
            goalRef.current = remoteGoal;
            setGoal(remoteGoal);
            await db.withTransactionAsync(async () => {
              await goalRepository.upsert(db, userId, remoteGoal);
            });
          }
        }
      } catch {
        // Backend not available, use local data
      }
    } catch {
      if (isMountedRef.current) {
        setError("Failed to load goal");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [db, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const calculateGoal = useCallback(
    async (request: GoalCalculateRequest): Promise<GoalCalculateResponse> => {
      try {
        return await apiCalculateGoal(request);
      } catch (err) {
        // Re-throw with original error details for debugging
        if (err instanceof Error) {
          throw err;
        }
        throw new Error("Failed to calculate goal. Please try again.");
      }
    },
    [],
  );

  const saveCalculatedGoal = useCallback(
    async (request: GoalCreateCalculatedRequest): Promise<UserGoal> => {
      const timestamp = new Date().toISOString();
      const grams = computeGrams(
        request.proteinPercent ?? 30,
        request.proteinPercent ?? 30,
        request.carbsPercent ?? 40,
        request.fatPercent ?? 30,
      );

      // NOTE: For calculated goals, the server computes the full result.
      // Offline we create a best-effort local entity; the sync push will
      // reconcile with the server-calculated values on next pull.
      const newGoal: UserGoal = {
        id: request.id ?? uuid(),
        goalType: "calculated",
        gender: request.gender,
        birthDate: request.birthDate,
        heightCm: request.heightCm,
        currentWeightKg: request.currentWeightKg,
        activityLevel: request.activityLevel,
        weightGoalType: request.weightGoalType,
        targetWeightKg: request.targetWeightKg,
        weightChangePace: request.weightChangePace,
        dailyCaloriesKcal: 0, // Will be filled by server on sync
        proteinPercent: request.proteinPercent ?? 30,
        carbsPercent: request.carbsPercent ?? 40,
        fatPercent: request.fatPercent ?? 30,
        proteinGrams: grams.proteinGrams,
        carbsGrams: grams.carbsGrams,
        fatGrams: grams.fatGrams,
        waterMl: request.waterMl ?? 2000,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      goalRef.current = newGoal;
      if (isMountedRef.current) {
        setGoal(newGoal);
      }

      try {
        await goalRepository.upsert(db, userId, newGoal);
        await outboxRepository.enqueue(db, {
          id: `user_goal:${newGoal.id}`,
          entityType: "user_goal",
          action: "upsert",
          entityId: newGoal.id,
          data: buildGoalOutboxData(newGoal),
          updatedAt: newGoal.updatedAt,
        });
        debouncedSync();
      } catch {
        // Storage failure -- state already updated optimistically
      }

      return newGoal;
    },
    [db, userId],
  );

  const saveManualGoal = useCallback(
    async (request: GoalCreateManualRequest): Promise<UserGoal> => {
      const timestamp = new Date().toISOString();
      const grams = computeGrams(
        request.dailyCaloriesKcal,
        request.proteinPercent,
        request.carbsPercent,
        request.fatPercent,
      );

      const newGoal: UserGoal = {
        id: request.id ?? uuid(),
        goalType: "manual",
        dailyCaloriesKcal: request.dailyCaloriesKcal,
        proteinPercent: request.proteinPercent,
        carbsPercent: request.carbsPercent,
        fatPercent: request.fatPercent,
        proteinGrams: grams.proteinGrams,
        carbsGrams: grams.carbsGrams,
        fatGrams: grams.fatGrams,
        waterMl: request.waterMl,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      goalRef.current = newGoal;
      if (isMountedRef.current) {
        setGoal(newGoal);
      }

      try {
        await goalRepository.upsert(db, userId, newGoal);
        await outboxRepository.enqueue(db, {
          id: `user_goal:${newGoal.id}`,
          entityType: "user_goal",
          action: "upsert",
          entityId: newGoal.id,
          data: buildGoalOutboxData(newGoal),
          updatedAt: newGoal.updatedAt,
        });
        debouncedSync();
      } catch {
        // Storage failure -- state already updated optimistically
      }

      return newGoal;
    },
    [db, userId],
  );

  const updateGoalHandler = useCallback(
    async (patch: {
      dailyCaloriesKcal?: number;
      proteinPercent?: number;
      carbsPercent?: number;
      fatPercent?: number;
      waterMl?: number;
    }): Promise<UserGoal | null> => {
      const currentGoal = goalRef.current;
      if (!currentGoal) {
        return null;
      }

      const timestamp = new Date().toISOString();
      const dailyCal = patch.dailyCaloriesKcal ?? currentGoal.dailyCaloriesKcal;
      const protPct = patch.proteinPercent ?? currentGoal.proteinPercent;
      const carbsPct = patch.carbsPercent ?? currentGoal.carbsPercent;
      const fatPct = patch.fatPercent ?? currentGoal.fatPercent;
      const grams = computeGrams(dailyCal, protPct, carbsPct, fatPct);

      const updatedGoal: UserGoal = {
        ...currentGoal,
        dailyCaloriesKcal: dailyCal,
        proteinPercent: protPct,
        carbsPercent: carbsPct,
        fatPercent: fatPct,
        proteinGrams: grams.proteinGrams,
        carbsGrams: grams.carbsGrams,
        fatGrams: grams.fatGrams,
        waterMl: patch.waterMl ?? currentGoal.waterMl,
        updatedAt: timestamp,
      };

      goalRef.current = updatedGoal;
      if (isMountedRef.current) {
        setGoal(updatedGoal);
      }

      try {
        await goalRepository.upsert(db, userId, updatedGoal);
        await outboxRepository.enqueue(db, {
          id: `user_goal:${updatedGoal.id}`,
          entityType: "user_goal",
          action: "upsert",
          entityId: updatedGoal.id,
          data: buildGoalOutboxData(updatedGoal),
          updatedAt: updatedGoal.updatedAt,
        });
        debouncedSync();
      } catch {
        // Storage failure -- state already updated optimistically
      }

      return updatedGoal;
    },
    [db, userId],
  );

  const deleteGoalHandler = useCallback(async (): Promise<boolean> => {
    const currentGoal = goalRef.current;
    if (!currentGoal) {
      return false;
    }

    goalRef.current = null;
    if (isMountedRef.current) {
      setGoal(null);
    }

    try {
      await goalRepository.remove(db, currentGoal.id);
      await outboxRepository.enqueue(db, {
        id: `user_goal:${currentGoal.id}`,
        entityType: "user_goal",
        action: "delete",
        entityId: currentGoal.id,
        data: null,
        updatedAt: new Date().toISOString(),
      });
      debouncedSync();
    } catch {
      // Storage failure -- state already updated optimistically
    }

    return true;
  }, [db, userId]);

  return {
    goal,
    loading,
    error,
    refresh,
    calculateGoal,
    saveCalculatedGoal,
    saveManualGoal,
    updateGoal: updateGoalHandler,
    deleteGoal: deleteGoalHandler,
  };
};
