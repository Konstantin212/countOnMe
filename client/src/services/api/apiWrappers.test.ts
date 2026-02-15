import { beforeEach, describe, expect, it, vi } from "vitest";

import * as foodEntriesApi from "./foodEntries";
import * as portionsApi from "./portions";
import * as productsApi from "./products";
import * as statsApi from "./stats";

vi.mock("./http", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("./http");

describe("API wrappers (thin)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("foodEntries", () => {
    it("listFoodEntries calls apiFetch with query params", async () => {
      const mockApiResponse = [
        {
          id: "entry-1",
          product_id: "p1",
          portion_id: "por1",
          day: "2025-01-01",
          meal_type: "lunch",
          amount: "100",
          unit: "g",
          created_at: "",
          updated_at: "",
        },
      ];
      vi.mocked(apiFetch).mockResolvedValue(mockApiResponse);

      const result = await foodEntriesApi.listFoodEntries({
        day: "2025-01-01",
        from: "2025-01-01",
        to: "2025-01-07",
      });

      expect(apiFetch).toHaveBeenCalledWith("/v1/food-entries", {
        query: { day: "2025-01-01", from: "2025-01-01", to: "2025-01-07" },
      });
      expect(result).toEqual([
        {
          id: "entry-1",
          productId: "p1",
          portionId: "por1",
          day: "2025-01-01",
          mealType: "lunch",
          amount: 100,
          unit: "g",
          createdAt: "",
          updatedAt: "",
        },
      ]);
    });

    it("createFoodEntry calls apiFetch with POST", async () => {
      const mockApiResponse = {
        id: "entry-1",
        product_id: "p1",
        portion_id: "por1",
        day: "2025-01-01",
        meal_type: "lunch" as const,
        amount: "100",
        unit: "g" as const,
        created_at: "",
        updated_at: "",
      };
      vi.mocked(apiFetch).mockResolvedValue(mockApiResponse);

      const body = {
        product_id: "p1",
        portion_id: "por1",
        day: "2025-01-01",
        meal_type: "lunch" as const,
        amount: 100,
        unit: "g" as const,
      };
      const result = await foodEntriesApi.createFoodEntry(body);

      expect(apiFetch).toHaveBeenCalledWith("/v1/food-entries", {
        method: "POST",
        body,
      });
      expect(result).toEqual({
        id: "entry-1",
        productId: "p1",
        portionId: "por1",
        day: "2025-01-01",
        mealType: "lunch",
        amount: 100,
        unit: "g",
        createdAt: "",
        updatedAt: "",
      });
    });

    it("getFoodEntry calls apiFetch with entry ID", async () => {
      const mockApiResponse = {
        id: "entry-1",
        product_id: "p1",
        portion_id: "por1",
        day: "2025-01-01",
        meal_type: "lunch" as const,
        amount: "100",
        unit: "g" as const,
        created_at: "",
        updated_at: "",
      };
      vi.mocked(apiFetch).mockResolvedValue(mockApiResponse);

      const result = await foodEntriesApi.getFoodEntry("entry-1");

      expect(apiFetch).toHaveBeenCalledWith("/v1/food-entries/entry-1");
      expect(result).toEqual({
        id: "entry-1",
        productId: "p1",
        portionId: "por1",
        day: "2025-01-01",
        mealType: "lunch",
        amount: 100,
        unit: "g",
        createdAt: "",
        updatedAt: "",
      });
    });

    it("updateFoodEntry calls apiFetch with PATCH", async () => {
      const mockApiResponse = {
        id: "entry-1",
        product_id: "p1",
        portion_id: "por1",
        day: "2025-01-01",
        meal_type: "dinner" as const,
        amount: "150",
        unit: "g" as const,
        created_at: "",
        updated_at: "",
      };
      vi.mocked(apiFetch).mockResolvedValue(mockApiResponse);

      const patch = { meal_type: "dinner" as const, amount: 150 };
      const result = await foodEntriesApi.updateFoodEntry("entry-1", patch);

      expect(apiFetch).toHaveBeenCalledWith("/v1/food-entries/entry-1", {
        method: "PATCH",
        body: patch,
      });
      expect(result).toEqual({
        id: "entry-1",
        productId: "p1",
        portionId: "por1",
        day: "2025-01-01",
        mealType: "dinner",
        amount: 150,
        unit: "g",
        createdAt: "",
        updatedAt: "",
      });
    });

    it("deleteFoodEntry calls apiFetch with DELETE", async () => {
      vi.mocked(apiFetch).mockResolvedValue(undefined);

      await foodEntriesApi.deleteFoodEntry("entry-1");

      expect(apiFetch).toHaveBeenCalledWith("/v1/food-entries/entry-1", {
        method: "DELETE",
      });
    });
  });

  describe("portions", () => {
    it("listPortions calls apiFetch with product ID", async () => {
      const mockApiResponse = [
        {
          id: "por1",
          product_id: "p1",
          label: "100g",
          base_amount: "100",
          base_unit: "g" as const,
          calories: "200",
          protein: "20",
          carbs: "10",
          fat: "5",
          is_default: true,
          created_at: "",
          updated_at: "",
        },
      ];
      vi.mocked(apiFetch).mockResolvedValue(mockApiResponse);

      const result = await portionsApi.listPortions("p1");

      expect(apiFetch).toHaveBeenCalledWith("/v1/products/p1/portions");
      expect(result).toEqual([
        {
          id: "por1",
          productId: "p1",
          label: "100g",
          baseAmount: 100,
          baseUnit: "g",
          calories: 200,
          protein: 20,
          carbs: 10,
          fat: 5,
          isDefault: true,
          createdAt: "",
          updatedAt: "",
        },
      ]);
    });

    it("createPortion calls apiFetch with POST", async () => {
      const mockApiResponse = {
        id: "por1",
        product_id: "p1",
        label: "100g",
        base_amount: "100",
        base_unit: "g" as const,
        calories: "200",
        protein: "20",
        carbs: "10",
        fat: "5",
        is_default: true,
        created_at: "",
        updated_at: "",
      };
      vi.mocked(apiFetch).mockResolvedValue(mockApiResponse);

      const body = {
        label: "100g",
        base_amount: 100,
        base_unit: "g" as const,
        calories: 200,
        protein: 20,
        carbs: 10,
        fat: 5,
        is_default: true,
      };
      const result = await portionsApi.createPortion("p1", body);

      expect(apiFetch).toHaveBeenCalledWith("/v1/products/p1/portions", {
        method: "POST",
        body,
      });
      expect(result).toEqual({
        id: "por1",
        productId: "p1",
        label: "100g",
        baseAmount: 100,
        baseUnit: "g",
        calories: 200,
        protein: 20,
        carbs: 10,
        fat: 5,
        isDefault: true,
        createdAt: "",
        updatedAt: "",
      });
    });

    it("getPortion calls apiFetch with portion ID", async () => {
      const mockApiResponse = {
        id: "por1",
        product_id: "p1",
        label: "100g",
        base_amount: "100",
        base_unit: "g" as const,
        calories: "200",
        protein: null,
        carbs: null,
        fat: null,
        is_default: true,
        created_at: "",
        updated_at: "",
      };
      vi.mocked(apiFetch).mockResolvedValue(mockApiResponse);

      const result = await portionsApi.getPortion("por1");

      expect(apiFetch).toHaveBeenCalledWith("/v1/portions/por1");
      // Result is transformed to frontend Portion type
      expect(result).toEqual({
        id: "por1",
        productId: "p1",
        label: "100g",
        baseAmount: 100,
        baseUnit: "g",
        calories: 200,
        protein: null,
        carbs: null,
        fat: null,
        isDefault: true,
        createdAt: "",
        updatedAt: "",
      });
    });

    it("updatePortion calls apiFetch with PATCH", async () => {
      const mockApiResponse = {
        id: "por1",
        product_id: "p1",
        label: "150g",
        base_amount: "150",
        base_unit: "g" as const,
        calories: "300",
        protein: null,
        carbs: null,
        fat: null,
        is_default: true,
        created_at: "",
        updated_at: "",
      };
      vi.mocked(apiFetch).mockResolvedValue(mockApiResponse);

      const patch = { label: "150g", base_amount: 150, calories: 300 };
      const result = await portionsApi.updatePortion("por1", patch);

      expect(apiFetch).toHaveBeenCalledWith("/v1/portions/por1", {
        method: "PATCH",
        body: patch,
      });
      // Result is transformed to frontend Portion type
      expect(result).toEqual({
        id: "por1",
        productId: "p1",
        label: "150g",
        baseAmount: 150,
        baseUnit: "g",
        calories: 300,
        protein: null,
        carbs: null,
        fat: null,
        isDefault: true,
        createdAt: "",
        updatedAt: "",
      });
    });

    it("deletePortion calls apiFetch with DELETE", async () => {
      vi.mocked(apiFetch).mockResolvedValue(undefined);

      await portionsApi.deletePortion("por1");

      expect(apiFetch).toHaveBeenCalledWith("/v1/portions/por1", {
        method: "DELETE",
      });
    });
  });

  describe("products", () => {
    it("listProducts calls apiFetch", async () => {
      const mockResponse = [
        { id: "p1", name: "Chicken", created_at: "", updated_at: "" },
      ];
      vi.mocked(apiFetch).mockResolvedValue(mockResponse);

      const result = await productsApi.listProducts();

      expect(apiFetch).toHaveBeenCalledWith("/v1/products");
      expect(result).toEqual(mockResponse);
    });

    it("createProduct calls apiFetch with POST", async () => {
      const mockResponse = {
        id: "p1",
        name: "Chicken",
        created_at: "",
        updated_at: "",
      };
      vi.mocked(apiFetch).mockResolvedValue(mockResponse);

      const body = { id: "p1", name: "Chicken" };
      const result = await productsApi.createProduct(body);

      expect(apiFetch).toHaveBeenCalledWith("/v1/products", {
        method: "POST",
        body,
      });
      expect(result).toEqual(mockResponse);
    });

    it("getProduct calls apiFetch with product ID", async () => {
      const mockResponse = {
        id: "p1",
        name: "Chicken",
        created_at: "",
        updated_at: "",
      };
      vi.mocked(apiFetch).mockResolvedValue(mockResponse);

      const result = await productsApi.getProduct("p1");

      expect(apiFetch).toHaveBeenCalledWith("/v1/products/p1");
      expect(result).toEqual(mockResponse);
    });

    it("updateProduct calls apiFetch with PATCH", async () => {
      const mockResponse = {
        id: "p1",
        name: "Chicken Breast",
        created_at: "",
        updated_at: "",
      };
      vi.mocked(apiFetch).mockResolvedValue(mockResponse);

      const patch = { name: "Chicken Breast" };
      const result = await productsApi.updateProduct("p1", patch);

      expect(apiFetch).toHaveBeenCalledWith("/v1/products/p1", {
        method: "PATCH",
        body: patch,
      });
      expect(result).toEqual(mockResponse);
    });

    it("deleteProduct calls apiFetch with DELETE", async () => {
      vi.mocked(apiFetch).mockResolvedValue(undefined);

      await productsApi.deleteProduct("p1");

      expect(apiFetch).toHaveBeenCalledWith("/v1/products/p1", {
        method: "DELETE",
      });
    });
  });

  describe("stats", () => {
    it("getDayStats calls apiFetch with day", async () => {
      const mockResponse = {
        day: "2025-01-01",
        totals: { calories: "500", protein: "30", carbs: "50", fat: "20" },
        by_meal_type: {},
      };
      vi.mocked(apiFetch).mockResolvedValue(mockResponse);

      const result = await statsApi.getDayStats("2025-01-01");

      expect(apiFetch).toHaveBeenCalledWith("/v1/stats/day/2025-01-01");
      expect(result).toEqual(mockResponse);
    });

    it("getDailyStats calls apiFetch with query params", async () => {
      const mockResponse = {
        from_day: "2025-01-01",
        to_day: "2025-01-07",
        points: [],
      };
      vi.mocked(apiFetch).mockResolvedValue(mockResponse);

      const result = await statsApi.getDailyStats("2025-01-01", "2025-01-07");

      expect(apiFetch).toHaveBeenCalledWith("/v1/stats/daily", {
        query: { from: "2025-01-01", to: "2025-01-07" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("getWeightStats calls apiFetch with query params", async () => {
      const mockResponse = {
        from_day: "2025-01-01",
        to_day: "2025-01-07",
        points: [],
      };
      vi.mocked(apiFetch).mockResolvedValue(mockResponse);

      const result = await statsApi.getWeightStats("2025-01-01", "2025-01-07");

      expect(apiFetch).toHaveBeenCalledWith("/v1/stats/weight", {
        query: { from: "2025-01-01", to: "2025-01-07" },
      });
      expect(result).toEqual(mockResponse);
    });
  });
});
