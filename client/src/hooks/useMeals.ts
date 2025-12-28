import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';

import { Meal, MealItem, Product } from '../models/types';
import { loadMeals, saveMeals } from '../storage/storage';
import { calcMealCalories } from '../services/utils/calories';

export type NewMealInput = {
  name: string;
  items: MealItem[];
};

export type UpdateMealInput = {
  name?: string;
  items?: MealItem[];
};

export type UseMealsResult = {
  meals: Meal[];
  loading: boolean;
  refresh: () => Promise<void>;
  addMeal: (input: NewMealInput) => Promise<Meal>;
  updateMeal: (id: string, patch: UpdateMealInput) => Promise<Meal | null>;
  deleteMeal: (id: string) => Promise<boolean>;
};

const now = () => new Date().toISOString();

const normalizeName = (name: string): string => {
  const trimmed = name?.trim();
  return trimmed?.length ? trimmed : 'Untitled meal';
};

const sanitizeItems = (items: MealItem[]): MealItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }
  
  return items
    .filter((item) => {
      // Keep only items with valid productId and positive grams
      return (
        item &&
        typeof item.productId === 'string' &&
        item.productId.length > 0 &&
        typeof item.grams === 'number' &&
        !Number.isNaN(item.grams) &&
        item.grams > 0
      );
    })
    .map((item) => ({
      productId: item.productId,
      grams: Number(item.grams),
    }));
};

const createMealRecord = (input: NewMealInput, products: Product[]): Meal => {
  const timestamp = now();
  const sanitizedItems = sanitizeItems(input.items);
  const totalCalories = calcMealCalories(sanitizedItems, products);
  
  return {
    id: uuid(),
    name: normalizeName(input.name),
    items: sanitizedItems,
    totalCalories,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const patchMealRecord = (meal: Meal, patch: UpdateMealInput, products: Product[]): Meal => {
  const updatedItems = patch.items !== undefined ? sanitizeItems(patch.items) : meal.items;
  const totalCalories = calcMealCalories(updatedItems, products);
  
  return {
    ...meal,
    name: patch.name !== undefined ? normalizeName(patch.name) : meal.name,
    items: updatedItems,
    totalCalories,
    updatedAt: now(),
  };
};

export const useMeals = (products: Product[]): UseMealsResult => {
  const [meals, setMeals] = useState<Meal[]>([]);
  const mealsRef = useRef<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applyChanges = useCallback(async (updater: (prev: Meal[]) => Meal[]) => {
    const prev = mealsRef.current;
    const next = updater(prev);

    if (next === prev) {
      return prev;
    }

    mealsRef.current = next;
    setMeals(next);

    try {
      await saveMeals(next);
    } catch (error) {
      console.error('Failed to save meals', error);
      throw error;
    }

    return next;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await loadMeals();
      if (isMountedRef.current) {
        mealsRef.current = stored;
        setMeals(stored);
      }
    } catch (error) {
      console.error('Failed to load meals', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addMeal = useCallback(
    async (input: NewMealInput) => {
      const newMeal = createMealRecord(input, products);
      await applyChanges((prev) => [...prev, newMeal]);
      return newMeal;
    },
    [applyChanges, products],
  );

  const updateMeal = useCallback(
    async (id: string, patch: UpdateMealInput) => {
      let updatedMeal: Meal | null = null;
      await applyChanges((prev) => {
        let changed = false;
        const next = prev.map((meal) => {
          if (meal.id !== id) {
            return meal;
          }
          changed = true;
          updatedMeal = patchMealRecord(meal, patch, products);
          return updatedMeal;
        });

        return changed ? next : prev;
      });

      return updatedMeal;
    },
    [applyChanges, products],
  );

  const deleteMeal = useCallback(
    async (id: string) => {
      let removed = false;
      await applyChanges((prev) => {
        const next = prev.filter((meal) => {
          if (meal.id === id) {
            removed = true;
            return false;
          }
          return true;
        });

        return removed ? next : prev;
      });

      return removed;
    },
    [applyChanges],
  );

  return {
    meals,
    loading,
    refresh,
    addMeal,
    updateMeal,
    deleteMeal,
  };
};

export const __testing = {
  normalizeName,
  sanitizeItems,
  createMealRecord,
  patchMealRecord,
};
