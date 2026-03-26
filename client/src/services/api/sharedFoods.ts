import { apiFetch } from "./http";
import { parseNumeric } from "@services/utils/parsing";
import type {
  SharedFood,
  SharedFoodImportResult,
  SharedFoodListItem,
  SharedFoodPortion,
  Unit,
} from "@models/types";

// ---------------------------------------------------------------------------
// API response types (snake_case, Decimal fields as string | number)
// ---------------------------------------------------------------------------

type SharedFoodPortionApiResponse = {
  id: string;
  shared_food_id: string;
  label: string;
  base_amount: string | number;
  base_unit: string;
  gram_weight: string | number | null;
  calories: string | number;
  protein: string | number | null;
  carbs: string | number | null;
  fat: string | number | null;
  is_default: boolean;
};

type SharedFoodApiResponse = {
  id: string;
  owner_user_id: string;
  name: string;
  display_name: string;
  description: string | null;
  brand: string | null;
  barcode: string | null;
  category: string | null;
  visibility: string;
  moderation_status: string;
  created_at: string;
  updated_at: string;
  portions: SharedFoodPortionApiResponse[];
};

type SharedFoodListItemApiResponse = {
  id: string;
  owner_user_id: string;
  name: string;
  display_name: string;
  brand: string | null;
  barcode: string | null;
  category: string | null;
  visibility: string;
  moderation_status: string;
  default_portion: SharedFoodPortionApiResponse | null;
};

type SharedFoodImportApiResponse = {
  product_id: string;
  portion_count: number;
};

// ---------------------------------------------------------------------------
// Request types (camelCase, client-side)
// ---------------------------------------------------------------------------

export type CreateSharedFoodRequest = {
  name: string;
  displayName: string;
  description?: string;
  brand?: string;
  barcode?: string;
  category?: string;
};

export type CreateSharedFoodPortionRequest = {
  label: string;
  baseAmount: number;
  baseUnit: Unit;
  gramWeight?: number;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  isDefault?: boolean;
};

// ---------------------------------------------------------------------------
// Transform functions (snake_case API -> camelCase client types)
// ---------------------------------------------------------------------------

export const transformPortion = (
  raw: SharedFoodPortionApiResponse,
): SharedFoodPortion => {
  const baseAmount = parseNumeric(raw.base_amount);
  const calories = parseNumeric(raw.calories);

  if (baseAmount === undefined || calories === undefined) {
    throw new Error(
      `Invalid Decimal values in shared food portion: base_amount=${raw.base_amount}, calories=${raw.calories}`,
    );
  }

  return {
    id: raw.id,
    sharedFoodId: raw.shared_food_id,
    label: raw.label,
    baseAmount,
    baseUnit: raw.base_unit as Unit,
    gramWeight: parseNumeric(raw.gram_weight) ?? null,
    calories,
    protein: parseNumeric(raw.protein) ?? null,
    carbs: parseNumeric(raw.carbs) ?? null,
    fat: parseNumeric(raw.fat) ?? null,
    isDefault: raw.is_default,
  };
};

export const transformSharedFood = (
  raw: SharedFoodApiResponse,
): SharedFood => ({
  id: raw.id,
  ownerUserId: raw.owner_user_id,
  name: raw.name,
  displayName: raw.display_name,
  description: raw.description,
  brand: raw.brand,
  barcode: raw.barcode,
  category: raw.category,
  visibility: raw.visibility as SharedFood["visibility"],
  moderationStatus: raw.moderation_status as SharedFood["moderationStatus"],
  createdAt: raw.created_at,
  updatedAt: raw.updated_at,
  portions: raw.portions.map(transformPortion),
});

export const transformListItem = (
  raw: SharedFoodListItemApiResponse,
): SharedFoodListItem => ({
  id: raw.id,
  ownerUserId: raw.owner_user_id,
  name: raw.name,
  displayName: raw.display_name,
  brand: raw.brand,
  barcode: raw.barcode,
  category: raw.category,
  visibility: raw.visibility as SharedFoodListItem["visibility"],
  moderationStatus:
    raw.moderation_status as SharedFoodListItem["moderationStatus"],
  defaultPortion: raw.default_portion
    ? transformPortion(raw.default_portion)
    : null,
});

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const searchSharedFoods = async (
  q?: string,
  limit?: number,
  offset?: number,
): Promise<SharedFoodListItem[]> => {
  const query: Record<string, string | number | boolean | undefined> = {};
  if (q) query.q = q;
  if (limit !== undefined) query.limit = limit;
  if (offset !== undefined) query.offset = offset;

  const raw = await apiFetch<SharedFoodListItemApiResponse[]>(
    "/v1/shared/foods/search",
    { query },
  );
  return raw.map(transformListItem);
};

export const getSharedFood = async (id: string): Promise<SharedFood> => {
  const raw = await apiFetch<SharedFoodApiResponse>(`/v1/shared/foods/${id}`);
  return transformSharedFood(raw);
};

export const listMySharedFoods = async (
  limit?: number,
  offset?: number,
): Promise<SharedFoodListItem[]> => {
  const query: Record<string, string | number | boolean | undefined> = {};
  if (limit !== undefined) query.limit = limit;
  if (offset !== undefined) query.offset = offset;

  const raw = await apiFetch<SharedFoodListItemApiResponse[]>(
    "/v1/shared/foods/mine",
    { query },
  );
  return raw.map(transformListItem);
};

export const createSharedFood = async (
  request: CreateSharedFoodRequest,
): Promise<SharedFood> => {
  const body = {
    name: request.name,
    display_name: request.displayName,
    description: request.description,
    brand: request.brand,
    barcode: request.barcode,
    category: request.category,
  };

  const raw = await apiFetch<SharedFoodApiResponse>("/v1/shared/foods", {
    method: "POST",
    body,
  });
  return transformSharedFood(raw);
};

export const publishSharedFood = async (id: string): Promise<SharedFood> => {
  const raw = await apiFetch<SharedFoodApiResponse>(
    `/v1/shared/foods/${id}/publish`,
    { method: "POST" },
  );
  return transformSharedFood(raw);
};

export const unpublishSharedFood = async (id: string): Promise<SharedFood> => {
  const raw = await apiFetch<SharedFoodApiResponse>(
    `/v1/shared/foods/${id}/unpublish`,
    { method: "POST" },
  );
  return transformSharedFood(raw);
};

export const addSharedFoodPortion = async (
  id: string,
  request: CreateSharedFoodPortionRequest,
): Promise<SharedFoodPortion> => {
  const body = {
    label: request.label,
    base_amount: request.baseAmount,
    base_unit: request.baseUnit,
    gram_weight: request.gramWeight,
    calories: request.calories,
    protein: request.protein,
    carbs: request.carbs,
    fat: request.fat,
    is_default: request.isDefault,
  };

  const raw = await apiFetch<SharedFoodPortionApiResponse>(
    `/v1/shared/foods/${id}/portions`,
    { method: "POST", body },
  );
  return transformPortion(raw);
};

export const importSharedFood = async (
  id: string,
): Promise<SharedFoodImportResult> => {
  const raw = await apiFetch<SharedFoodImportApiResponse>(
    `/v1/shared/foods/${id}/import`,
    { method: "POST" },
  );
  return {
    productId: raw.product_id,
    portionCount: raw.portion_count,
  };
};

export const deleteSharedFood = async (id: string): Promise<void> => {
  await apiFetch<void>(`/v1/shared/foods/${id}`, { method: "DELETE" });
};
