import { useCallback, useEffect, useRef, useState } from 'react';

import {
  GoalCalculateRequest,
  GoalCalculateResponse,
  GoalCreateCalculatedRequest,
  GoalCreateManualRequest,
  UserGoal,
} from '@models/types';
import {
  calculateGoal as apiCalculateGoal,
  createCalculatedGoal as apiCreateCalculatedGoal,
  createManualGoal as apiCreateManualGoal,
  deleteGoal as apiDeleteGoal,
  getCurrentGoal as apiGetCurrentGoal,
  updateGoal as apiUpdateGoal,
} from '@services/api/goals';
import { clearGoal, loadGoal, saveGoal } from '@storage/storage';
import { enqueue } from '@storage/syncQueue';

export type UseGoalResult = {
  goal: UserGoal | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  calculateGoal: (request: GoalCalculateRequest) => Promise<GoalCalculateResponse>;
  saveCalculatedGoal: (request: GoalCreateCalculatedRequest) => Promise<UserGoal>;
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

export const useGoal = (): UseGoalResult => {
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
      // Try to load from local storage first (offline-first)
      const localGoal = await loadGoal();

      if (isMountedRef.current) {
        goalRef.current = localGoal;
        setGoal(localGoal);
      }

      // Try to sync from backend
      try {
        const remoteGoal = await apiGetCurrentGoal();

        if (isMountedRef.current) {
          if (remoteGoal) {
            goalRef.current = remoteGoal;
            setGoal(remoteGoal);
            // Update local storage with remote data
            await saveGoal(remoteGoal);
          } else if (localGoal) {
            // Local goal exists but not on server - might need to sync
            // For now, keep local goal
          }
        }
      } catch {
        // Backend not available, use local data
        // This is expected in offline-first mode
      }
    } catch (err) {
      console.error('Failed to load goal', err);
      if (isMountedRef.current) {
        setError('Failed to load goal');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const calculateGoal = useCallback(
    async (request: GoalCalculateRequest): Promise<GoalCalculateResponse> => {
      try {
        return await apiCalculateGoal(request);
      } catch (err) {
        console.error('Failed to calculate goal', err);
        // Re-throw with original error details for debugging
        if (err instanceof Error) {
          throw err;
        }
        throw new Error('Failed to calculate goal. Please try again.');
      }
    },
    [],
  );

  const saveCalculatedGoal = useCallback(
    async (request: GoalCreateCalculatedRequest): Promise<UserGoal> => {
      try {
        const newGoal = await apiCreateCalculatedGoal(request);

        if (isMountedRef.current) {
          goalRef.current = newGoal;
          setGoal(newGoal);
        }

        // Save to local storage
        await saveGoal(newGoal);

        // Enqueue for sync (in case of future offline support)
        await enqueue({
          id: `goals.create:${newGoal.id}`,
          resource: 'goals',
          action: 'create',
          payload: { id: newGoal.id, goalType: newGoal.goalType },
        });

        return newGoal;
      } catch (err) {
        console.error('Failed to save calculated goal', err);
        throw new Error('Failed to save goal. Please try again.');
      }
    },
    [],
  );

  const saveManualGoal = useCallback(
    async (request: GoalCreateManualRequest): Promise<UserGoal> => {
      try {
        const newGoal = await apiCreateManualGoal(request);

        if (isMountedRef.current) {
          goalRef.current = newGoal;
          setGoal(newGoal);
        }

        // Save to local storage
        await saveGoal(newGoal);

        // Enqueue for sync
        await enqueue({
          id: `goals.create:${newGoal.id}`,
          resource: 'goals',
          action: 'create',
          payload: { id: newGoal.id, goalType: newGoal.goalType },
        });

        return newGoal;
      } catch (err) {
        console.error('Failed to save manual goal', err);
        throw new Error('Failed to save goal. Please try again.');
      }
    },
    [],
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

      try {
        const updatedGoal = await apiUpdateGoal(currentGoal.id, patch);

        if (isMountedRef.current) {
          goalRef.current = updatedGoal;
          setGoal(updatedGoal);
        }

        // Save to local storage
        await saveGoal(updatedGoal);

        // Enqueue for sync
        await enqueue({
          id: `goals.update:${updatedGoal.id}:${updatedGoal.updatedAt}`,
          resource: 'goals',
          action: 'update',
          payload: { id: updatedGoal.id },
        });

        return updatedGoal;
      } catch (err) {
        console.error('Failed to update goal', err);
        throw new Error('Failed to update goal. Please try again.');
      }
    },
    [],
  );

  const deleteGoalHandler = useCallback(async (): Promise<boolean> => {
    const currentGoal = goalRef.current;
    if (!currentGoal) {
      return false;
    }

    try {
      await apiDeleteGoal(currentGoal.id);

      if (isMountedRef.current) {
        goalRef.current = null;
        setGoal(null);
      }

      // Clear local storage
      await clearGoal();

      // Enqueue for sync
      await enqueue({
        id: `goals.delete:${currentGoal.id}:${new Date().toISOString()}`,
        resource: 'goals',
        action: 'delete',
        payload: { id: currentGoal.id },
      });

      return true;
    } catch (err) {
      console.error('Failed to delete goal', err);
      throw new Error('Failed to delete goal. Please try again.');
    }
  }, []);

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
