import { apiFetch } from "./http";

export type ProductResponse = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export const listProducts = async (): Promise<ProductResponse[]> => {
  return await apiFetch<ProductResponse[]>("/v1/products");
};

export const createProduct = async (body: {
  id?: string;
  name: string;
}): Promise<ProductResponse> => {
  return await apiFetch<ProductResponse>("/v1/products", {
    method: "POST",
    body,
  });
};

export const getProduct = async (
  productId: string,
): Promise<ProductResponse> => {
  return await apiFetch<ProductResponse>(`/v1/products/${productId}`);
};

export const updateProduct = async (
  productId: string,
  patch: { name?: string },
): Promise<ProductResponse> => {
  return await apiFetch<ProductResponse>(`/v1/products/${productId}`, {
    method: "PATCH",
    body: patch,
  });
};

export const deleteProduct = async (productId: string): Promise<void> => {
  await apiFetch<void>(`/v1/products/${productId}`, { method: "DELETE" });
};

export type ProductNameCheckResponse = { available: boolean };

export type ProductSearchResultResponse = {
  id: string;
  name: string;
  source: "user" | "catalog";
  calories_per_100g: number | null;
  catalog_id: string | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  display_name: string | null;
  brand: string | null;
};

export const checkProductName = async (
  name: string,
): Promise<ProductNameCheckResponse> => {
  return await apiFetch<ProductNameCheckResponse>(
    `/v1/products/check-name?name=${encodeURIComponent(name)}`,
  );
};

export const searchProducts = async (
  q: string,
  limit = 35,
): Promise<ProductSearchResultResponse[]> => {
  return await apiFetch<ProductSearchResultResponse[]>(
    `/v1/products/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
};
