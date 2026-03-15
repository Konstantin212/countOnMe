import { ApiError, apiFetch } from "./http";

export type CatalogPortionResponse = {
  id: string;
  name: string;
  gram_weight: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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

export const getCatalogProductByBarcode = async (
  barcode: string,
): Promise<CatalogBarcodeResponse | null> => {
  try {
    return await apiFetch<CatalogBarcodeResponse>(
      `/v1/catalog/products/barcode/${barcode}`,
    );
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
};
