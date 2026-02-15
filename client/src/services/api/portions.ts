import { apiFetch } from "./http";
import { parseNumeric } from "@services/utils/parsing";

export type Unit = "mg" | "g" | "kg" | "ml" | "l" | "tsp" | "tbsp" | "cup";

// API response type (Decimal fields come as strings from backend)
type PortionApiResponse = {
  id: string;
  product_id: string;
  label: string;
  base_amount: string | number; // Decimal from backend
  base_unit: Unit;
  calories: string | number; // Decimal from backend
  protein: string | number | null; // Decimal from backend
  carbs: string | number | null; // Decimal from backend
  fat: string | number | null; // Decimal from backend
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

// Frontend type with parsed numbers
export type Portion = {
  id: string;
  productId: string;
  label: string;
  baseAmount: number;
  baseUnit: Unit;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PortionCreateRequest = {
  label: string;
  base_amount: string | number;
  base_unit: Unit;
  calories: string | number;
  protein?: string | number | null;
  carbs?: string | number | null;
  fat?: string | number | null;
  is_default?: boolean;
};

export type PortionUpdateRequest = Partial<PortionCreateRequest>;

// Transform API response to frontend type
const transformPortionResponse = (response: PortionApiResponse): Portion => {
  const baseAmount = parseNumeric(response.base_amount);
  const calories = parseNumeric(response.calories);

  if (baseAmount === undefined || calories === undefined) {
    throw new Error(
      `Invalid Decimal values in portion response: baseAmount=${response.base_amount}, calories=${response.calories}`,
    );
  }

  return {
    id: response.id,
    productId: response.product_id,
    label: response.label,
    baseAmount,
    baseUnit: response.base_unit,
    calories,
    protein: parseNumeric(response.protein) ?? null,
    carbs: parseNumeric(response.carbs) ?? null,
    fat: parseNumeric(response.fat) ?? null,
    isDefault: response.is_default,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
};

export const listPortions = async (productId: string): Promise<Portion[]> => {
  const responses = await apiFetch<PortionApiResponse[]>(
    `/v1/products/${productId}/portions`,
  );
  return responses.map(transformPortionResponse);
};

export const createPortion = async (
  productId: string,
  body: PortionCreateRequest,
): Promise<Portion> => {
  const response = await apiFetch<PortionApiResponse>(
    `/v1/products/${productId}/portions`,
    {
      method: "POST",
      body,
    },
  );
  return transformPortionResponse(response);
};

export const getPortion = async (portionId: string): Promise<Portion> => {
  const response = await apiFetch<PortionApiResponse>(
    `/v1/portions/${portionId}`,
  );
  return transformPortionResponse(response);
};

export const updatePortion = async (
  portionId: string,
  patch: PortionUpdateRequest,
): Promise<Portion> => {
  const response = await apiFetch<PortionApiResponse>(
    `/v1/portions/${portionId}`,
    {
      method: "PATCH",
      body: patch,
    },
  );
  return transformPortionResponse(response);
};

export const deletePortion = async (portionId: string): Promise<void> => {
  await apiFetch<void>(`/v1/portions/${portionId}`, { method: "DELETE" });
};
