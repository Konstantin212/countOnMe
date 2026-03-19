import { describe, it, expect } from "vitest";
import {
  calculateNutrition,
  classifyPortionMode,
  type NutritionResult,
} from "./nutrition";
import type { CatalogPortionData } from "@hooks/useBarcodeLookup";
import type { Scale } from "./scales";

const makeServingPortion = (
  overrides?: Partial<CatalogPortionData>,
): CatalogPortionData => ({
  id: "portion-serving",
  label: "1 serving (30g)",
  baseAmount: 30,
  baseUnit: "g",
  gramWeight: 30,
  calories: 120,
  protein: 5,
  carbs: 20,
  fat: 3,
  isDefault: true,
  ...overrides,
});

const makePer100gPortion = (
  overrides?: Partial<CatalogPortionData>,
): CatalogPortionData => ({
  id: "portion-100g",
  label: "100g",
  baseAmount: 100,
  baseUnit: "g",
  gramWeight: 100,
  calories: 400,
  protein: 16.7,
  carbs: 66.7,
  fat: 10,
  isDefault: false,
  ...overrides,
});

describe("classifyPortionMode", () => {
  it('returns "weight" for a portion with baseAmount=100 and baseUnit="g"', () => {
    const portion = makePer100gPortion();
    expect(classifyPortionMode(portion)).toBe("weight");
  });

  it('returns "serving" for a portion with baseAmount != 100', () => {
    const portion = makeServingPortion({ baseAmount: 30 });
    expect(classifyPortionMode(portion)).toBe("serving");
  });

  it('returns "serving" for a portion with baseUnit != "g"', () => {
    const portion = makeServingPortion({ baseAmount: 100, baseUnit: "ml" });
    expect(classifyPortionMode(portion)).toBe("serving");
  });

  it('returns "serving" for a portion with baseAmount=100 and baseUnit="ml"', () => {
    const portion = makeServingPortion({ baseAmount: 100, baseUnit: "ml" });
    expect(classifyPortionMode(portion)).toBe("serving");
  });
});

