import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

import type { WaterLog } from "@models/types";
import { loadWaterLogs, saveWaterLogs } from "@storage/storage";

const DEFAULT_WATER_GOAL_ML = 2000;

const getTodayDate = (): string => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

export type UseWaterTrackingResult = {
  todayTotal: number;
  todayLogs: WaterLog[];
  waterGoal: number;
  loading: boolean;
  addWater: (amountMl: number) => Promise<void>;
  removeWater: (amountMl: number) => Promise<void>;
  deleteWaterLog: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

export const useWaterTracking = (
  goalMl: number = DEFAULT_WATER_GOAL_ML,
): UseWaterTrackingResult => {
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const logsRef = useRef<WaterLog[]>([]);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await loadWaterLogs();
      if (isMountedRef.current) {
        logsRef.current = loaded;
        setLogs(loaded);
      }
    } catch {
      // Storage failure — keep current state (empty on first load)
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addWater = useCallback(async (amountMl: number): Promise<void> => {
    const newLog: WaterLog = {
      id: uuid(),
      day: getTodayDate(),
      amountMl,
      createdAt: new Date().toISOString(),
    };

    const updated = [...logsRef.current, newLog];
    logsRef.current = updated;

    if (isMountedRef.current) {
      setLogs(updated);
    }

    try {
      await saveWaterLogs(updated);
    } catch {
      // Storage failure — state already updated optimistically
    }
  }, []);

  const removeWater = useCallback(async (amountMl: number): Promise<void> => {
    const newLog: WaterLog = {
      id: uuid(),
      day: getTodayDate(),
      amountMl: -amountMl,
      createdAt: new Date().toISOString(),
    };

    const updated = [...logsRef.current, newLog];
    logsRef.current = updated;

    if (isMountedRef.current) {
      setLogs(updated);
    }

    try {
      await saveWaterLogs(updated);
    } catch {
      // Storage failure — state already updated optimistically
    }
  }, []);

  const deleteWaterLog = useCallback(async (id: string): Promise<void> => {
    const updated = logsRef.current.filter((log) => log.id !== id);
    logsRef.current = updated;

    if (isMountedRef.current) {
      setLogs(updated);
    }

    try {
      await saveWaterLogs(updated);
    } catch {
      // Storage failure — state already updated optimistically
    }
  }, []);

  const today = getTodayDate();
  const todayLogs = logs.filter((log) => log.day === today);
  const todayTotal = Math.max(
    0,
    todayLogs.reduce((sum, log) => sum + log.amountMl, 0),
  );

  return {
    todayTotal,
    todayLogs,
    waterGoal: goalMl,
    loading,
    addWater,
    removeWater,
    deleteWaterLog,
    refresh,
  };
};
