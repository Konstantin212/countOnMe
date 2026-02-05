export type ISODateString = string;

export type Unit = 'mg' | 'g' | 'kg' | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup';
export type ScaleType = 'Liquid' | 'Solid' | 'Dry';

export type MealTypeKey = 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'water';

/**
 * Macro totals for a day or meal type.
 */
export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/**
 * Stats for a specific day.
 */
export type DayStats = {
  day: string; // YYYY-MM-DD
  totals: MacroTotals;
  byMealType: Partial<Record<MealTypeKey, MacroTotals>>;
};

// Goal-related types
export type GoalType = 'calculated' | 'manual';
export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type WeightGoalType = 'lose' | 'maintain' | 'gain';
export type WeightChangePace = 'slow' | 'moderate' | 'aggressive';
export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

/**
 * User nutrition goal - either calculated from body metrics or manually entered.
 */
export type UserGoal = {
  id: string;
  goalType: GoalType;

  // Body metrics (for calculated goals)
  gender?: Gender;
  birthDate?: ISODateString;
  heightCm?: number;
  currentWeightKg?: number;
  activityLevel?: ActivityLevel;

  // Weight goal (for calculated)
  weightGoalType?: WeightGoalType;
  targetWeightKg?: number;
  weightChangePace?: WeightChangePace;

  // Calculated values (for calculated goals)
  bmrKcal?: number;
  tdeeKcal?: number;

  // Targets (always present)
  dailyCaloriesKcal: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  waterMl: number;

  // Weight range (for calculated goals)
  healthyWeightMinKg?: number;
  healthyWeightMaxKg?: number;
  currentBmi?: number;
  bmiCategory?: BmiCategory;

  createdAt: ISODateString;
  updatedAt: ISODateString;
};

/**
 * Request to calculate goal (preview before saving).
 */
export type GoalCalculateRequest = {
  gender: Gender;
  birthDate: string; // ISO date string YYYY-MM-DD
  heightCm: number;
  currentWeightKg: number;
  activityLevel: ActivityLevel;
  weightGoalType: WeightGoalType;
  targetWeightKg?: number;
  weightChangePace?: WeightChangePace;
};

/**
 * Response from goal calculation (preview).
 */
export type GoalCalculateResponse = {
  bmrKcal: number;
  tdeeKcal: number;
  dailyCaloriesKcal: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  waterMl: number;
  healthyWeightMinKg: number;
  healthyWeightMaxKg: number;
  currentBmi: number;
  bmiCategory: string;
};

/**
 * Request to create calculated goal.
 */
export type GoalCreateCalculatedRequest = GoalCalculateRequest & {
  id?: string;
  proteinPercent?: number;
  carbsPercent?: number;
  fatPercent?: number;
  waterMl?: number;
};

/**
 * Request to create manual goal.
 */
export type GoalCreateManualRequest = {
  id?: string;
  dailyCaloriesKcal: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
  waterMl: number;
};

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

/**
 * Enriched food entry with product details for display.
 * Combines backend FoodEntryResponse with resolved product info.
 */
export type EnrichedFoodEntry = {
  id: string;
  productId: string;
  productName: string;
  portionId: string;
  amount: number;
  unit: Unit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Units that can be selected (same group as current unit) */
  allowedUnits: Unit[];
  createdAt: ISODateString;
};
