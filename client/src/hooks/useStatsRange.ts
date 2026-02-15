import { useCallback, useEffect, useState } from "react";

import type { DailyStatsPoint, StatsPeriod } from "@models/types";
import { getDailyStats } from "@services/api/stats";
import { getDateRange } from "@services/utils/insights";

export type UseStatsRangeResult = {
  dailyStats: DailyStatsPoint[];
  period: StatsPeriod;
  loading: boolean;
  error: string | null;
  setPeriod: (period: StatsPeriod) => void;
  refresh: () => Promise<void>;
};

export const useStatsRange = (): UseStatsRangeResult => {
  const [dailyStats, setDailyStats] = useState<DailyStatsPoint[]>([]);
  const [period, setPeriod] = useState<StatsPeriod>("7d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (currentPeriod: StatsPeriod) => {
    setLoading(true);
    setError(null);

    try {
      const { from, to } = getDateRange(currentPeriod);
      const response = await getDailyStats(from, to);

      // Map API response (string macros) to DailyStatsPoint (number macros)
      const mappedStats: DailyStatsPoint[] = response.points.map((point) => ({
        day: point.day,
        calories: parseFloat(point.totals.calories),
        protein: parseFloat(point.totals.protein),
        carbs: parseFloat(point.totals.carbs),
        fat: parseFloat(point.totals.fat),
      }));

      setDailyStats(mappedStats);
    } catch (err) {
      setError("Failed to fetch daily stats");
      setDailyStats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(period);
  }, [period, fetchStats]);

  const handleSetPeriod = useCallback((newPeriod: StatsPeriod) => {
    setPeriod(newPeriod);
  }, []);

  const refresh = useCallback(async () => {
    await fetchStats(period);
  }, [period, fetchStats]);

  return {
    dailyStats,
    period,
    loading,
    error,
    setPeriod: handleSetPeriod,
    refresh,
  };
};
