import { useCallback, useEffect, useRef, useState } from "react";

import type { SharedFoodListItem } from "@models/types";
import { searchSharedFoods } from "@services/api/sharedFoods";

const DEBOUNCE_MS = 400;

export type UseSharedFoodSearchResult = {
  results: SharedFoodListItem[];
  query: string;
  setQuery: (q: string) => void;
  loading: boolean;
  isError: boolean;
  retry: () => void;
  hasSearched: boolean;
};

export const useSharedFoodSearch = (): UseSharedFoodSearchResult => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SharedFoodListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const isMountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef("");

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const executeSearch = useCallback(async (q: string) => {
    lastQueryRef.current = q;
    setLoading(true);
    setIsError(false);

    try {
      const data = await searchSharedFoods(q);
      if (isMountedRef.current) {
        setResults(data);
        setHasSearched(true);
        setLoading(false);
      }
    } catch {
      if (isMountedRef.current) {
        setIsError(true);
        setResults([]);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      setIsError(false);
      return;
    }

    setLoading(true);
    timerRef.current = setTimeout(() => {
      executeSearch(query.trim());
    }, DEBOUNCE_MS);
  }, [query, executeSearch]);

  const retry = useCallback(() => {
    const q = lastQueryRef.current;
    if (q) {
      executeSearch(q);
    }
  }, [executeSearch]);

  return {
    results,
    query,
    setQuery,
    loading,
    isError,
    retry,
    hasSearched,
  };
};
