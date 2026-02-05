import { apiFetch } from './http';

export type ProductResponse = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export const listProducts = async (): Promise<ProductResponse[]> => {
  return await apiFetch<ProductResponse[]>('/v1/products');
};

export const createProduct = async (body: { id?: string; name: string }): Promise<ProductResponse> => {
  return await apiFetch<ProductResponse>('/v1/products', { method: 'POST', body });
};

export const getProduct = async (productId: string): Promise<ProductResponse> => {
  return await apiFetch<ProductResponse>(`/v1/products/${productId}`);
};

export const updateProduct = async (
  productId: string,
  patch: { name?: string },
): Promise<ProductResponse> => {
  return await apiFetch<ProductResponse>(`/v1/products/${productId}`, { method: 'PATCH', body: patch });
};

export const deleteProduct = async (productId: string): Promise<void> => {
  await apiFetch<void>(`/v1/products/${productId}`, { method: 'DELETE' });
};

