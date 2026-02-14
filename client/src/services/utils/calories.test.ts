import { describe, expect, it } from "vitest";

import { MealItem, Product } from "@models/types";
import { calcMealCalories } from "./calories";

const createProducts = (): Product[] => [
  {
    id: "chicken",
    name: "Chicken breast",
    caloriesPer100g: 165,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "rice",
    name: "Cooked rice",
    caloriesPer100g: 130,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
];

const createItems = (): MealItem[] => [
  { productId: "chicken", amount: 150, unit: "g" },
  { productId: "rice", amount: 200, unit: "g" },
];

describe("calcMealCalories", () => {
  it("calculates totals when all data is valid", () => {
    const products = createProducts();
    const items = createItems();

    expect(calcMealCalories(items, products)).toBeCloseTo(507.5);
  });

  it("skips items that reference missing products", () => {
    const products = createProducts();
    const items: MealItem[] = [
      { productId: "unknown", amount: 100, unit: "g" },
      { productId: "rice", amount: 100, unit: "g" },
    ];

    expect(calcMealCalories(items, products)).toBeCloseTo(130);
  });

  it("returns 0 for empty or invalid input", () => {
    const products = createProducts();

    expect(calcMealCalories([], products)).toBe(0);
    expect(
      calcMealCalories(
        [{ productId: "chicken", amount: 0, unit: "g" }],
        products,
      ),
    ).toBe(0);
    expect(calcMealCalories(createItems(), [])).toBe(0);
  });

  it("handles unit conversion from kg to g", () => {
    const products = createProducts();
    const items: MealItem[] = [
      { productId: "chicken", amount: 0.15, unit: "kg" },
    ];

    // 0.15 kg = 150g, 150g of chicken (165 kcal/100g) = 247.5 kcal
    expect(calcMealCalories(items, products)).toBeCloseTo(247.5);
  });

  it("handles unit conversion from mg to g", () => {
    const products = createProducts();
    const items: MealItem[] = [
      { productId: "chicken", amount: 150000, unit: "mg" },
    ];

    // 150000 mg = 150g, 150g of chicken (165 kcal/100g) = 247.5 kcal
    expect(calcMealCalories(items, products)).toBeCloseTo(247.5);
  });

  it("handles volume units (ml) for products with volume-based calories", () => {
    const volumeProduct: Product = {
      id: "milk",
      name: "Milk",
      caloriesPer100g: 60,
      scaleUnit: "ml",
      scaleType: "Liquid",
      portionSize: 100,
      caloriesPerBase: 60,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    const items: MealItem[] = [{ productId: "milk", amount: 200, unit: "ml" }];

    // 200ml of milk (60 kcal/100ml) = 120 kcal
    expect(calcMealCalories(items, [volumeProduct])).toBeCloseTo(120);
  });

  it("returns 0 when conversion between incompatible units fails", () => {
    const products = createProducts();
    const items: MealItem[] = [
      { productId: "chicken", amount: 100, unit: "ml" },
    ];

    // g-based product with ml unit should return 0
    expect(calcMealCalories(items, products)).toBe(0);
  });
});
