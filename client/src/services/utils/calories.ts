import { MealItem, Product } from '../../models/types';

const CALORIES_SCALE = 100;

const buildProductIndex = (products: Product[]): Map<string, Product> => {
  return products.reduce((acc, product) => {
    acc.set(product.id, product);
    return acc;
  }, new Map<string, Product>());
};

const getItemCalories = (grams: number, caloriesPer100g: number): number => {
  return (caloriesPer100g * grams) / CALORIES_SCALE;
};

/**
 * Calculates total meal calories using gram inputs.
 * Missing products or invalid gram values are skipped so UI never crashes.
 */
export const calcMealCalories = (items: MealItem[], products: Product[]): number => {
  if (!items?.length || !products?.length) {
    return 0;
  }

  const productIndex = buildProductIndex(products);

  return items.reduce((total, item) => {
    if (!item || item.grams <= 0) {
      return total;
    }

    const product = productIndex.get(item.productId);

    if (!product || product.caloriesPer100g <= 0) {
      return total;
    }

    return total + getItemCalories(item.grams, product.caloriesPer100g);
  }, 0);
};
