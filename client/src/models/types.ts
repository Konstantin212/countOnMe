export type ISODateString = string;

/**
 * Normalized product stored in AsyncStorage and referenced by meals via id.
 * Optional macro fields allow us to enrich nutrition data incrementally.
 */
export type Product = {
  id: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

/**
 * Meal item keeps the relationship between a meal and a product.
 * The grams value stays raw so totals can always be recalculated.
 */
export type MealItem = {
  productId: string;
  grams: number;
};

/**
 * Stored meal with a cached calories total for fast list rendering.
 * The total must always be derived via calcMealCalories before save.
 */
export type Meal = {
  id: string;
  name: string;
  items: MealItem[];
  totalCalories: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};
