import { beforeEach, describe, expect, it, vi } from "vitest";

import { Meal, Product, WaterLog } from "@models/types";
import {
  loadMeals,
  loadProducts,
  loadWaterLogs,
  saveMeals,
  saveProducts,
  saveWaterLogs,
} from "./storage";

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
      multiRemove: vi.fn(async (keys: string[]) => {
        keys.forEach((key) => storageStore.delete(key));
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
    const loaded = await loadProducts();
    // loadProducts patches missing source to "user"
    const expected = sampleProducts.map((p) => ({
      ...p,
      source: p.source ?? "user",
    }));
    expect(loaded).toEqual(expected);
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

    describe("pushProductRecent", () => {
      it("prepends id to the front of the list", async () => {
        const { pushProductRecent, saveProductRecents, loadProductRecents } =
          await import("./storage");
        await saveProductRecents(["p1", "p2"]);
        await pushProductRecent("p3");
        expect(await loadProductRecents()).toEqual(["p3", "p1", "p2"]);
      });

      it("moves an existing id to the front (deduplicates)", async () => {
        const { pushProductRecent, saveProductRecents, loadProductRecents } =
          await import("./storage");
        await saveProductRecents(["p1", "p2", "p3"]);
        await pushProductRecent("p2");
        expect(await loadProductRecents()).toEqual(["p2", "p1", "p3"]);
      });

      it("caps the list at 50 items", async () => {
        const { pushProductRecent, saveProductRecents, loadProductRecents } =
          await import("./storage");
        const existing = Array.from({ length: 50 }, (_, i) => `p${i}`);
        await saveProductRecents(existing);
        await pushProductRecent("new");
        const result = await loadProductRecents();
        expect(result).toHaveLength(50);
        expect(result[0]).toBe("new");
      });
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

  describe("draft meal storage", () => {
    it("returns null when no draft meal is stored", async () => {
      const { loadDraftMeal } = await import("./storage");
      expect(await loadDraftMeal()).toBeNull();
    });

    it("saves and loads a draft meal", async () => {
      const { saveDraftMeal, loadDraftMeal } = await import("./storage");
      const draft = {
        mealType: "lunch" as const,
        itemsByMealType: {
          breakfast: [],
          lunch: [{ productId: "chicken", amount: 150, unit: "g" as const }],
          dinner: [],
          snacks: [],
          water: [],
        },
      };
      await saveDraftMeal(draft);
      expect(await loadDraftMeal()).toEqual(draft);
    });

    it("clears draft meal from storage", async () => {
      const { saveDraftMeal, clearDraftMeal, loadDraftMeal } =
        await import("./storage");
      const draft = {
        mealType: "breakfast" as const,
        itemsByMealType: {
          breakfast: [{ productId: "rice", amount: 200, unit: "g" as const }],
          lunch: [],
          dinner: [],
          snacks: [],
          water: [],
        },
      };
      await saveDraftMeal(draft);
      await clearDraftMeal();
      expect(await loadDraftMeal()).toBeNull();
    });

    it("returns null when JSON parse fails for draft meal", async () => {
      const { loadDraftMeal } = await import("./storage");
      storageStore.set("@countOnMe/draft-meal/v1", "invalid json");
      expect(await loadDraftMeal()).toBeNull();
    });
  });

  describe("water logs storage", () => {
    it("returns empty array when nothing stored", async () => {
      expect(await loadWaterLogs()).toEqual([]);
    });

    it("saves and loads water logs", async () => {
      const logs: WaterLog[] = [
        {
          id: "w1",
          day: "2025-06-01",
          amountMl: 250,
          createdAt: "2025-06-01T08:00:00.000Z",
        },
        {
          id: "w2",
          day: "2025-06-01",
          amountMl: 500,
          createdAt: "2025-06-01T12:00:00.000Z",
        },
      ];
      await saveWaterLogs(logs);
      expect(await loadWaterLogs()).toEqual(logs);
    });

    it("returns empty array when JSON parse fails", async () => {
      storageStore.set("@countOnMe/water-logs/v1", "invalid json");
      expect(await loadWaterLogs()).toEqual([]);
    });
  });

  describe("clearAllFoodData", () => {
    it("removes all food-related keys from storage", async () => {
      const { clearAllFoodData } = await import("./storage");

      // Arrange: seed several food-related keys
      storageStore.set("@countOnMe/products/v1", "[]");
      storageStore.set("@countOnMe/products/v2", "[]");
      storageStore.set("@countOnMe/meals/v1", "[]");
      storageStore.set("@countOnMe/meals/v2", "[]");
      storageStore.set("@countOnMe/products-favourites/v1", "[]");
      storageStore.set("@countOnMe/products-recents/v1", "[]");
      storageStore.set("@countOnMe/goal/v1", "{}");
      storageStore.set("@countOnMe/body-weights/v1", "[]");
      storageStore.set("@countOnMe/draft-meal/v1", "{}");
      storageStore.set("@countOnMe/water-logs/v1", "[]");
      // Theme should NOT be deleted
      storageStore.set("@countOnMe/theme/v1", "dark");

      // Act
      await clearAllFoodData();

      // Assert: all food keys removed
      expect(storageStore.has("@countOnMe/products/v1")).toBe(false);
      expect(storageStore.has("@countOnMe/products/v2")).toBe(false);
      expect(storageStore.has("@countOnMe/meals/v1")).toBe(false);
      expect(storageStore.has("@countOnMe/meals/v2")).toBe(false);
      expect(storageStore.has("@countOnMe/products-favourites/v1")).toBe(false);
      expect(storageStore.has("@countOnMe/products-recents/v1")).toBe(false);
      expect(storageStore.has("@countOnMe/goal/v1")).toBe(false);
      expect(storageStore.has("@countOnMe/body-weights/v1")).toBe(false);
      expect(storageStore.has("@countOnMe/draft-meal/v1")).toBe(false);
      expect(storageStore.has("@countOnMe/water-logs/v1")).toBe(false);
      // Theme should remain
      expect(storageStore.get("@countOnMe/theme/v1")).toBe("dark");
    });
  });

  describe("patchProductSource", () => {
    it("stamps source: 'user' on legacy products missing source field", async () => {
      // Arrange: products without source field stored in v2
      const legacyProducts = [
        {
          id: "old-prod",
          name: "Old Product",
          caloriesPer100g: 100,
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ];
      storageStore.set(
        "@countOnMe/products/v2",
        JSON.stringify(legacyProducts),
      );

      // Act
      const loaded = await loadProducts();

      // Assert: source patched to "user"
      expect(loaded).toHaveLength(1);
      expect(loaded[0].source).toBe("user");

      // Assert: patched products persisted back to storage
      const stored = JSON.parse(
        storageStore.get("@countOnMe/products/v2") ?? "[]",
      );
      expect(stored[0].source).toBe("user");
    });

    it("does not re-save products when all already have source", async () => {
      // Arrange: products with source already set
      const products = [
        {
          id: "new-prod",
          name: "New Product",
          caloriesPer100g: 200,
          source: "catalog",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ];
      storageStore.set("@countOnMe/products/v2", JSON.stringify(products));

      // Act
      const loaded = await loadProducts();

      // Assert: source preserved as "catalog"
      expect(loaded[0].source).toBe("catalog");
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
