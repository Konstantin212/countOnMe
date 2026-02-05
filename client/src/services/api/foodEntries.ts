import { apiFetch } from './http';
import type { Unit } from './portions';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'water';

export type FoodEntryResponse = {
  id: string;
  product_id: string;
  portion_id: string;
  day: string; // YYYY-MM-DD
  meal_type: MealType;
  amount: string;
  unit: Unit;
  created_at: string;
  updated_at: string;
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

export const listFoodEntries = async (query?: {
  day?: string;
  from?: string;
  to?: string;
}): Promise<FoodEntryResponse[]> => {
  return await apiFetch<FoodEntryResponse[]>('/v1/food-entries', { query });
};

export const createFoodEntry = async (body: FoodEntryCreateRequest): Promise<FoodEntryResponse> => {
  return await apiFetch<FoodEntryResponse>('/v1/food-entries', { method: 'POST', body });
};

export const getFoodEntry = async (entryId: string): Promise<FoodEntryResponse> => {
  return await apiFetch<FoodEntryResponse>(`/v1/food-entries/${entryId}`);
};

export const updateFoodEntry = async (
  entryId: string,
  patch: FoodEntryUpdateRequest,
): Promise<FoodEntryResponse> => {
  return await apiFetch<FoodEntryResponse>(`/v1/food-entries/${entryId}`, { method: 'PATCH', body: patch });
};

export const deleteFoodEntry = async (entryId: string): Promise<void> => {
  await apiFetch<void>(`/v1/food-entries/${entryId}`, { method: 'DELETE' });
};

