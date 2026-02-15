import { apiFetch } from "./http";
import type { Unit } from "./portions";
import { parseNumeric } from "@services/utils/parsing";

export type MealType = "breakfast" | "lunch" | "dinner" | "snacks" | "water";

// API response type (Decimal amount comes as string from backend)
type FoodEntryApiResponse = {
  id: string;
  product_id: string;
  portion_id: string;
  day: string; // YYYY-MM-DD
  meal_type: MealType;
  amount: string | number; // Decimal from backend
  unit: Unit;
  created_at: string;
  updated_at: string;
};

// Frontend type with parsed number
export type FoodEntry = {
  id: string;
  productId: string;
  portionId: string;
  day: string; // YYYY-MM-DD
  mealType: MealType;
  amount: number;
  unit: Unit;
  createdAt: string;
  updatedAt: string;
};

export type FoodEntryCreateRequest = {
  product_id: string;
  portion_id: string;
  day: string; // YYYY-MM-DD
  meal_type: MealType;
  amount: string | number;
  unit: Unit;
};

export type FoodEntryUpdateRequest = Partial<{
  portion_id: string;
  meal_type: MealType;
  amount: string | number;
  unit: Unit;
}>;

// Transform API response to frontend type
const transformFoodEntryResponse = (
  response: FoodEntryApiResponse,
): FoodEntry => {
  const amount = parseNumeric(response.amount);
  if (amount === undefined) {
    throw new Error(`Invalid amount value in food entry: ${response.amount}`);
  }

  return {
    id: response.id,
    productId: response.product_id,
    portionId: response.portion_id,
    day: response.day,
    mealType: response.meal_type,
    amount,
    unit: response.unit,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
};

export const listFoodEntries = async (query?: {
  day?: string;
  from?: string;
  to?: string;
}): Promise<FoodEntry[]> => {
  const responses = await apiFetch<FoodEntryApiResponse[]>("/v1/food-entries", {
    query,
  });
  return responses.map(transformFoodEntryResponse);
};

export const createFoodEntry = async (
  body: FoodEntryCreateRequest,
): Promise<FoodEntry> => {
  const response = await apiFetch<FoodEntryApiResponse>("/v1/food-entries", {
    method: "POST",
    body,
  });
  return transformFoodEntryResponse(response);
};

export const getFoodEntry = async (entryId: string): Promise<FoodEntry> => {
  const response = await apiFetch<FoodEntryApiResponse>(
    `/v1/food-entries/${entryId}`,
  );
  return transformFoodEntryResponse(response);
};

export const updateFoodEntry = async (
  entryId: string,
  patch: FoodEntryUpdateRequest,
): Promise<FoodEntry> => {
  const response = await apiFetch<FoodEntryApiResponse>(
    `/v1/food-entries/${entryId}`,
    {
      method: "PATCH",
      body: patch,
    },
  );
  return transformFoodEntryResponse(response);
};

export const deleteFoodEntry = async (entryId: string): Promise<void> => {
  await apiFetch<void>(`/v1/food-entries/${entryId}`, { method: "DELETE" });
};
