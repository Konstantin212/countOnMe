import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Meal, Product } from "@models/types";
import { loadMeals, saveMeals } from "@storage/storage";
import { useMeals, __testing } from "./useMeals";
import { makeProduct, makeMeal, makeMealItem } from "../test/helpers";

vi.mock("../storage/storage", () => ({
  loadMeals: vi.fn(),
  saveMeals: vi.fn(),
  loadProducts: vi.fn(() => Promise.resolve([])),
  saveProducts: vi.fn(() => Promise.resolve()),
}));

vi.mock("../storage/syncQueue", () => ({
  enqueue: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "uuid-mock"),
}));

vi.mock("@services/utils/calories", () => ({
  calcMealCalories: vi.fn((items) => items.length * 165), // Simple mock
}));

const mockLoadMeals = vi.mocked(loadMeals);
const mockSaveMeals = vi.mocked(saveMeals);

const { normalizeName, sanitizeItems, createMealRecord, patchMealRecord } =
  __testing;

const setupHook = async (
  initialMeals: Meal[] = [],
  products: Product[] = [makeProduct()],
) => {
  mockLoadMeals.mockResolvedValue(initialMeals);
  mockSaveMeals.mockResolvedValue();

  const hook = renderHook(() => useMeals(products));

  await waitFor(() => {
    expect(hook.result.current.loading).toBe(false);
  });

  return hook;
};

describe("useMeals - Pure Helpers", () => {
  describe("normalizeName", () => {
    it("trims whitespace", () => {
      expect(normalizeName("  Chicken Salad  ")).toBe("Chicken Salad");
    });

    it("returns default name for empty string", () => {
      expect(normalizeName("")).toBe("Untitled meal");
      expect(normalizeName("   ")).toBe("Untitled meal");
    });

    it("handles null/undefined with fallback", () => {
      expect(normalizeName(null as any)).toBe("Untitled meal");
      expect(normalizeName(undefined as any)).toBe("Untitled meal");
    });
  });

  describe("sanitizeItems", () => {
    it("keeps valid items", () => {
      const items = [makeMealItem({ productId: "p1", amount: 100, unit: "g" })];
      const result = sanitizeItems(items);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ productId: "p1", amount: 100, unit: "g" });
    });

    it("filters out items with missing productId", () => {
      const items = [
        makeMealItem({ productId: "", amount: 100 }),
        makeMealItem({ productId: "p1", amount: 100 }),
      ];
      const result = sanitizeItems(items);
      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe("p1");
    });

    it("filters out items with zero or negative amount", () => {
      const items = [
        makeMealItem({ amount: 0 }),
        makeMealItem({ amount: -10 }),
        makeMealItem({ amount: 100 }),
      ];
      const result = sanitizeItems(items);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(100);
    });

    it("filters out items with NaN amount", () => {
      const items = [
        { productId: "p1", amount: NaN, unit: "g" },
        makeMealItem({ amount: 100 }),
      ];
      const result = sanitizeItems(items as any);
      expect(result).toHaveLength(1);
    });

    it("returns empty array for non-array input", () => {
      expect(sanitizeItems(null as any)).toEqual([]);
      expect(sanitizeItems(undefined as any)).toEqual([]);
      expect(sanitizeItems({} as any)).toEqual([]);
    });
  });

  describe("createMealRecord", () => {
    it("creates a meal with sanitized inputs", () => {
      const products = [makeProduct({ id: "p1", caloriesPer100g: 165 })];
      const meal = createMealRecord(
        { name: "  Test  ", items: [makeMealItem({ productId: "p1" })] },
        products,
      );

      expect(meal.name).toBe("Test");
      expect(meal.items).toHaveLength(1);
      expect(meal.id).toBe("uuid-mock");
      expect(meal.createdAt).toBeDefined();
      expect(meal.updatedAt).toBeDefined();
    });

    it("includes mealType if provided", () => {
      const products = [makeProduct()];
      const meal = createMealRecord(
        {
          name: "Breakfast",
          mealType: "breakfast",
          items: [makeMealItem()],
        },
        products,
      );

      expect(meal.mealType).toBe("breakfast");
    });
  });

  describe("patchMealRecord", () => {
    it("updates name when provided", () => {
      const products = [makeProduct()];
      const meal = makeMeal({ name: "Old Name" });
      const patched = patchMealRecord(meal, { name: "  New Name  " }, products);

      expect(patched.name).toBe("New Name");
      expect(patched.updatedAt).not.toBe(meal.updatedAt);
    });

    it("updates items when provided", () => {
      const products = [makeProduct()];
      const meal = makeMeal({ items: [makeMealItem({ amount: 100 })] });
      const newItems = [makeMealItem({ amount: 200 })];
      const patched = patchMealRecord(meal, { items: newItems }, products);

      expect(patched.items).toHaveLength(1);
      expect(patched.items[0].amount).toBe(200);
    });

    it("keeps original values when patch is empty", () => {
      const products = [makeProduct()];
      const meal = makeMeal({ name: "Keep Me" });
      const patched = patchMealRecord(meal, {}, products);

      expect(patched.name).toBe("Keep Me");
      expect(patched.items).toEqual(meal.items);
    });
  });
});

describe("useMeals - Hook Behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads meals on mount", async () => {
    const meals = [makeMeal()];
    const { result } = await setupHook(meals);

    expect(result.current.meals).toEqual(meals);
    expect(mockLoadMeals).toHaveBeenCalledTimes(1);
  });

  it("adds a meal and persists", async () => {
    const products = [makeProduct()];
    const { result } = await setupHook([], products);

    await act(async () => {
      await result.current.addMeal({
        name: "New Meal",
        items: [makeMealItem()],
      });
    });

    expect(result.current.meals).toHaveLength(1);
    expect(result.current.meals[0].name).toBe("New Meal");
    expect(mockSaveMeals).toHaveBeenCalledTimes(1);
  });

  it("updates an existing meal", async () => {
    const meal = makeMeal({ id: "m1", name: "Old" });
    const products = [makeProduct()];
    const { result } = await setupHook([meal], products);

    await act(async () => {
      await result.current.updateMeal("m1", { name: "Updated" });
    });

    expect(result.current.meals[0].name).toBe("Updated");
    expect(mockSaveMeals).toHaveBeenCalledTimes(1);
  });

  it("returns null when updating non-existent meal", async () => {
    const { result } = await setupHook();

    let updatedMeal;
    await act(async () => {
      updatedMeal = await result.current.updateMeal("missing", {
        name: "Ghost",
      });
    });

    expect(updatedMeal).toBeNull();
    expect(mockSaveMeals).not.toHaveBeenCalled();
  });

  it("deletes a meal by id", async () => {
    const meal = makeMeal({ id: "m1" });
    const { result } = await setupHook([meal]);

    await act(async () => {
      const removed = await result.current.deleteMeal("m1");
      expect(removed).toBe(true);
    });

    expect(result.current.meals).toHaveLength(0);
    expect(mockSaveMeals).toHaveBeenCalledTimes(1);
  });

  it("returns false when deleting non-existent meal", async () => {
    const { result } = await setupHook();

    let removed;
    await act(async () => {
      removed = await result.current.deleteMeal("missing");
    });

    expect(removed).toBe(false);
    expect(mockSaveMeals).not.toHaveBeenCalled();
  });

  it("refreshes meals from storage", async () => {
    const { result } = await setupHook([]);

    mockLoadMeals.mockResolvedValue([makeMeal()]);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.meals).toHaveLength(1);
    expect(mockLoadMeals).toHaveBeenCalledTimes(2); // Once on mount, once on refresh
  });
});
