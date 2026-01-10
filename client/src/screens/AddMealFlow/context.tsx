import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { MealItem, MealTypeKey, Unit } from '@models/types';
import { MEAL_TYPE_KEYS } from '@services/constants/mealTypes';

export type DraftMealItem = MealItem;

export type DraftMealState = {
  mealType: MealTypeKey;
  itemsByMealType: Record<MealTypeKey, DraftMealItem[]>;
};

type DraftMealContextValue = {
  draft: DraftMealState;
  setMealType: (mealType: MealTypeKey) => void;
  upsertItem: (item: { productId: string; amount: number; unit: Unit }) => void;
  removeItem: (productId: string) => void;
  reset: () => void;
};

const DraftMealContext = createContext<DraftMealContextValue | undefined>(undefined);

const DEFAULT_MEAL_TYPE: MealTypeKey = 'breakfast';

const createEmptyItemsByMealType = (): Record<MealTypeKey, DraftMealItem[]> => {
  return MEAL_TYPE_KEYS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {} as Record<MealTypeKey, DraftMealItem[]>);
};

export const DraftMealProvider = ({ children }: { children: React.ReactNode }) => {
  const [draft, setDraft] = useState<DraftMealState>({
    mealType: DEFAULT_MEAL_TYPE,
    itemsByMealType: createEmptyItemsByMealType(),
  });

  const setMealType = useCallback((mealType: MealTypeKey) => {
    setDraft((prev) => ({ ...prev, mealType }));
  }, []);

  const upsertItem: DraftMealContextValue['upsertItem'] = useCallback((item) => {
    setDraft((prev) => {
      const currentItems = prev.itemsByMealType[prev.mealType] ?? [];
      const nextItems = currentItems.filter((i) => i.productId !== item.productId);
      nextItems.push({ productId: item.productId, amount: item.amount, unit: item.unit });
      return {
        ...prev,
        itemsByMealType: {
          ...prev.itemsByMealType,
          [prev.mealType]: nextItems,
        },
      };
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setDraft((prev) => {
      const currentItems = prev.itemsByMealType[prev.mealType] ?? [];
      return {
        ...prev,
        itemsByMealType: {
          ...prev.itemsByMealType,
          [prev.mealType]: currentItems.filter((i) => i.productId !== productId),
        },
      };
    });
  }, []);

  const reset = useCallback(() => {
    setDraft({ mealType: DEFAULT_MEAL_TYPE, itemsByMealType: createEmptyItemsByMealType() });
  }, []);

  const value = useMemo<DraftMealContextValue>(
    () => ({ draft, setMealType, upsertItem, removeItem, reset }),
    [draft, removeItem, reset, setMealType, upsertItem],
  );

  return <DraftMealContext.Provider value={value}>{children}</DraftMealContext.Provider>;
};

export const useDraftMeal = (): DraftMealContextValue => {
  const ctx = useContext(DraftMealContext);
  if (!ctx) {
    throw new Error('useDraftMeal must be used within DraftMealProvider');
  }
  return ctx;
};

