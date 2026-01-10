import type { MealTypeKey } from '@models/types';

export const MEAL_TYPE_KEYS: MealTypeKey[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'water'];

export const MEAL_TYPE_LABEL: Record<MealTypeKey, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
  water: 'Water',
} as const;

