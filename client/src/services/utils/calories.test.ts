import { describe, expect, it } from 'vitest';

import { MealItem, Product } from '@models/types';
import { calcMealCalories } from './calories';

const createProducts = (): Product[] => [
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

const createItems = (): MealItem[] => [
  { productId: 'chicken', grams: 150 },
  { productId: 'rice', grams: 200 },
];

describe('calcMealCalories', () => {
  it('calculates totals when all data is valid', () => {
    const products = createProducts();
    const items = createItems();

    expect(calcMealCalories(items, products)).toBeCloseTo(507.5);
  });

  it('skips items that reference missing products', () => {
    const products = createProducts();
    const items: MealItem[] = [
      { productId: 'unknown', grams: 100 },
      { productId: 'rice', grams: 100 },
    ];

    expect(calcMealCalories(items, products)).toBeCloseTo(130);
  });

  it('returns 0 for empty or invalid input', () => {
    const products = createProducts();

    expect(calcMealCalories([], products)).toBe(0);
    expect(calcMealCalories([{ productId: 'chicken', grams: 0 }], products)).toBe(0);
    expect(calcMealCalories(createItems(), [])).toBe(0);
  });
});




