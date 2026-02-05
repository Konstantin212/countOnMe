import { apiFetch } from './http';

export type Unit = 'mg' | 'g' | 'kg' | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup';

export type PortionResponse = {
  id: string;
  product_id: string;
  label: string;
  base_amount: string;
  base_unit: Unit;
  calories: string;
  protein: string | null;
  carbs: string | null;
  fat: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
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

export const listPortions = async (productId: string): Promise<PortionResponse[]> => {
  return await apiFetch<PortionResponse[]>(`/v1/products/${productId}/portions`);
};

export const createPortion = async (
  productId: string,
  body: PortionCreateRequest,
): Promise<PortionResponse> => {
  return await apiFetch<PortionResponse>(`/v1/products/${productId}/portions`, {
    method: 'POST',
    body,
  });
};

export const getPortion = async (portionId: string): Promise<PortionResponse> => {
  return await apiFetch<PortionResponse>(`/v1/portions/${portionId}`);
};

export const updatePortion = async (
  portionId: string,
  patch: PortionUpdateRequest,
): Promise<PortionResponse> => {
  return await apiFetch<PortionResponse>(`/v1/portions/${portionId}`, { method: 'PATCH', body: patch });
};

export const deletePortion = async (portionId: string): Promise<void> => {
  await apiFetch<void>(`/v1/portions/${portionId}`, { method: 'DELETE' });
};

