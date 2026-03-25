import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { MealItem, MealTypeKey, Unit } from "@models/types";
import {
  FOOD_MEAL_TYPE_KEYS,
  FoodMealTypeKey,
} from "@services/constants/mealTypes";
import { clearDraftMeal, loadDraftMeal, saveDraftMeal } from "@storage/storage";

type DraftMealItem = MealItem;

type DraftMealState = {
  mealType: FoodMealTypeKey;
  itemsByMealType: Record<FoodMealTypeKey, DraftMealItem[]>;
};

type DraftMealContextValue = {
  draft: DraftMealState;
  setMealType: (mealType: FoodMealTypeKey) => void;
  upsertItem: (item: { productId: string; amount: number; unit: Unit }) => void;
  removeItem: (productId: string) => void;
  reset: () => void;
};

const DraftMealContext = createContext<DraftMealContextValue | undefined>(
  undefined,
);

const DEFAULT_MEAL_TYPE: FoodMealTypeKey = "breakfast";

const createEmptyItemsByMealType = (): Record<
  FoodMealTypeKey,
  DraftMealItem[]
> => {
  return FOOD_MEAL_TYPE_KEYS.reduce(
    (acc, key) => {
      acc[key] = [];
      return acc;
    },
    {} as Record<FoodMealTypeKey, DraftMealItem[]>,
  );
};

export const DraftMealProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [draft, setDraft] = useState<DraftMealState>({
    mealType: DEFAULT_MEAL_TYPE,
    itemsByMealType: createEmptyItemsByMealType(),
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    loadDraftMeal()
      .then((stored) => {
        if (stored) {
          const mealType = FOOD_MEAL_TYPE_KEYS.includes(
            stored.mealType as FoodMealTypeKey,
          )
            ? (stored.mealType as FoodMealTypeKey)
            : DEFAULT_MEAL_TYPE;
          const itemsByMealType = createEmptyItemsByMealType();
          for (const key of FOOD_MEAL_TYPE_KEYS) {
            itemsByMealType[key] = stored.itemsByMealType[key] ?? [];
          }
          setDraft({ mealType, itemsByMealType });
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraftMeal({
      mealType: draft.mealType,
      itemsByMealType: { ...draft.itemsByMealType, water: [] },
    }).catch(() => {});
  }, [draft, hydrated]);

  const setMealType = useCallback((mealType: FoodMealTypeKey) => {
    setDraft((prev) => ({ ...prev, mealType }));
  }, []);

  const upsertItem: DraftMealContextValue["upsertItem"] = useCallback(
    (item) => {
      setDraft((prev) => {
        const currentItems = prev.itemsByMealType[prev.mealType] ?? [];
        const nextItems = currentItems.filter(
          (i) => i.productId !== item.productId,
        );
        nextItems.push({
          productId: item.productId,
          amount: item.amount,
          unit: item.unit,
        });
        return {
          ...prev,
          itemsByMealType: {
            ...prev.itemsByMealType,
            [prev.mealType]: nextItems,
          },
        };
      });
    },
    [],
  );

  const removeItem = useCallback((productId: string) => {
    setDraft((prev) => {
      const currentItems = prev.itemsByMealType[prev.mealType] ?? [];
      return {
        ...prev,
        itemsByMealType: {
          ...prev.itemsByMealType,
          [prev.mealType]: currentItems.filter(
            (i) => i.productId !== productId,
          ),
        },
      };
    });
  }, []);

  const reset = useCallback(() => {
    setDraft({
      mealType: DEFAULT_MEAL_TYPE,
      itemsByMealType: createEmptyItemsByMealType(),
    });
    void clearDraftMeal();
  }, []);

  const value = useMemo<DraftMealContextValue>(
    () => ({ draft, setMealType, upsertItem, removeItem, reset }),
    [draft, removeItem, reset, setMealType, upsertItem],
  );

  return (
    <DraftMealContext.Provider value={value}>
      {children}
    </DraftMealContext.Provider>
  );
};

export const useDraftMeal = (): DraftMealContextValue => {
  const ctx = useContext(DraftMealContext);
  if (!ctx) {
    throw new Error("useDraftMeal must be used within DraftMealProvider");
  }
  return ctx;
};
