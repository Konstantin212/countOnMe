/**
 * Pure nutrition calculation utilities for catalog portion-based food tracking.
 */

import type { CatalogPortionData } from "@hooks/useBarcodeLookup";
import { type Scale, toGrams } from "./scales";

export type PortionMode = "serving" | "weight";

export type NutritionResult = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  totalGrams: number;
};

const ZERO_RESULT: NutritionResult = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  totalGrams: 0,
};

/**
 * Classify a catalog portion as "serving" or "weight" (per-100g).
 * A portion is weight mode if baseAmount === 100 and baseUnit === "g".
 */
export const classifyPortionMode = (
  portion: CatalogPortionData,
): PortionMode =>
  portion.baseAmount === 100 && portion.baseUnit === "g" ? "weight" : "serving";

/**
 * Calculate nutrition values based on a catalog portion, mode, and user input.
 *
 * Serving mode: nutrition = portion values * quantity
 * Weight mode:  nutrition = portion values * (convertedGrams / referenceGrams)
 *   where referenceGrams = gramWeight (if valid) or baseAmount
 */
export const calculateNutrition = (
  portion: CatalogPortionData,
  mode: PortionMode,
  quantity: number,
  weightAmount: number,
  weightUnit: Scale,
): NutritionResult => {
  if (mode === "serving") {
    if (quantity <= 0) {
      return ZERO_RESULT;
    }
    return {
      calories: portion.calories * quantity,
      protein: (portion.protein ?? 0) * quantity,
      carbs: (portion.carbs ?? 0) * quantity,
      fat: (portion.fat ?? 0) * quantity,
      totalGrams: portion.baseAmount * quantity,
    };
  }

  // Weight mode
  const grams = toGrams(weightAmount, weightUnit);
  if (grams <= 0) {
    return ZERO_RESULT;
  }

  const referenceGrams =
    portion.gramWeight !== null && portion.gramWeight > 0
      ? portion.gramWeight
      : portion.baseAmount;

  const ratio = grams / referenceGrams;

  return {
    calories: portion.calories * ratio,
    protein: (portion.protein ?? 0) * ratio,
    carbs: (portion.carbs ?? 0) * ratio,
    fat: (portion.fat ?? 0) * ratio,
    totalGrams: grams,
  };
};
