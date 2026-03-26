import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SharedFoodListItem } from "@models/types";
import { useMySharedFoods } from "./useMySharedFoods";

vi.mock("@services/api/sharedFoods", () => ({
  listMySharedFoods: vi.fn(),
  publishSharedFood: vi.fn(),
  unpublishSharedFood: vi.fn(),
  deleteSharedFood: vi.fn(),
}));

const {
  listMySharedFoods,
  publishSharedFood,
  unpublishSharedFood,
  deleteSharedFood,
} = await import("@services/api/sharedFoods");

const mockListMySharedFoods = vi.mocked(listMySharedFoods);
const mockPublishSharedFood = vi.mocked(publishSharedFood);
const mockUnpublishSharedFood = vi.mocked(unpublishSharedFood);
const mockDeleteSharedFood = vi.mocked(deleteSharedFood);

const makeListItem = (
  overrides?: Partial<SharedFoodListItem>,
): SharedFoodListItem => ({
  id: "food-1",
  ownerUserId: "user-1",
  name: "chicken_breast",
  displayName: "Chicken Breast",
  brand: null,
  barcode: null,
  category: null,
  visibility: "private",
  moderationStatus: "pending",
  defaultPortion: null,
  ...overrides,
});

describe("useMySharedFoods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListMySharedFoods.mockResolvedValue([]);
  });

  it("loads foods on mount", async () => {
    const foods = [makeListItem(), makeListItem({ id: "food-2" })];
    mockListMySharedFoods.mockResolvedValue(foods);

    const { result } = renderHook(() => useMySharedFoods());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.foods).toEqual(foods);
    expect(result.current.error).toBeNull();
    expect(mockListMySharedFoods).toHaveBeenCalledTimes(1);
  });

  it("refresh updates the list", async () => {
    mockListMySharedFoods.mockResolvedValue([makeListItem()]);

    const { result } = renderHook(() => useMySharedFoods());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.foods).toHaveLength(1);

    // Refresh with updated data
    mockListMySharedFoods.mockResolvedValue([
      makeListItem(),
      makeListItem({ id: "food-2" }),
    ]);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.foods).toHaveLength(2);
    expect(mockListMySharedFoods).toHaveBeenCalledTimes(2);
  });

  it("publishFood calls API and refreshes", async () => {
    const food = makeListItem();
    mockListMySharedFoods.mockResolvedValue([food]);
    mockPublishSharedFood.mockResolvedValue({
      id: "food-1",
      ownerUserId: "user-1",
      name: "chicken_breast",
      displayName: "Chicken Breast",
      description: null,
      brand: null,
      barcode: null,
      category: null,
      visibility: "public",
      moderationStatus: "pending",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      portions: [],
    });

    const { result } = renderHook(() => useMySharedFoods());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.publishFood("food-1");
    });

    expect(mockPublishSharedFood).toHaveBeenCalledWith("food-1");
    // refresh called: once on mount + once after publish
    expect(mockListMySharedFoods).toHaveBeenCalledTimes(2);
  });

  it("unpublishFood calls API and refreshes", async () => {
    mockListMySharedFoods.mockResolvedValue([makeListItem()]);
    mockUnpublishSharedFood.mockResolvedValue({
      id: "food-1",
      ownerUserId: "user-1",
      name: "chicken_breast",
      displayName: "Chicken Breast",
      description: null,
      brand: null,
      barcode: null,
      category: null,
      visibility: "private",
      moderationStatus: "pending",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      portions: [],
    });

    const { result } = renderHook(() => useMySharedFoods());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.unpublishFood("food-1");
    });

    expect(mockUnpublishSharedFood).toHaveBeenCalledWith("food-1");
    expect(mockListMySharedFoods).toHaveBeenCalledTimes(2);
  });

  it("deleteFood calls API and removes item optimistically", async () => {
    mockListMySharedFoods.mockResolvedValue([
      makeListItem({ id: "food-1" }),
      makeListItem({ id: "food-2" }),
    ]);
    mockDeleteSharedFood.mockResolvedValue(undefined);

    const { result } = renderHook(() => useMySharedFoods());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.foods).toHaveLength(2);

    await act(async () => {
      await result.current.deleteFood("food-1");
    });

    // Item removed optimistically (no refresh needed)
    expect(result.current.foods).toHaveLength(1);
    expect(result.current.foods[0].id).toBe("food-2");
    expect(mockDeleteSharedFood).toHaveBeenCalledWith("food-1");
    // Only initial load, no refresh call after delete
    expect(mockListMySharedFoods).toHaveBeenCalledTimes(1);
  });

  it("error state on API failure", async () => {
    mockListMySharedFoods.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useMySharedFoods());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to load shared foods");
    expect(result.current.foods).toEqual([]);
  });
});
