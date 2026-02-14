import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  extractCalories,
  extractMacros,
  getProductByBarcode,
  searchProducts,
  type OpenFoodFactsProduct,
} from "./openFoodFacts";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("openFoodFacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchProducts", () => {
    it("returns empty result for blank query", async () => {
      const result = await searchProducts("");
      expect(result).toEqual({
        count: 0,
        page: 1,
        page_count: 0,
        page_size: 0,
        products: [],
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("fetches products successfully", async () => {
      const mockResponse = {
        count: 1,
        page: 1,
        page_count: 1,
        page_size: 20,
        products: [
          {
            code: "123",
            product_name: "Chicken",
            brands: "Brand",
            nutriments: { "energy-kcal_100g": 165 },
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchProducts("chicken");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("search.pl?search_terms=chicken"),
      );
      expect(result).toEqual(mockResponse);
    });

    it("throws error when API request fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(searchProducts("chicken")).rejects.toThrow(
        "Failed to search products. Please check your internet connection.",
      );
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(searchProducts("chicken")).rejects.toThrow(
        "Failed to search products. Please check your internet connection.",
      );
    });
  });

  describe("getProductByBarcode", () => {
    it("returns product when found", async () => {
      const mockProduct = {
        code: "123",
        product_name: "Chicken",
        nutriments: { "energy-kcal_100g": 165 },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 1, product: mockProduct }),
      });

      const result = await getProductByBarcode("123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v2/product/123.json"),
      );
      expect(result).toEqual(mockProduct);
    });

    it("returns null when product not found", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 0 }),
      });

      const result = await getProductByBarcode("999");

      expect(result).toBeNull();
    });

    it("returns null when request fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await getProductByBarcode("999");

      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await getProductByBarcode("123");

      expect(result).toBeNull();
    });
  });

  describe("extractCalories", () => {
    it("extracts calories from product", () => {
      const product: OpenFoodFactsProduct = {
        code: "123",
        product_name: "Chicken",
        nutriments: { "energy-kcal_100g": 165 },
      };

      expect(extractCalories(product)).toBe(165);
    });

    it("returns 0 when calories are missing", () => {
      const product: OpenFoodFactsProduct = {
        code: "123",
        product_name: "Chicken",
        nutriments: {},
      };

      expect(extractCalories(product)).toBe(0);
    });
  });

  describe("extractMacros", () => {
    it("extracts macros from product", () => {
      const product: OpenFoodFactsProduct = {
        code: "123",
        product_name: "Chicken",
        nutriments: {
          proteins_100g: 31,
          carbohydrates_100g: 0,
          fat_100g: 3.6,
        },
      };

      const macros = extractMacros(product);

      expect(macros.protein).toBe(31);
      expect(macros.carbs).toBe(0);
      expect(macros.fat).toBe(3.6);
    });

    it("returns undefined for missing macros", () => {
      const product: OpenFoodFactsProduct = {
        code: "123",
        product_name: "Chicken",
        nutriments: {},
      };

      const macros = extractMacros(product);

      expect(macros.protein).toBeUndefined();
      expect(macros.carbs).toBeUndefined();
      expect(macros.fat).toBeUndefined();
    });
  });
});
