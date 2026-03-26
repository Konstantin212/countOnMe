import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

import type { WaterLog } from "@models/types";
import { useDatabaseContext } from "@storage/DatabaseProvider";
import { waterLogRepository, outboxRepository } from "@storage/repositories";
import { debouncedSync } from "@services/syncEngine";

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
  const { db, userId } = useDatabaseContext();
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
      const loaded = await waterLogRepository.findAll(db, userId);
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
  }, [db, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addWater = useCallback(
    async (amountMl: number): Promise<void> => {
      const timestamp = new Date().toISOString();
      const newLog: WaterLog = {
        id: uuid(),
        day: getTodayDate(),
        amountMl,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const updated = [...logsRef.current, newLog];
      logsRef.current = updated;

      if (isMountedRef.current) {
        setLogs(updated);
      }

      try {
        await waterLogRepository.upsert(db, userId, newLog);
        await outboxRepository.enqueue(db, {
          id: `water_log:${newLog.id}`,
          entityType: "water_log",
          action: "upsert",
          entityId: newLog.id,
          data: { day: newLog.day, amount_ml: newLog.amountMl },
          updatedAt: newLog.updatedAt,
        });
        debouncedSync();
      } catch {
        // Storage failure — state already updated optimistically
      }
    },
    [db, userId],
  );

  const removeWater = useCallback(
    async (amountMl: number): Promise<void> => {
      const timestamp = new Date().toISOString();
      const newLog: WaterLog = {
        id: uuid(),
        day: getTodayDate(),
        amountMl: -amountMl,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const updated = [...logsRef.current, newLog];
      logsRef.current = updated;

      if (isMountedRef.current) {
        setLogs(updated);
      }

      try {
        await waterLogRepository.upsert(db, userId, newLog);
        await outboxRepository.enqueue(db, {
          id: `water_log:${newLog.id}`,
          entityType: "water_log",
          action: "upsert",
          entityId: newLog.id,
          data: { day: newLog.day, amount_ml: newLog.amountMl },
          updatedAt: newLog.updatedAt,
        });
        debouncedSync();
      } catch {
        // Storage failure — state already updated optimistically
      }
    },
    [db, userId],
  );

  const deleteWaterLog = useCallback(
    async (id: string): Promise<void> => {
      const updated = logsRef.current.filter((log) => log.id !== id);
      logsRef.current = updated;

      if (isMountedRef.current) {
        setLogs(updated);
      }

      try {
        await waterLogRepository.markDeleted(db, id);
        await outboxRepository.enqueue(db, {
          id: `water_log:${id}`,
          entityType: "water_log",
          action: "delete",
          entityId: id,
          data: null,
          updatedAt: new Date().toISOString(),
        });
        debouncedSync();
      } catch {
        // Storage failure — state already updated optimistically
      }
    },
    [db, userId],
  );

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
