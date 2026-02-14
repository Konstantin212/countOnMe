import { useCallback, useEffect, useRef, useState } from "react";

import { EnrichedFoodEntry, MealTypeKey, Product, Unit } from "@models/types";
import {
  deleteFoodEntry,
  FoodEntryResponse,
  listFoodEntries,
  updateFoodEntry,
} from "@services/api/foodEntries";
import { listPortions, PortionResponse } from "@services/api/portions";
import { convertUnit, getCompatibleUnits } from "@services/utils/units";

import { useProducts } from "./useProducts";

export type UseMealTypeEntriesResult = {
  entries: EnrichedFoodEntry[];
  loading: boolean;
  error: string | null;

  /** Update entry amount/unit - persists to DB first, returns true on success */
  updateEntry: (
    entryId: string,
    amount: number,
    unit: Unit,
  ) => Promise<boolean>;

  /** Delete entry - persists to DB first, returns true on success */
  deleteEntry: (entryId: string) => Promise<boolean>;

  /** Re-fetch entries from backend */
  refresh: () => Promise<void>;
};

/**
 * Get today's date in YYYY-MM-DD format.
 */
const getTodayDate = (): string => {
  return new Date().toISOString().split("T")[0];
};

/**
 * Cache for portions by product ID to avoid repeated API calls.
 */
const portionCache = new Map<string, PortionResponse[]>();

/**
 * Get portions for a product (with caching).
 */
const getPortionsForProduct = async (
  productId: string,
): Promise<PortionResponse[]> => {
  const cached = portionCache.get(productId);
  if (cached) return cached;

  try {
    const portions = await listPortions(productId);
    portionCache.set(productId, portions);
    return portions;
  } catch {
    return [];
  }
};

/**
 * Hook to fetch and manage food entries for a specific meal type.
 * All updates are persisted to the database before updating local state.
 */
