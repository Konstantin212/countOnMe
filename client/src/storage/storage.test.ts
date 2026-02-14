import { beforeEach, describe, expect, it, vi } from "vitest";

import { Meal, Product } from "@models/types";
import { loadMeals, loadProducts, saveMeals, saveProducts } from "./storage";

const storageStore = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => {
  return {
    default: {
      getItem: vi.fn(async (key: string) => storageStore.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        storageStore.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        storageStore.delete(key);
      }),
      clear: vi.fn(async () => {
        storageStore.clear();
      }),
    },
  };
});

describe("storage repositories", () => {
  beforeEach(() => {
    storageStore.clear();
  });

  const sampleProducts: Product[] = [
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

  const sampleMeals: Meal[] = [
    {
      id: "meal-1",
      name: "Lunch",
      items: [
        { productId: "chicken", amount: 150, unit: "g" },
        { productId: "rice", amount: 200, unit: "g" },
      ],
      totalCalories: 507.5,
      createdAt: "2025-01-01T12:00:00.000Z",
      updatedAt: "2025-01-01T12:00:00.000Z",
    },
  ];

  it("returns empty arrays when nothing is stored", async () => {
    await expect(loadProducts()).resolves.toEqual([]);
    await expect(loadMeals()).resolves.toEqual([]);
  });

  it("saves and loads products via AsyncStorage", async () => {
    await saveProducts(sampleProducts);
    await expect(loadProducts()).resolves.toEqual(sampleProducts);
  });

  it("saves and loads meals via AsyncStorage", async () => {
    await saveMeals(sampleMeals);
    await expect(loadMeals()).resolves.toEqual(sampleMeals);
  });

  describe("theme preference", () => {
    it("returns null when no theme preference is stored", async () => {
      const { loadThemePreference } = await import("./storage");
      expect(await loadThemePreference()).toBeNull();
    });

    it("saves and loads theme preference", async () => {
      const { saveThemePreference, loadThemePreference } =
        await import("./storage");
      await saveThemePreference("dark");
      expect(await loadThemePreference()).toBe("dark");
    });

    it("validates theme mode values", async () => {
      const { loadThemePreference } = await import("./storage");
      storageStore.set("@countOnMe/theme/v1", "invalid");
      expect(await loadThemePreference()).toBeNull();
    });
  });

  describe("product favourites and recents", () => {
    it("loads empty arrays when nothing stored", async () => {
      const { loadProductFavourites, loadProductRecents } =
        await import("./storage");
      expect(await loadProductFavourites()).toEqual([]);
      expect(await loadProductRecents()).toEqual([]);
    });

    it("saves and loads product favourites", async () => {
      const { saveProductFavourites, loadProductFavourites } =
        await import("./storage");
      await saveProductFavourites(["p1", "p2", "p3"]);
      expect(await loadProductFavourites()).toEqual(["p1", "p2", "p3"]);
    });

    it("saves and loads product recents", async () => {
      const { saveProductRecents, loadProductRecents } =
        await import("./storage");
      await saveProductRecents(["p3", "p1"]);
      expect(await loadProductRecents()).toEqual(["p3", "p1"]);
    });
  });

  describe("goal storage", () => {
    it("returns null when no goal is stored", async () => {
      const { loadGoal } = await import("./storage");
      expect(await loadGoal()).toBeNull();
    });

    it("saves and loads goal", async () => {
      const { saveGoal, loadGoal } = await import("./storage");
      const goal = {
        id: "goal-1",
        goalType: "manual" as const,
        dailyCaloriesKcal: 2000,
        proteinPercent: 30,
        carbsPercent: 40,
        fatPercent: 30,
        proteinGrams: 150,
        carbsGrams: 200,
        fatGrams: 67,
        waterMl: 2500,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };
      await saveGoal(goal);
      expect(await loadGoal()).toEqual(goal);
    });

    it("clears goal from storage", async () => {
      const { saveGoal, clearGoal, loadGoal } = await import("./storage");
      const goal = {
        id: "goal-1",
        goalType: "manual" as const,
        dailyCaloriesKcal: 2000,
        proteinPercent: 30,
        carbsPercent: 40,
        fatPercent: 30,
        proteinGrams: 150,
        carbsGrams: 200,
        fatGrams: 67,
        waterMl: 2500,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };
      await saveGoal(goal);
      await clearGoal();
      expect(await loadGoal()).toBeNull();
    });
  });

  describe("migration V1 to V2", () => {
    it("migrates products V1 to V2 format", async () => {
      const productsV1 = [
        {
          id: "chicken",
          name: "Chicken breast",
          caloriesPer100g: 165,
          proteinPer100g: 31,
          carbsPer100g: 0,
          fatPer100g: 3.6,
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ];
      storageStore.set("@countOnMe/products/v1", JSON.stringify(productsV1));

      const products = await loadProducts();

      expect(products).toHaveLength(1);
      expect(products[0]).toMatchObject({
        id: "chicken",
        name: "Chicken breast",
        caloriesPer100g: 165,
        scaleType: "Solid",
        scaleUnit: "g",
        portionSize: 100,
        caloriesPerBase: 165,
        proteinPerBase: 31,
        carbsPerBase: 0,
        fatPerBase: 3.6,
      });
    });

    it("migrates meals V1 to V2 format", async () => {
      const mealsV1 = [
        {
          id: "meal-1",
          name: "Lunch",
          items: [
            { productId: "chicken", grams: 150 },
            { productId: "rice", grams: 200 },
          ],
          totalCalories: 507.5,
          createdAt: "2025-01-01T12:00:00.000Z",
          updatedAt: "2025-01-01T12:00:00.000Z",
        },
      ];
      storageStore.set("@countOnMe/meals/v1", JSON.stringify(mealsV1));

      const meals = await loadMeals();

      expect(meals).toHaveLength(1);
      expect(meals[0].items).toEqual([
        { productId: "chicken", amount: 150, unit: "g" },
        { productId: "rice", amount: 200, unit: "g" },
      ]);
    });
  });

  describe("error handling", () => {
    it("returns empty array when JSON parse fails for products", async () => {
      storageStore.set("@countOnMe/products/v2", "invalid json");
      expect(await loadProducts()).toEqual([]);
    });

    it("returns empty array when JSON parse fails for meals", async () => {
      storageStore.set("@countOnMe/meals/v2", "invalid json");
      expect(await loadMeals()).toEqual([]);
    });

    it("returns null when JSON parse fails for goal", async () => {
      const { loadGoal } = await import("./storage");
      storageStore.set("@countOnMe/goal/v1", "invalid json");
      expect(await loadGoal()).toBeNull();
    });
  });
});
