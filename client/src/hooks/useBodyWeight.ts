import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

import type { BodyWeightEntry } from "@models/types";
import { listBodyWeights as apiListBodyWeights } from "@services/api/bodyWeights";
import { loadBodyWeights, saveBodyWeights } from "@storage/storage";
import { enqueueOutbox } from "@storage/outbox";
import { debouncedSync } from "@services/syncEngine";

export type UseBodyWeightResult = {
  weights: BodyWeightEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logWeight: (day: string, weightKg: number) => Promise<BodyWeightEntry>;
  updateWeight: (id: string, weightKg: number) => Promise<BodyWeightEntry>;
  deleteWeight: (id: string) => Promise<boolean>;
};

export const useBodyWeight = (): UseBodyWeightResult => {
  const [weights, setWeights] = useState<BodyWeightEntry[]>([]);
  const weightsRef = useRef<BodyWeightEntry[]>([]);
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
      const localWeights = await loadBodyWeights();

      if (isMountedRef.current) {
        weightsRef.current = localWeights;
        setWeights(localWeights);
      }

      // Try to sync from backend
      try {
        const remoteWeights = await apiListBodyWeights();

        if (isMountedRef.current) {
          weightsRef.current = remoteWeights;
          setWeights(remoteWeights);
          // Update local storage with remote data (remote wins)
          await saveBodyWeights(remoteWeights);
        }
      } catch {
        // Backend not available, use local data
        // This is expected in offline-first mode
      }
    } catch {
      if (isMountedRef.current) {
        setError("Failed to load body weights");
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

  const updateWeightHandler = useCallback(
    async (id: string, weightKg: number): Promise<BodyWeightEntry> => {
      const existing = weightsRef.current.find((w) => w.id === id);
      if (!existing) {
        throw new Error("Failed to update weight. Entry not found.");
      }

      const timestamp = new Date().toISOString();
      const updatedEntry: BodyWeightEntry = {
        ...existing,
        weightKg,
        updatedAt: timestamp,
      };

      const updatedWeights = weightsRef.current.map((w) =>
        w.id === id ? updatedEntry : w,
      );
      weightsRef.current = updatedWeights;

      if (isMountedRef.current) {
        setWeights(updatedWeights);
      }

      try {
        await saveBodyWeights(updatedWeights);
        await enqueueOutbox({
          id: `body_weight:${updatedEntry.id}`,
          entityType: "body_weight",
          action: "upsert",
          entityId: updatedEntry.id,
          data: {
            day: updatedEntry.day,
            weight_kg: updatedEntry.weightKg,
            created_at: updatedEntry.createdAt,
          },
          updatedAt: updatedEntry.updatedAt,
        });
        debouncedSync();
      } catch {
        // Storage failure -- state already updated optimistically
      }

      return updatedEntry;
    },
    [],
  );

  const logWeight = useCallback(
    async (day: string, weightKg: number): Promise<BodyWeightEntry> => {
      // Check for existing entry on the same day (local conflict)
      const existing = weightsRef.current.find((w) => w.day === day);
      if (existing) {
        return await updateWeightHandler(existing.id, weightKg);
      }

      const timestamp = new Date().toISOString();
      const newEntry: BodyWeightEntry = {
        id: uuid(),
        day,
        weightKg,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const updatedWeights = [...weightsRef.current, newEntry];
      weightsRef.current = updatedWeights;

      if (isMountedRef.current) {
        setWeights(updatedWeights);
      }

      try {
        await saveBodyWeights(updatedWeights);
        await enqueueOutbox({
          id: `body_weight:${newEntry.id}`,
          entityType: "body_weight",
          action: "upsert",
          entityId: newEntry.id,
          data: {
            day: newEntry.day,
            weight_kg: newEntry.weightKg,
            created_at: newEntry.createdAt,
          },
          updatedAt: newEntry.updatedAt,
        });
        debouncedSync();
      } catch {
        // Storage failure -- state already updated optimistically
      }

      return newEntry;
    },
    [updateWeightHandler],
  );

  const deleteWeightHandler = useCallback(
    async (id: string): Promise<boolean> => {
      const updatedWeights = weightsRef.current.filter((w) => w.id !== id);

      if (updatedWeights.length === weightsRef.current.length) {
        return false;
      }

      weightsRef.current = updatedWeights;

      if (isMountedRef.current) {
        setWeights(updatedWeights);
      }

      try {
        await saveBodyWeights(updatedWeights);
        await enqueueOutbox({
          id: `body_weight:${id}`,
          entityType: "body_weight",
          action: "delete",
          entityId: id,
          data: null,
          updatedAt: new Date().toISOString(),
        });
        debouncedSync();
      } catch {
        // Storage failure -- state already updated optimistically
      }

      return true;
    },
    [],
  );

  return {
    weights,
    loading,
    error,
    refresh,
    logWeight,
    updateWeight: updateWeightHandler,
    deleteWeight: deleteWeightHandler,
  };
};
