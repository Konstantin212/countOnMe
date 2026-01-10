export type ISODateString = string;

export type Unit = 'mg' | 'g' | 'kg' | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup';
export type ScaleType = 'Liquid' | 'Solid' | 'Dry';

export type MealTypeKey = 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'water';

/**
 * Normalized product stored in AsyncStorage and referenced by meals via id.
 * Optional macro fields allow us to enrich nutrition data incrementally.
 */
export type Product = {
  id: string;
  name: string;
  category?: string;

  /**
   * Nutrition reference base, as defined in ProductForm.
   * Example: portionSize=100, scaleUnit='g' => caloriesPerBase is per 100g.
   */
  portionSize?: number;
  scaleType?: ScaleType;
  scaleUnit?: Unit;
  allowedUnits?: Unit[]; // derived from scaleType/scaleUnit; excludes the base scaleUnit
  caloriesPerBase?: number;
  proteinPerBase?: number;
  carbsPerBase?: number;
  fatPerBase?: number;

  /**
   * Legacy fields (pre AddMealFlow v2). Kept for migration/back-compat reads.
   * Interpreted as per 100g when scale is mass-based.
   */
  caloriesPer100g: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

/**
 * Meal item keeps the relationship between a meal and a product.
 * Amount + unit stays raw so totals can always be recalculated.
 */
export type MealItem = {
  productId: string;
  amount: number;
  unit: Unit;
};

/**
 * Stored meal with a cached calories total for fast list rendering.
 * The total must always be derived via calcMealCalories before save.
 */
export type Meal = {
  id: string;
  name: string;
  mealType?: MealTypeKey;
  items: MealItem[];
  totalCalories: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};
