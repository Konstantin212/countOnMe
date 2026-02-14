import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as foodEntriesApi from "@services/api/foodEntries";
import * as portionsApi from "@services/api/portions";
import * as productsApi from "@services/api/products";
import { useFoodEntries, clearFoodEntryCaches } from "./useFoodEntries";
import {
  makeProduct,
  makeMealItem,
  makePortion,
  makeFoodEntry,
} from "../test/helpers";

vi.mock("@services/api/foodEntries");
vi.mock("@services/api/portions");
vi.mock("@services/api/products");

const mockListFoodEntries = vi.mocked(foodEntriesApi.listFoodEntries);
const mockCreateFoodEntry = vi.mocked(foodEntriesApi.createFoodEntry);
const mockDeleteFoodEntry = vi.mocked(foodEntriesApi.deleteFoodEntry);
const mockListPortions = vi.mocked(portionsApi.listPortions);
const mockCreatePortion = vi.mocked(portionsApi.createPortion);
const mockGetProduct = vi.mocked(productsApi.getProduct);
const mockCreateProduct = vi.mocked(productsApi.createProduct);

describe("useFoodEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFoodEntryCaches();
  });

  describe("saveMealToBackend", () => {
    it("creates food entries for all items", async () => {
      const product = makeProduct({ id: "p1" });
      const portion = makePortion({ id: "portion-1", product_id: "p1" });
      const items = [makeMealItem({ productId: "p1", amount: 200, unit: "g" })];

      mockGetProduct.mockResolvedValue(product as any);
      mockListPortions.mockResolvedValue([portion]);
      mockCreateFoodEntry.mockResolvedValue(makeFoodEntry());

      const { result } = renderHook(() => useFoodEntries());

      let entries: any[] = [];
      await act(async () => {
        entries = await result.current.saveMealToBackend(
          "breakfast",
          items,
          [product],
          "2025-06-01",
        );
      });

      expect(entries).toHaveLength(1);
      expect(mockCreateFoodEntry).toHaveBeenCalledWith({
        product_id: "p1",
        portion_id: "portion-1",
        day: "2025-06-01",
        meal_type: "breakfast",
        amount: 200,
        unit: "g",
      });
    });

    it("creates product in backend if not found", async () => {
      const product = makeProduct({ id: "p1" });
      const portion = makePortion({ id: "portion-1" });
      const items = [makeMealItem({ productId: "p1" })];

      mockGetProduct.mockRejectedValue(new Error("Not found"));
      mockCreateProduct.mockResolvedValue({
        id: "p1",
        name: "Chicken",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      mockListPortions.mockResolvedValue([portion]);
      mockCreateFoodEntry.mockResolvedValue(makeFoodEntry());

      const { result } = renderHook(() => useFoodEntries());

      await act(async () => {
        await result.current.saveMealToBackend("breakfast", items, [product]);
      });

      expect(mockCreateProduct).toHaveBeenCalledWith({
        id: "p1",
        name: product.name,
      });
    });

    it("creates default portion if none exist", async () => {
      const product = makeProduct({ id: "p1", caloriesPer100g: 165 });
      const portion = makePortion({ id: "new-portion" });
      const items = [makeMealItem({ productId: "p1" })];

      mockGetProduct.mockResolvedValue(product as any);
      mockListPortions.mockResolvedValue([]);
      mockCreatePortion.mockResolvedValue(portion);
      mockCreateFoodEntry.mockResolvedValue(makeFoodEntry());

      const { result } = renderHook(() => useFoodEntries());

      await act(async () => {
        await result.current.saveMealToBackend("breakfast", items, [product]);
      });

      expect(mockCreatePortion).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({
          label: "100g",
          base_amount: 100,
          base_unit: "g",
          calories: 165,
          is_default: true,
        }),
      );
    });

    it("skips items with missing product", async () => {
      const product = makeProduct({ id: "p1" });
      const items = [
        makeMealItem({ productId: "p1" }),
        makeMealItem({ productId: "missing" }),
      ];

      mockGetProduct.mockResolvedValue(product as any);
      mockListPortions.mockResolvedValue([makePortion()]);
      mockCreateFoodEntry.mockResolvedValue(makeFoodEntry());

      const { result } = renderHook(() => useFoodEntries());

      let entries: any[] = [];
      await act(async () => {
        entries = await result.current.saveMealToBackend("breakfast", items, [
          product,
        ]);
      });

      expect(entries).toHaveLength(1);
      expect(mockCreateFoodEntry).toHaveBeenCalledTimes(1);
    });

    it("returns empty array for empty items", async () => {
      const { result } = renderHook(() => useFoodEntries());

      let entries: any[] = [];
      await act(async () => {
        entries = await result.current.saveMealToBackend("breakfast", [], []);
      });

      expect(entries).toEqual([]);
      expect(mockCreateFoodEntry).not.toHaveBeenCalled();
    });

    it("prevents concurrent save operations", async () => {
      const product = makeProduct();
      const portion = makePortion();
      const items = [makeMealItem()];

      mockGetProduct.mockResolvedValue(product as any);
      mockListPortions.mockResolvedValue([portion]);
      mockCreateFoodEntry.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(makeFoodEntry()), 100),
          ),
      );

      const { result } = renderHook(() => useFoodEntries());

      // Start first save
      const firstSave = act(async () => {
        return result.current.saveMealToBackend("breakfast", items, [product]);
      });

      // Try to start second save immediately
      let secondEntries: any[] = [];
      await act(async () => {
        secondEntries = await result.current.saveMealToBackend(
          "breakfast",
          items,
          [product],
        );
      });

      // Second save should return empty due to concurrent protection
      expect(secondEntries).toEqual([]);

      await firstSave;
    });
  });

  describe("getEntriesForDay", () => {
    it("fetches entries for a specific day", async () => {
      const entries = [makeFoodEntry({ day: "2025-06-01" })];
      mockListFoodEntries.mockResolvedValue(entries);

      const { result } = renderHook(() => useFoodEntries());

      let fetchedEntries: any[] = [];
      await act(async () => {
        fetchedEntries = await result.current.getEntriesForDay("2025-06-01");
      });

      expect(fetchedEntries).toEqual(entries);
      expect(mockListFoodEntries).toHaveBeenCalledWith({ day: "2025-06-01" });
    });

    it("returns empty array on error", async () => {
      mockListFoodEntries.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useFoodEntries());

      let entries: any[] = [];
      await act(async () => {
        entries = await result.current.getEntriesForDay("2025-06-01");
      });

      expect(entries).toEqual([]);
    });
  });

  describe("deleteEntry", () => {
    it("deletes an entry by ID", async () => {
      mockDeleteFoodEntry.mockResolvedValue(undefined);

      const { result } = renderHook(() => useFoodEntries());

      await act(async () => {
        await result.current.deleteEntry("entry-1");
      });

      expect(mockDeleteFoodEntry).toHaveBeenCalledWith("entry-1");
    });
  });
});
