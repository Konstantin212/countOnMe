/**
 * Scale/unit conversion utilities for product amounts
 */

export type Scale = 'mg' | 'g' | 'kg';

export type ScaleOption = {
  value: Scale;
  label: string;
  multiplier: number; // Relative to grams
};

export const SCALE_OPTIONS: ScaleOption[] = [
  { value: 'mg', label: 'mg', multiplier: 0.001 },
  { value: 'g', label: 'g', multiplier: 1 },
  { value: 'kg', label: 'kg', multiplier: 1000 },
];

/**
 * Convert value from one scale to grams
 */
export const toGrams = (value: number, scale: Scale): number => {
  const option = SCALE_OPTIONS.find((s) => s.value === scale);
  if (!option) return value;
  return value * option.multiplier;
};

/**
 * Convert value from grams to target scale
 */
export const fromGrams = (grams: number, targetScale: Scale): number => {
  const option = SCALE_OPTIONS.find((s) => s.value === targetScale);
  if (!option) return grams;
  return grams / option.multiplier;
};

/**
 * Calculate calories per 100g based on input amount and scale
 * @param totalCalories - Total calories for the given amount
 * @param amount - Amount in the given scale
 * @param scale - The scale/unit of the amount
 */
export const calculateCaloriesPer100g = (
  totalCalories: number,
  amount: number,
  scale: Scale,
): number => {
  if (amount <= 0) return 0;

  const gramsAmount = toGrams(amount, scale);
  if (gramsAmount <= 0) return 0;

  // Calculate calories per 100g
  return (totalCalories * 100) / gramsAmount;
};

/**
 * Get a default scale suggestion based on the amount
 */
export const suggestScale = (gramsAmount: number): Scale => {
  if (gramsAmount < 1) return 'mg';
  if (gramsAmount >= 1000) return 'kg';
  return 'g';
};

