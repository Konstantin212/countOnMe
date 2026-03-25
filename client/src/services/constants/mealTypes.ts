import type { MealTypeKey } from "@models/types";

export type FoodMealTypeKey = Exclude<MealTypeKey, "water">;

export const MEAL_TYPE_KEYS: MealTypeKey[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snacks",
  "water",
];

export const FOOD_MEAL_TYPE_KEYS: FoodMealTypeKey[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snacks",
];

export const MEAL_TYPE_LABEL: Record<MealTypeKey, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
  water: "Water",
} as const;
