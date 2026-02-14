import type {
  Product,
  Meal,
  MealItem,
  MealTypeKey,
  UserGoal,
  Unit,
} from "@models/types";
import type { FoodEntryResponse } from "@services/api/foodEntries";
import type { PortionResponse } from "@services/api/portions";
import type { DayStatsResponse } from "@services/api/stats";

/**
 * Test helpers - mock factory functions for common domain objects.
 */

export const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: "prod-1",
  name: "Chicken",
  caloriesPer100g: 165,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

export const makeMealItem = (overrides: Partial<MealItem> = {}): MealItem => ({
  productId: "prod-1",
  amount: 100,
  unit: "g",
  ...overrides,
});

export const makeMeal = (overrides: Partial<Meal> = {}): Meal => ({
  id: "meal-1",
  name: "Test Meal",
  mealType: "breakfast",
  items: [makeMealItem()],
  totalCalories: 165,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

export const makeFoodEntry = (
  overrides: Partial<FoodEntryResponse> = {},
): FoodEntryResponse => ({
  id: "entry-1",
  product_id: "prod-1",
  portion_id: "portion-1",
  day: "2025-06-01",
  meal_type: "breakfast",
  amount: "200",
  unit: "g",
  created_at: "2025-06-01T08:00:00Z",
  updated_at: "2025-06-01T08:00:00Z",
  ...overrides,
});

export const makePortion = (
  overrides: Partial<PortionResponse> = {},
): PortionResponse => ({
  id: "portion-1",
  product_id: "prod-1",
  label: "100g",
  base_amount: "100",
  base_unit: "g",
  calories: "165",
  protein: "31",
  carbs: "0",
  fat: "3.6",
  is_default: true,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  ...overrides,
});

export const makeDayStatsResponse = (
  overrides: Partial<DayStatsResponse> = {},
): DayStatsResponse => ({
  day: "2025-06-01",
  totals: {
    calories: "2000",
    protein: "150",
    carbs: "200",
    fat: "67",
  },
  by_meal_type: {
    breakfast: {
      calories: "500",
      protein: "40",
      carbs: "50",
      fat: "17",
    },
    lunch: {
      calories: "700",
      protein: "50",
      carbs: "70",
      fat: "23",
    },
    dinner: {
      calories: "600",
      protein: "45",
      carbs: "60",
      fat: "20",
    },
    snacks: {
      calories: "200",
      protein: "15",
      carbs: "20",
      fat: "7",
    },
  },
  ...overrides,
});

export const makeUserGoal = (overrides: Partial<UserGoal> = {}): UserGoal => ({
  id: "goal-1",
  goalType: "manual",
  dailyCaloriesKcal: 2000,
  proteinGrams: 150,
  proteinPercent: 30,
  carbsGrams: 200,
  carbsPercent: 40,
  fatGrams: 67,
  fatPercent: 30,
  waterMl: 2000,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});
