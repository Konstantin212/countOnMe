import { describe, it, expect } from "vitest";
import {
  type Scale,
  SCALE_OPTIONS,
  toGrams,
  fromGrams,
  calculateCaloriesPer100g,
  suggestScale,
} from "./scales";

describe("scales utilities", () => {
  describe("SCALE_OPTIONS", () => {
    it("contains all three scale types with correct multipliers", () => {
      expect(SCALE_OPTIONS).toHaveLength(3);
      expect(SCALE_OPTIONS).toEqual([
        { value: "mg", label: "mg", multiplier: 0.001 },
        { value: "g", label: "g", multiplier: 1 },
        { value: "kg", label: "kg", multiplier: 1000 },
      ]);
    });
  });

  describe("toGrams", () => {
    it("converts milligrams to grams", () => {
      expect(toGrams(500, "mg")).toBe(0.5);
      expect(toGrams(1000, "mg")).toBe(1);
    });

    it("returns grams as-is", () => {
      expect(toGrams(100, "g")).toBe(100);
      expect(toGrams(50.5, "g")).toBe(50.5);
    });

    it("converts kilograms to grams", () => {
      expect(toGrams(1, "kg")).toBe(1000);
      expect(toGrams(2.5, "kg")).toBe(2500);
    });

    it("handles zero value", () => {
      expect(toGrams(0, "g")).toBe(0);
      expect(toGrams(0, "mg")).toBe(0);
      expect(toGrams(0, "kg")).toBe(0);
    });

    it("handles negative values", () => {
      expect(toGrams(-100, "g")).toBe(-100);
      expect(toGrams(-500, "mg")).toBe(-0.5);
    });

    it("returns original value for unknown scale", () => {
      expect(toGrams(100, "unknown" as Scale)).toBe(100);
    });
  });

  describe("fromGrams", () => {
    it("converts grams to milligrams", () => {
      expect(fromGrams(1, "mg")).toBe(1000);
      expect(fromGrams(0.5, "mg")).toBe(500);
    });

    it("returns grams as-is", () => {
      expect(fromGrams(100, "g")).toBe(100);
      expect(fromGrams(50.5, "g")).toBe(50.5);
    });

    it("converts grams to kilograms", () => {
      expect(fromGrams(1000, "kg")).toBe(1);
      expect(fromGrams(2500, "kg")).toBe(2.5);
    });

    it("handles zero value", () => {
      expect(fromGrams(0, "g")).toBe(0);
      expect(fromGrams(0, "mg")).toBe(0);
      expect(fromGrams(0, "kg")).toBe(0);
    });

    it("handles negative values", () => {
      expect(fromGrams(-100, "g")).toBe(-100);
      expect(fromGrams(-1, "kg")).toBe(-0.001);
    });

    it("returns original value for unknown scale", () => {
      expect(fromGrams(100, "unknown" as Scale)).toBe(100);
    });
  });

  describe("calculateCaloriesPer100g", () => {
    it("calculates calories per 100g from grams", () => {
      // 200 kcal in 150g => (200 * 100) / 150 = 133.33... kcal per 100g
      expect(calculateCaloriesPer100g(200, 150, "g")).toBeCloseTo(133.33, 2);
    });

    it("calculates calories per 100g from kilograms", () => {
      // 1000 kcal in 2kg (2000g) => (1000 * 100) / 2000 = 50 kcal per 100g
      expect(calculateCaloriesPer100g(1000, 2, "kg")).toBe(50);
    });

    it("calculates calories per 100g from milligrams", () => {
      // 10 kcal in 5000mg (5g) => (10 * 100) / 5 = 200 kcal per 100g
      expect(calculateCaloriesPer100g(10, 5000, "mg")).toBe(200);
    });

    it("returns zero when amount is zero", () => {
      expect(calculateCaloriesPer100g(200, 0, "g")).toBe(0);
    });

    it("returns zero when amount is negative", () => {
      expect(calculateCaloriesPer100g(200, -100, "g")).toBe(0);
    });

    it("handles zero calories", () => {
      expect(calculateCaloriesPer100g(0, 100, "g")).toBe(0);
    });

    it("handles decimal amounts", () => {
      // 165 kcal in 75.5g => (165 * 100) / 75.5 = 218.54 kcal per 100g
      expect(calculateCaloriesPer100g(165, 75.5, "g")).toBeCloseTo(218.54, 2);
    });

    it("handles very small amounts in milligrams", () => {
      // 5 kcal in 100mg (0.1g) => (5 * 100) / 0.1 = 5000 kcal per 100g
      expect(calculateCaloriesPer100g(5, 100, "mg")).toBe(5000);
    });
  });

  describe("suggestScale", () => {
    it("suggests mg for amounts less than 1 gram", () => {
      expect(suggestScale(0.5)).toBe("mg");
      expect(suggestScale(0.001)).toBe("mg");
      expect(suggestScale(0.999)).toBe("mg");
    });

    it("suggests g for amounts between 1 and 999 grams", () => {
      expect(suggestScale(1)).toBe("g");
      expect(suggestScale(100)).toBe("g");
      expect(suggestScale(500)).toBe("g");
      expect(suggestScale(999)).toBe("g");
    });

    it("suggests kg for amounts of 1000 grams or more", () => {
      expect(suggestScale(1000)).toBe("kg");
      expect(suggestScale(1500)).toBe("kg");
      expect(suggestScale(10000)).toBe("kg");
    });

    it("handles zero", () => {
      expect(suggestScale(0)).toBe("mg");
    });

    it("handles negative values", () => {
      expect(suggestScale(-100)).toBe("mg");
    });
  });

  describe("round-trip conversion", () => {
    it("converts g -> kg -> g", () => {
      const grams = 2500;
      const kg = fromGrams(grams, "kg");
      const backToGrams = toGrams(kg, "kg");
      expect(backToGrams).toBe(grams);
    });

    it("converts g -> mg -> g", () => {
      const grams = 5;
      const mg = fromGrams(grams, "mg");
      const backToGrams = toGrams(mg, "mg");
      expect(backToGrams).toBe(grams);
    });

    it("converts mg -> g -> mg", () => {
      const mg = 1500;
      const g = toGrams(mg, "mg");
      const backToMg = fromGrams(g, "mg");
      expect(backToMg).toBe(mg);
    });
  });
});
