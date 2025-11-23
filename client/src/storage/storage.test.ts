import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Meal, Product } from '../models/types';
import { loadMeals, loadProducts, saveMeals, saveProducts } from './storage';

const storageStore = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => {
  return {
    default: {
      getItem: vi.fn(async (key: string) => storageStore.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        storageStore.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        storageStore.delete(key);
      }),
      clear: vi.fn(async () => {
        storageStore.clear();
      }),
    },
  };
});

describe('storage repositories', () => {
  beforeEach(() => {
    storageStore.clear();
  });

  const sampleProducts: Product[] = [
    {
      id: 'chicken',
      name: 'Chicken breast',
      caloriesPer100g: 165,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'rice',
      name: 'Cooked rice',
      caloriesPer100g: 130,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  ];

  const sampleMeals: Meal[] = [
    {
      id: 'meal-1',
      name: 'Lunch',
      items: [
        { productId: 'chicken', grams: 150 },
        { productId: 'rice', grams: 200 },
      ],
      totalCalories: 507.5,
      createdAt: '2025-01-01T12:00:00.000Z',
      updatedAt: '2025-01-01T12:00:00.000Z',
    },
  ];

  it('returns empty arrays when nothing is stored', async () => {
    await expect(loadProducts()).resolves.toEqual([]);
    await expect(loadMeals()).resolves.toEqual([]);
  });

  it('saves and loads products via AsyncStorage', async () => {
    await saveProducts(sampleProducts);
    await expect(loadProducts()).resolves.toEqual(sampleProducts);
  });

  it('saves and loads meals via AsyncStorage', async () => {
    await saveMeals(sampleMeals);
    await expect(loadMeals()).resolves.toEqual(sampleMeals);
  });
});

