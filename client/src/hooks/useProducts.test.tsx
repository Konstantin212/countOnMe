import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { Product } from '../models/types';
import { loadProducts, saveProducts } from '../storage/storage';
import { useProducts } from './useProducts';

vi.mock('../storage/storage', () => ({
  loadProducts: vi.fn(),
  saveProducts: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'uuid-mock'),
}));

const mockLoadProducts = vi.mocked(loadProducts);
const mockSaveProducts = vi.mocked(saveProducts);

const sampleProduct: Product = {
  id: 'product-1',
  name: 'Chicken',
  caloriesPer100g: 165,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const setupHook = async (initialProducts: Product[] = []) => {
  mockLoadProducts.mockResolvedValue(initialProducts);
  mockSaveProducts.mockResolvedValue();

  const hook = renderHook(() => useProducts());

  await waitFor(() => {
    expect(hook.result.current.loading).toBe(false);
  });

  return hook;
};

describe('useProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads products on mount', async () => {
    const { result } = await setupHook([sampleProduct]);

    expect(result.current.products).toEqual([sampleProduct]);
    expect(mockLoadProducts).toHaveBeenCalledTimes(1);
  });

  it('adds a product with sanitized values and persists', async () => {
    const { result } = await setupHook();

    await act(async () => {
      await result.current.addProduct({ name: '  Banana ', caloriesPer100g: -10 });
    });

    expect(result.current.products).toHaveLength(1);
    expect(result.current.products[0]).toMatchObject({
      id: 'uuid-mock',
      name: 'Banana',
      caloriesPer100g: 0,
    });
    expect(mockSaveProducts).toHaveBeenCalledTimes(1);
  });

  it('updates an existing product and clamps numbers', async () => {
    const { result } = await setupHook([sampleProduct]);

    await act(async () => {
      await result.current.updateProduct(sampleProduct.id, {
        name: '  Updated  ',
        caloriesPer100g: -5,
      });
    });

    expect(result.current.products[0]).toMatchObject({
      id: sampleProduct.id,
      name: 'Updated',
      caloriesPer100g: 0,
    });
    expect(mockSaveProducts).toHaveBeenCalledTimes(1);
  });

  it('deletes product by id and persists changes', async () => {
    const { result } = await setupHook([sampleProduct]);

    await act(async () => {
      await result.current.deleteProduct(sampleProduct.id);
    });

    expect(result.current.products).toHaveLength(0);
    expect(mockSaveProducts).toHaveBeenCalledTimes(1);
  });

  it('ignores updates for missing product ids without persisting', async () => {
    const { result } = await setupHook([sampleProduct]);

    await act(async () => {
      await result.current.updateProduct('missing', { name: 'Ghost' });
    });

    expect(result.current.products).toEqual([sampleProduct]);
    expect(mockSaveProducts).not.toHaveBeenCalled();
  });
});

