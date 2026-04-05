import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

import type { BodyWeightEntry } from "@models/types";
import { listBodyWeights as apiListBodyWeights } from "@services/api/bodyWeights";
import { useDatabaseContext } from "@storage/DatabaseProvider";
import { bodyWeightRepository, outboxRepository } from "@storage/repositories";
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
  const { db, userId } = useDatabaseContext();
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
      const localWeights = await bodyWeightRepository.findAll(db, userId);

      if (isMountedRef.current) {
        weightsRef.current = localWeights;
        setWeights(localWeights);
      }

      try {
        const remoteWeights = await apiListBodyWeights();

        if (isMountedRef.current && remoteWeights.length > 0) {
          // Merge: prefer the entry with the latest updatedAt per id
          const localWeightsSnapshot = weightsRef.current;
          const localMap = new Map(localWeightsSnapshot.map((w) => [w.id, w]));
          const seenIds = new Set<string>();
          const merged: BodyWeightEntry[] = [];

          for (const remote of remoteWeights) {
            const local = localMap.get(remote.id);
            if (local && local.updatedAt > remote.updatedAt) {
              merged.push(local);
            } else {
              merged.push(remote);
            }
            seenIds.add(remote.id);
          }

          for (const local of localWeightsSnapshot) {
            if (!seenIds.has(local.id)) {
              merged.push(local);
            }
          }

          // Deduplicate by day — keep the entry with the latest updatedAt
          const byDay = new Map<string, BodyWeightEntry>();
          for (const w of merged) {
            const existing = byDay.get(w.day);
            if (!existing || w.updatedAt > existing.updatedAt) {
              byDay.set(w.day, w);
            }
          }
          const deduped = Array.from(byDay.values()).sort(
            (a, b) => new Date(b.day).getTime() - new Date(a.day).getTime(),
          );

          weightsRef.current = deduped;
          setWeights(deduped);

          await db.withTransactionAsync(async () => {
            for (const entry of deduped) {
              await bodyWeightRepository.upsert(db, userId, entry);
            }
          });
        }
      } catch {
        // Backend not available, use local data
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
  }, [db, userId]);

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
        await bodyWeightRepository.upsert(db, userId, updatedEntry);
        await outboxRepository.enqueue(db, {
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
    [db, userId],
  );

  const logWeight = useCallback(
    async (day: string, weightKg: number): Promise<BodyWeightEntry> => {
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
        await bodyWeightRepository.upsert(db, userId, newEntry);
        await outboxRepository.enqueue(db, {
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
    [db, userId, updateWeightHandler],
  );

  const deleteWeightHandler = useCallback(
    async (id: string): Promise<boolean> => {
      const exists = weightsRef.current.some((w) => w.id === id);
      if (!exists) return false;

      weightsRef.current = weightsRef.current.filter((w) => w.id !== id);

      if (isMountedRef.current) {
        setWeights(weightsRef.current);
      }

      try {
        await bodyWeightRepository.markDeleted(db, id);
        await outboxRepository.enqueue(db, {
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
    [db, userId],
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