export const useMealTypeEntries = (
  mealType: MealTypeKey,
  day: string = getTodayDate(),
): UseMealTypeEntriesResult => {
  const [entries, setEntries] = useState<EnrichedFoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { products } = useProducts();
  const productsRef = useRef(products);
  productsRef.current = products;
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Enrich a raw food entry with product details and calculated nutrition.
   */
  const enrichEntry = useCallback(
    async (
      entry: FoodEntryResponse,
      productsMap: Map<string, Product>,
    ): Promise<EnrichedFoodEntry | null> => {
      const product = productsMap.get(entry.product_id);
      if (!product) return null;

      const amount = parseFloat(entry.amount);
      const unit = entry.unit as Unit;

      // Get portion data for accurate calorie calculation
      let calories = 0;
      let protein = 0;
      let carbs = 0;
      let fat = 0;

      try {
        const portions = await getPortionsForProduct(entry.product_id);
        const portion = portions.find((p) => p.id === entry.portion_id);

        if (portion) {
          // Calculate based on portion's base values
          const baseAmount = parseFloat(portion.base_amount);
          const baseUnit = portion.base_unit as Unit;
          const converted = convertUnit(amount, unit, baseUnit);

          if (converted !== null && baseAmount > 0) {
            const ratio = converted / baseAmount;
            calories = parseFloat(portion.calories) * ratio;
            protein =
              (portion.protein ? parseFloat(portion.protein) : 0) * ratio;
            carbs = (portion.carbs ? parseFloat(portion.carbs) : 0) * ratio;
            fat = (portion.fat ? parseFloat(portion.fat) : 0) * ratio;
          }
        }
      } catch {
        // Fallback to product-level calculation
        const baseAmount = product.portionSize ?? 100;
        const baseUnit = (product.scaleUnit ?? "g") as Unit;
        const calPerBase = product.caloriesPerBase ?? product.caloriesPer100g;
        const converted = convertUnit(amount, unit, baseUnit);

        if (converted !== null && baseAmount > 0) {
          const ratio = converted / baseAmount;
          calories = calPerBase * ratio;
          protein =
            (product.proteinPerBase ?? product.proteinPer100g ?? 0) * ratio;
          carbs = (product.carbsPerBase ?? product.carbsPer100g ?? 0) * ratio;
          fat = (product.fatPerBase ?? product.fatPer100g ?? 0) * ratio;
        }
      }

      // Get allowed units (same group as current unit)
      const allowedUnits = getCompatibleUnits(unit);

      return {
        id: entry.id,
        productId: entry.product_id,
        productName: product.name,
        portionId: entry.portion_id,
        amount,
        unit,
        calories: Math.round(calories),
        protein: Math.round(protein * 10) / 10,
        carbs: Math.round(carbs * 10) / 10,
        fat: Math.round(fat * 10) / 10,
        allowedUnits,
        createdAt: entry.created_at,
      };
    },
    [],
  );

  /**
   * Fetch entries from backend and enrich with product data.
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Always fetch from backend - source of truth
      const response = await listFoodEntries({ day });

      // Filter by meal type
      const filtered = response.filter((e) => e.meal_type === mealType);

      // Build product map for quick lookup (use ref for stable identity)
      const productsMap = new Map(productsRef.current.map((p) => [p.id, p]));

      // Enrich entries with product details
      const enrichedPromises = filtered.map((e) => enrichEntry(e, productsMap));
      const enrichedResults = await Promise.all(enrichedPromises);
      const enriched = enrichedResults.filter(
        (e): e is EnrichedFoodEntry => e !== null,
      );

      if (isMountedRef.current) {
        setEntries(enriched);
      }
    } catch (err) {
      console.error("Failed to fetch entries:", err);
      if (isMountedRef.current) {
        setError("Failed to load entries");
        setEntries([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [day, mealType, enrichEntry]);

  // Initial fetch and re-fetch when products become available
  const hadProductsRef = useRef(false);
  useEffect(() => {
    const hasProducts = productsRef.current.length > 0;
    const isFirstLoad = hasProducts && !hadProductsRef.current;

    if (isFirstLoad) {
      hadProductsRef.current = true;
      refresh();
    }
  }, [products, refresh]);

  // Initial fetch on mount / when day or mealType change
  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Update entry amount/unit - PERSISTS TO DB FIRST.
   */
  const updateEntryHandler = useCallback(
    async (entryId: string, amount: number, unit: Unit): Promise<boolean> => {
      try {
        // 1. PERSIST TO DATABASE FIRST
        await updateFoodEntry(entryId, { amount, unit });

        // 2. Update local state only after DB success
        setEntries((prev) =>
          prev.map((entry) => {
            if (entry.id !== entryId) return entry;

            // Recalculate with new amount/unit (use ref for consistency)
            const product = productsRef.current.find(
              (p) => p.id === entry.productId,
            );
            if (!product) return { ...entry, amount, unit };

            const baseAmount = product.portionSize ?? 100;
            const baseUnit = (product.scaleUnit ?? "g") as Unit;
            const calPerBase =
              product.caloriesPerBase ?? product.caloriesPer100g;
            const converted = convertUnit(amount, unit, baseUnit);

            let calories = entry.calories;
            let protein = entry.protein;
            let carbs = entry.carbs;
            let fat = entry.fat;

            if (converted !== null && baseAmount > 0) {
              const ratio = converted / baseAmount;
              calories = Math.round(calPerBase * ratio);
              protein =
                Math.round(
                  (product.proteinPerBase ?? product.proteinPer100g ?? 0) *
                    ratio *
                    10,
                ) / 10;
              carbs =
                Math.round(
                  (product.carbsPerBase ?? product.carbsPer100g ?? 0) *
                    ratio *
                    10,
                ) / 10;
              fat =
                Math.round(
                  (product.fatPerBase ?? product.fatPer100g ?? 0) * ratio * 10,
                ) / 10;
            }

            return {
              ...entry,
              amount,
              unit,
              calories,
              protein,
              carbs,
              fat,
              allowedUnits: getCompatibleUnits(unit),
            };
          }),
        );

        return true;
      } catch (err) {
        console.error("Failed to update entry:", err);
        setError("Failed to update entry");
        return false;
      }
    },
    [],
  );

  /**
   * Delete entry - PERSISTS TO DB FIRST.
   */
  const deleteEntryHandler = useCallback(
    async (entryId: string): Promise<boolean> => {
      try {
        // 1. PERSIST TO DATABASE FIRST (soft delete)
        await deleteFoodEntry(entryId);

        // 2. Remove from local state only after DB success
        setEntries((prev) => prev.filter((e) => e.id !== entryId));

        return true;
      } catch (err) {
        console.error("Failed to delete entry:", err);
        setError("Failed to delete entry");
        return false;
      }
    },
    [],
  );

  return {
    entries,
    loading,
    error,
    updateEntry: updateEntryHandler,
    deleteEntry: deleteEntryHandler,
    refresh,
  };
};

/**
 * Clear the portion cache (useful for testing or logout).
 */
export const clearMealTypeEntriesCache = (): void => {
  portionCache.clear();
};
