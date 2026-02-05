import { useCallback, useEffect, useRef, useState } from 'react';

import { DayStats, MacroTotals, MealTypeKey } from '@models/types';
import { getDayStats, DayStatsResponse } from '@services/api/stats';

export type UseDayStatsResult = {
  stats: DayStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const ZERO_MACROS: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

/**
 * Transform API response (string values) to frontend types (numbers).
 */
const transformResponse = (response: DayStatsResponse): DayStats => {
  const byMealType: Partial<Record<MealTypeKey, MacroTotals>> = {};

  for (const [mealType, totals] of Object.entries(response.by_meal_type)) {
    if (totals) {
      byMealType[mealType as MealTypeKey] = {
        calories: parseFloat(totals.calories) || 0,
        protein: parseFloat(totals.protein) || 0,
        carbs: parseFloat(totals.carbs) || 0,
        fat: parseFloat(totals.fat) || 0,
      };
    }
  }

  return {
    day: response.day,
    totals: {
      calories: parseFloat(response.totals.calories) || 0,
      protein: parseFloat(response.totals.protein) || 0,
      carbs: parseFloat(response.totals.carbs) || 0,
      fat: parseFloat(response.totals.fat) || 0,
    },
    byMealType,
  };
};

/**
 * Get today's date in YYYY-MM-DD format.
 */
const getTodayDate = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Hook to fetch and manage day stats for today.
 * Automatically refreshes when the component mounts or when refresh is called.
 */
export const useDayStats = (): UseDayStatsResult => {
  const [stats, setStats] = useState<DayStats | null>(null);
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
      const today = getTodayDate();
      const response = await getDayStats(today);

      if (isMountedRef.current) {
        setStats(transformResponse(response));
      }
    } catch (err) {
      console.error('Failed to fetch day stats:', err);
      if (isMountedRef.current) {
        // On error, return empty stats so UI can still render
        setStats({
          day: getTodayDate(),
          totals: ZERO_MACROS,
          byMealType: {},
        });
        setError('Failed to load daily stats');
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

  return {
    stats,
    loading,
    error,
    refresh,
  };
};

/**
 * Get macro totals for a specific meal type, or zero if not present.
 */
export const getMealTypeTotals = (
  stats: DayStats | null,
  mealType: MealTypeKey,
): MacroTotals => {
  return stats?.byMealType[mealType] ?? ZERO_MACROS;
};
