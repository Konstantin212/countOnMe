import { MealItem, Product } from '../models/types';

/**
 * Calculates total meal calories using gram inputs.
 * Missing products or invalid gram values are skipped so UI never crashes.
 */
export const calcMealCalories = (items: MealItem[], products: Product[]): number => {
  if (!items?.length) {
    return 0;
  }

  return items.reduce((total, item) => {
    if (!item || item.grams <= 0) {
      return total;
    }

    const product = products.find((candidate) => candidate.id === item.productId);

    if (!product || product.caloriesPer100g <= 0) {
      return total;
    }

    const calories = (product.caloriesPer100g * item.grams) / 100;
    return total + calories;
  }, 0);
};
