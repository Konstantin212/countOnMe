import { ApiError, apiFetch } from "./http";
import { parseNumeric } from "@services/utils/parsing";

// API response type (Decimal fields come as strings from backend)
type CatalogPortionApiResponse = {
  id: string;
  label: string;
  gram_weight: string | number | null;
  calories: string | number;
  protein: string | number | null;
  carbs: string | number | null;
  fat: string | number | null;
  is_default: boolean;
  base_amount: string | number;
  base_unit: string;
};

type CatalogProductApiResponse = {
  id: string;
  source: string;
  source_id: string;
  name: string;
  display_name: string;
  brand: string | null;
  barcode: string | null;
  category: string | null;
  default_portion: CatalogPortionApiResponse | null;
  portions: CatalogPortionApiResponse[];
};

// Transformed types with proper numbers
export type CatalogPortionResponse = {
  id: string;
  label: string;
  gram_weight: number | null;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  is_default: boolean;
  base_amount: number;
  base_unit: string;
};

export type CatalogBarcodeResponse = {
  id: string;
  source: string;
  source_id: string;
  name: string;
  display_name: string;
  brand: string | null;
  barcode: string | null;
  category: string | null;
  default_portion: CatalogPortionResponse | null;
  portions: CatalogPortionResponse[];
};

const transformPortion = (
  p: CatalogPortionApiResponse,
): CatalogPortionResponse => {
  const baseAmount = parseNumeric(p.base_amount);
  const calories = parseNumeric(p.calories);

  if (baseAmount === undefined || calories === undefined) {
    throw new Error(
      `Invalid Decimal values in catalog portion: base_amount=${p.base_amount}, calories=${p.calories}`,
    );
  }

  return {
    id: p.id,
    label: p.label,
    base_amount: baseAmount,
    base_unit: p.base_unit,
    gram_weight: parseNumeric(p.gram_weight) ?? null,
    calories,
    protein: parseNumeric(p.protein) ?? null,
    carbs: parseNumeric(p.carbs) ?? null,
    fat: parseNumeric(p.fat) ?? null,
    is_default: p.is_default,
  };
};

const transformCatalogResponse = (
  raw: CatalogProductApiResponse,
): CatalogBarcodeResponse => ({
  id: raw.id,
  source: raw.source,
  source_id: raw.source_id,
  name: raw.name,
  display_name: raw.display_name,
  brand: raw.brand,
  barcode: raw.barcode,
  category: raw.category,
  default_portion: raw.default_portion
    ? transformPortion(raw.default_portion)
    : null,
  portions: raw.portions.map(transformPortion),
});

export const getCatalogProductByBarcode = async (
  barcode: string,
): Promise<CatalogBarcodeResponse | null> => {
  try {
    const raw = await apiFetch<CatalogProductApiResponse>(
      `/v1/catalog/products/barcode/${barcode}`,
    );
    return transformCatalogResponse(raw);
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
};
