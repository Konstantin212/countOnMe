import { MealItem, Product } from '@models/types';
import { convertUnit } from './units';

const buildProductIndex = (products: Product[]): Map<string, Product> => {
  return products.reduce((acc, product) => {
    acc.set(product.id, product);
    return acc;
  }, new Map<string, Product>());
};

const resolveProductBase = (
  product: Product,
): { baseAmount: number; baseUnit: Product['scaleUnit'] | 'g'; caloriesPerBase: number } => {
  if (
    typeof product.caloriesPerBase === 'number' &&
    Number.isFinite(product.caloriesPerBase) &&
    typeof product.portionSize === 'number' &&
    Number.isFinite(product.portionSize) &&
    product.portionSize > 0 &&
    product.scaleUnit
  ) {
    return {
      baseAmount: product.portionSize,
      baseUnit: product.scaleUnit,
      caloriesPerBase: product.caloriesPerBase,
    };
  }

  // Legacy fallback: caloriesPer100g
  return {
    baseAmount: 100,
    baseUnit: 'g',
    caloriesPerBase: product.caloriesPer100g,
  };
};

const getItemCalories = (item: MealItem, product: Product): number => {
  const { baseAmount, baseUnit, caloriesPerBase } = resolveProductBase(product);
  if (item.amount <= 0 || caloriesPerBase <= 0) {
    return 0;
  }

  const converted = convertUnit(item.amount, item.unit, baseUnit as any);
  if (converted === null) {
    return 0;
  }

  return caloriesPerBase * (converted / baseAmount);
};

/**
 * Calculates total meal calories using amount+unit inputs.
 * Missing products or invalid amounts are skipped so UI never crashes.
 */
export const calcMealCalories = (items: MealItem[], products: Product[]): number => {
  if (!items?.length || !products?.length) {
    return 0;
  }

  const productIndex = buildProductIndex(products);

  return items.reduce((total, item) => {
    if (!item || item.amount <= 0) {
      return total;
    }

    const product = productIndex.get(item.productId);

    if (!product || (product.caloriesPer100g <= 0 && (product.caloriesPerBase ?? 0) <= 0)) {
      return total;
    }

    return total + getItemCalories(item, product);
  }, 0);
};