describe("calculateNutrition", () => {
  describe("serving mode", () => {
    it("calculates nutrition for 1 serving", () => {
      const portion = makeServingPortion();
      const result = calculateNutrition(portion, "serving", 1, 100, "g");

      expect(result).toEqual<NutritionResult>({
        calories: 120,
        protein: 5,
        carbs: 20,
        fat: 3,
        totalGrams: 30,
      });
    });

    it("calculates nutrition for 2 servings", () => {
      const portion = makeServingPortion();
      const result = calculateNutrition(portion, "serving", 2, 100, "g");

      expect(result).toEqual<NutritionResult>({
        calories: 240,
        protein: 10,
        carbs: 40,
        fat: 6,
        totalGrams: 60,
      });
    });

    it("calculates nutrition for 0.5 servings", () => {
      const portion = makeServingPortion();
      const result = calculateNutrition(portion, "serving", 0.5, 100, "g");

      expect(result).toEqual<NutritionResult>({
        calories: 60,
        protein: 2.5,
        carbs: 10,
        fat: 1.5,
        totalGrams: 15,
      });
    });

    it("returns zeros for quantity of 0", () => {
      const portion = makeServingPortion();
      const result = calculateNutrition(portion, "serving", 0, 100, "g");

      expect(result).toEqual<NutritionResult>({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        totalGrams: 0,
      });
    });

    it("returns zeros for negative quantity", () => {
      const portion = makeServingPortion();
      const result = calculateNutrition(portion, "serving", -1, 100, "g");

      expect(result).toEqual<NutritionResult>({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        totalGrams: 0,
      });
    });
  });

  describe("weight mode", () => {
    it("calculates nutrition for 100g (1:1 ratio)", () => {
      const portion = makePer100gPortion();
      const result = calculateNutrition(portion, "weight", 1, 100, "g");

      expect(result).toEqual<NutritionResult>({
        calories: 400,
        protein: 16.7,
        carbs: 66.7,
        fat: 10,
        totalGrams: 100,
      });
    });

    it("calculates nutrition for 150g (1.5x ratio)", () => {
      const portion = makePer100gPortion();
      const result = calculateNutrition(portion, "weight", 1, 150, "g");

      expect(result.calories).toBeCloseTo(600, 2);
      expect(result.protein).toBeCloseTo(25.05, 2);
      expect(result.carbs).toBeCloseTo(100.05, 2);
      expect(result.fat).toBeCloseTo(15, 2);
      expect(result.totalGrams).toBe(150);
    });

    it("calculates nutrition for 50g (0.5x ratio)", () => {
      const portion = makePer100gPortion();
      const result = calculateNutrition(portion, "weight", 1, 50, "g");

      expect(result.calories).toBeCloseTo(200, 2);
      expect(result.protein).toBeCloseTo(8.35, 2);
      expect(result.carbs).toBeCloseTo(33.35, 2);
      expect(result.fat).toBeCloseTo(5, 2);
      expect(result.totalGrams).toBe(50);
    });

    it("converts kg to grams for calculation", () => {
      const portion = makePer100gPortion();
      const result = calculateNutrition(portion, "weight", 1, 0.5, "kg");

      // 0.5 kg = 500g. Ratio = 500/100 = 5
      expect(result).toEqual<NutritionResult>({
        calories: 2000,
        protein: 83.5,
        carbs: 333.5,
        fat: 50,
        totalGrams: 500,
      });
    });

    it("converts mg to grams for calculation", () => {
      const portion = makePer100gPortion();
      const result = calculateNutrition(portion, "weight", 1, 50000, "mg");

      // 50000 mg = 50g. Ratio = 50/100 = 0.5
      expect(result.calories).toBeCloseTo(200, 2);
      expect(result.protein).toBeCloseTo(8.35, 2);
      expect(result.carbs).toBeCloseTo(33.35, 2);
      expect(result.fat).toBeCloseTo(5, 2);
      expect(result.totalGrams).toBe(50);
    });

    it("returns zeros for 0 weight amount", () => {
      const portion = makePer100gPortion();
      const result = calculateNutrition(portion, "weight", 1, 0, "g");

      expect(result).toEqual<NutritionResult>({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        totalGrams: 0,
      });
    });

    it("returns zeros for negative weight amount", () => {
      const portion = makePer100gPortion();
      const result = calculateNutrition(portion, "weight", 1, -100, "g");

      expect(result).toEqual<NutritionResult>({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        totalGrams: 0,
      });
    });

    it("handles null gramWeight by falling back to baseAmount", () => {
      const portion = makePer100gPortion({ gramWeight: null });
      const result = calculateNutrition(portion, "weight", 1, 150, "g");

      // gramWeight is null, falls back to baseAmount (100)
      // ratio = 150 / 100 = 1.5
      expect(result.calories).toBeCloseTo(600, 2);
      expect(result.protein).toBeCloseTo(25.05, 2);
      expect(result.carbs).toBeCloseTo(100.05, 2);
      expect(result.fat).toBeCloseTo(15, 2);
      expect(result.totalGrams).toBe(150);
    });

    it("handles zero gramWeight by falling back to baseAmount", () => {
      const portion = makePer100gPortion({ gramWeight: 0 });
      const result = calculateNutrition(portion, "weight", 1, 150, "g");

      // gramWeight is 0, falls back to baseAmount (100)
      expect(result.calories).toBeCloseTo(600, 2);
      expect(result.protein).toBeCloseTo(25.05, 2);
      expect(result.carbs).toBeCloseTo(100.05, 2);
      expect(result.fat).toBeCloseTo(15, 2);
      expect(result.totalGrams).toBe(150);
    });

    it("handles null macros by treating them as 0", () => {
      const portion = makePer100gPortion({
        protein: null,
        carbs: null,
        fat: null,
      });
      const result = calculateNutrition(portion, "weight", 0, 200, "g");
      expect(result.calories).toBeCloseTo(800, 2);
      expect(result.protein).toBe(0);
      expect(result.carbs).toBe(0);
      expect(result.fat).toBe(0);
    });

    it("handles null macros in serving mode", () => {
      const portion = makeServingPortion({
        protein: null,
        carbs: null,
        fat: null,
      });
      const result = calculateNutrition(portion, "serving", 3, 0, "g");
      expect(result.calories).toBeCloseTo(360, 2);
      expect(result.protein).toBe(0);
      expect(result.carbs).toBe(0);
      expect(result.fat).toBe(0);
    });
  });
});
