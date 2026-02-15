import { useCallback, useEffect, useRef, useState } from "react";

import type { BodyWeightEntry } from "@models/types";
import {
  createBodyWeight as apiCreateBodyWeight,
  deleteBodyWeight as apiDeleteBodyWeight,
  listBodyWeights as apiListBodyWeights,
  updateBodyWeight as apiUpdateBodyWeight,
} from "@services/api/bodyWeights";
import { loadBodyWeights, saveBodyWeights } from "@storage/storage";
import { enqueue } from "@storage/syncQueue";

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
    } catch (err) {
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

  const logWeight = useCallback(
    async (day: string, weightKg: number): Promise<BodyWeightEntry> => {
      try {
        const newEntry = await apiCreateBodyWeight(day, weightKg);

        const updatedWeights = [...weightsRef.current, newEntry];
        weightsRef.current = updatedWeights;

        if (isMountedRef.current) {
          setWeights(updatedWeights);
        }

        // Save to local storage
        await saveBodyWeights(updatedWeights);

        // Enqueue for sync
        await enqueue({
          id: `body-weights.create:${newEntry.id}`,
          resource: "body-weights",
          action: "create",
          payload: { id: newEntry.id, day: newEntry.day, weightKg },
        });

        return newEntry;
      } catch (err: unknown) {
        // Handle 409 conflict (entry already exists for this day)
        const httpError = err as { status?: number };
        if (httpError?.status === 409) {
          // Fetch existing entry for this day and update it
          const existingWeights = await apiListBodyWeights(day, day);
          if (existingWeights.length > 0) {
            const existingEntry = existingWeights[0];
            return await updateWeightHandler(existingEntry.id, weightKg);
          }
        }
        throw new Error("Failed to log weight. Please try again.");
      }
    },
    [],
  );

  const updateWeightHandler = useCallback(
    async (id: string, weightKg: number): Promise<BodyWeightEntry> => {
      try {
        const updatedEntry = await apiUpdateBodyWeight(id, weightKg);

        const updatedWeights = weightsRef.current.map((w) =>
          w.id === id ? updatedEntry : w,
        );
        weightsRef.current = updatedWeights;

        if (isMountedRef.current) {
          setWeights(updatedWeights);
        }

        // Save to local storage
        await saveBodyWeights(updatedWeights);

        // Enqueue for sync
        await enqueue({
          id: `body-weights.update:${updatedEntry.id}:${updatedEntry.updatedAt}`,
          resource: "body-weights",
          action: "update",
          payload: { id: updatedEntry.id, weightKg },
        });

        return updatedEntry;
      } catch (err) {
        throw new Error("Failed to update weight. Please try again.");
      }
    },
    [],
  );

  const deleteWeightHandler = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await apiDeleteBodyWeight(id);

        const updatedWeights = weightsRef.current.filter((w) => w.id !== id);
        weightsRef.current = updatedWeights;

        if (isMountedRef.current) {
          setWeights(updatedWeights);
        }

        // Save to local storage
        await saveBodyWeights(updatedWeights);

        // Enqueue for sync
        await enqueue({
          id: `body-weights.delete:${id}:${new Date().toISOString()}`,
          resource: "body-weights",
          action: "delete",
          payload: { id },
        });

        return true;
      } catch (err) {
        throw new Error("Failed to delete weight. Please try again.");
      }
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
