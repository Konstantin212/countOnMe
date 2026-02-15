import { act, renderHook, waitFor } from "@testing-library/react";
import { vi, type Mock } from "vitest";

import type { Product } from "@models/types";
import {
  deleteFoodEntry,
  FoodEntry,
  listFoodEntries,
  updateFoodEntry,
} from "@services/api/foodEntries";
import { listPortions, Portion } from "@services/api/portions";

import {
  clearMealTypeEntriesCache,
  useMealTypeEntries,
} from "./useMealTypeEntries";

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock("../storage/storage", () => ({
  loadProducts: vi.fn().mockResolvedValue([]),
  saveProducts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../storage/syncQueue", () => ({
  enqueue: vi.fn(),
}));

vi.mock("@services/api/foodEntries", () => ({
  listFoodEntries: vi.fn(),
  updateFoodEntry: vi.fn(),
  deleteFoodEntry: vi.fn(),
}));

vi.mock("@services/api/portions", () => ({
  listPortions: vi.fn(),
}));

// Mock useProducts to control products array
const mockProducts: Product[] = [];
vi.mock("./useProducts", () => ({
  useProducts: () => ({
    products: mockProducts,
    loading: false,
    refresh: vi.fn(),
  }),
}));

const mockListFoodEntries = listFoodEntries as Mock;
const mockUpdateFoodEntry = updateFoodEntry as Mock;
const mockDeleteFoodEntry = deleteFoodEntry as Mock;
const mockListPortions = listPortions as Mock;

// ── Helpers ────────────────────────────────────────────────────────

const makeFoodEntry = (
  overrides: Partial<FoodEntry> = {},
): FoodEntry => ({
  id: "entry-1",
  productId: "prod-1",
  portionId: "portion-1",
  day: "2025-06-01",
  mealType: "breakfast",
  amount: 200,
  unit: "g",
  createdAt: "2025-06-01T08:00:00Z",
  updatedAt: "2025-06-01T08:00:00Z",
  ...overrides,
});

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: "prod-1",
  name: "Chicken",
  caloriesPer100g: 165,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  ...overrides,
});

const makePortion = (
  overrides: Partial<Portion> = {},
): Portion => ({
  id: "portion-1",
  productId: "prod-1",
  label: "100g",
  baseAmount: 100,
  baseUnit: "g",
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  isDefault: true,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  ...overrides,
});

const setupHook = async (
  entries: FoodEntry[] = [],
  products: Product[] = [],
  portions: Portion[] = [],
) => {
  // Set mock data
  mockProducts.length = 0;
  mockProducts.push(...products);

  mockListFoodEntries.mockResolvedValue(entries);
  mockListPortions.mockResolvedValue(portions);
  mockUpdateFoodEntry.mockResolvedValue(undefined);
  mockDeleteFoodEntry.mockResolvedValue(undefined);

  const hook = renderHook(() => useMealTypeEntries("breakfast", "2025-06-01"));

  await waitFor(() => {
    expect(hook.result.current.loading).toBe(false);
  });

  return hook;
};

// ── Tests ──────────────────────────────────────────────────────────

describe("useMealTypeEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMealTypeEntriesCache();
    mockProducts.length = 0;
  });

  describe("refresh / initial load", () => {
    it("fetches entries from backend on mount", async () => {
      await setupHook();
      expect(mockListFoodEntries).toHaveBeenCalledWith({ day: "2025-06-01" });
    });

    it("filters entries by meal type", async () => {
      const entries = [
        makeFoodEntry({ id: "e1", mealType: "breakfast" }),
        makeFoodEntry({ id: "e2", mealType: "lunch" }),
      ];
      const product = makeProduct();
      const portion = makePortion();

      const { result } = await setupHook(entries, [product], [portion]);

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0].id).toBe("e1");
    });

    it("returns empty entries when no products match", async () => {
      const entries = [makeFoodEntry({ productId: "unknown" })];
      const { result } = await setupHook(entries, [], []);

      expect(result.current.entries).toHaveLength(0);
    });

    it("sets error state when API fails", async () => {
      mockListFoodEntries.mockRejectedValue(new Error("Network error"));
      mockProducts.length = 0;

      const hook = renderHook(() =>
        useMealTypeEntries("breakfast", "2025-06-01"),
      );

      await waitFor(() => {
        expect(hook.result.current.loading).toBe(false);
      });

      expect(hook.result.current.error).toBe("Failed to load entries");
      expect(hook.result.current.entries).toEqual([]);
    });

    it("enriches entries with portion-based nutrition", async () => {
      const entry = makeFoodEntry({ amount: 200 });
      const product = makeProduct();
      const portion = makePortion({
        baseAmount: 100,
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
      });

      const { result } = await setupHook([entry], [product], [portion]);

      // 200g / 100g base = ratio of 2
      expect(result.current.entries[0].calories).toBe(330);
      expect(result.current.entries[0].protein).toBe(62);
      expect(result.current.entries[0].fat).toBe(7.2);
    });
  });

  describe("deleteEntry", () => {
    it("persists to database then removes from local state", async () => {
      const entry = makeFoodEntry();
      const product = makeProduct();
      const portion = makePortion();

      const { result } = await setupHook([entry], [product], [portion]);
      expect(result.current.entries).toHaveLength(1);

      let success = false;
      await act(async () => {
        success = await result.current.deleteEntry("entry-1");
      });

      expect(success).toBe(true);
      expect(mockDeleteFoodEntry).toHaveBeenCalledWith("entry-1");
      expect(result.current.entries).toHaveLength(0);
    });

    it("returns false and sets error when API fails", async () => {
      const entry = makeFoodEntry();
      const product = makeProduct();
      const portion = makePortion();

      const { result } = await setupHook([entry], [product], [portion]);

      // Set rejection AFTER setup to avoid being overridden
      mockDeleteFoodEntry.mockRejectedValue(new Error("Server error"));

      let success = true;
      await act(async () => {
        success = await result.current.deleteEntry("entry-1");
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe("Failed to delete entry");
      // Entry should still be present (optimistic rollback)
      expect(result.current.entries).toHaveLength(1);
    });
  });

  describe("updateEntry", () => {
    it("persists to database then updates local state", async () => {
      const entry = makeFoodEntry({ amount: 200 });
      const product = makeProduct();
      const portion = makePortion();

      const { result } = await setupHook([entry], [product], [portion]);

      let success = false;
      await act(async () => {
        success = await result.current.updateEntry("entry-1", 300, "g");
      });

      expect(success).toBe(true);
      expect(mockUpdateFoodEntry).toHaveBeenCalledWith("entry-1", {
        amount: 300,
        unit: "g",
      });
      expect(result.current.entries[0].amount).toBe(300);
    });

    it("returns false and sets error when API fails", async () => {
      const entry = makeFoodEntry();
      const product = makeProduct();
      const portion = makePortion();

      const { result } = await setupHook([entry], [product], [portion]);

      // Set rejection AFTER setup to avoid being overridden
      mockUpdateFoodEntry.mockRejectedValue(new Error("Server error"));

      let success = true;
      await act(async () => {
        success = await result.current.updateEntry("entry-1", 500, "g");
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe("Failed to update entry");
    });
  });
});
