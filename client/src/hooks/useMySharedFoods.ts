import { useCallback, useEffect, useRef, useState } from "react";

import type { SharedFoodListItem } from "@models/types";
import {
  deleteSharedFood,
  listMySharedFoods,
  publishSharedFood,
  unpublishSharedFood,
} from "@services/api/sharedFoods";

export type UseMySharedFoodsResult = {
  foods: SharedFoodListItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  publishFood: (id: string) => Promise<void>;
  unpublishFood: (id: string) => Promise<void>;
  deleteFood: (id: string) => Promise<void>;
};

export const useMySharedFoods = (): UseMySharedFoodsResult => {
  const [foods, setFoods] = useState<SharedFoodListItem[]>([]);
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
      const data = await listMySharedFoods();
      if (isMountedRef.current) {
        setFoods(data);
      }
    } catch {
      if (isMountedRef.current) {
        setError("Failed to load shared foods");
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

  const publishFood = useCallback(
    async (id: string) => {
      try {
        await publishSharedFood(id);
        await refresh();
      } catch {
        if (isMountedRef.current) {
          setError("Failed to publish food");
        }
      }
    },
    [refresh],
  );

  const unpublishFood = useCallback(
    async (id: string) => {
      try {
        await unpublishSharedFood(id);
        await refresh();
      } catch {
        if (isMountedRef.current) {
          setError("Failed to unpublish food");
        }
      }
    },
    [refresh],
  );

  const deleteFood = useCallback(async (id: string) => {
    try {
      await deleteSharedFood(id);
      if (isMountedRef.current) {
        setFoods((prev) => prev.filter((f) => f.id !== id));
      }
    } catch {
      if (isMountedRef.current) {
        setError("Failed to delete food");
      }
    }
  }, []);

  return {
    foods,
    loading,
    error,
    refresh,
    publishFood,
    unpublishFood,
    deleteFood,
  };
};
