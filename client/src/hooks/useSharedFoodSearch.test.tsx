import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SharedFoodListItem } from "@models/types";
import { useSharedFoodSearch } from "./useSharedFoodSearch";

vi.mock("@services/api/sharedFoods", () => ({
  searchSharedFoods: vi.fn(),
}));

const { searchSharedFoods } = await import("@services/api/sharedFoods");

const mockSearchSharedFoods = vi.mocked(searchSharedFoods);

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
  visibility: "public",
  moderationStatus: "approved",
  defaultPortion: null,
  ...overrides,
});

describe("useSharedFoodSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSearchSharedFoods.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initial state: empty results, not loading, not error, hasSearched=false", () => {
    const { result } = renderHook(() => useSharedFoodSearch());

    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.hasSearched).toBe(false);
    expect(result.current.query).toBe("");
  });

  it("setting query triggers debounced search after 400ms", async () => {
    const items = [makeListItem()];
    mockSearchSharedFoods.mockResolvedValue(items);

    const { result } = renderHook(() => useSharedFoodSearch());

    act(() => {
      result.current.setQuery("chicken");
    });

    // Before debounce fires, loading should be true but search not called
    expect(result.current.loading).toBe(true);
    expect(mockSearchSharedFoods).not.toHaveBeenCalled();

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSearchSharedFoods).toHaveBeenCalledWith("chicken");
    expect(result.current.results).toEqual(items);
    expect(result.current.hasSearched).toBe(true);
  });

  it("failed search: isError=true, results empty", async () => {
    mockSearchSharedFoods.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useSharedFoodSearch());

    act(() => {
      result.current.setQuery("bad query");
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.results).toEqual([]);
  });

  it("clearing query: results cleared, hasSearched=false", async () => {
    const items = [makeListItem()];
    mockSearchSharedFoods.mockResolvedValue(items);

    const { result } = renderHook(() => useSharedFoodSearch());

    // First search
    act(() => {
      result.current.setQuery("chicken");
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(result.current.hasSearched).toBe(true);
    });

    // Clear query
    act(() => {
      result.current.setQuery("");
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.hasSearched).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("rapid query changes: only last query fires (debounce)", async () => {
    const items = [makeListItem({ displayName: "Final Result" })];
    mockSearchSharedFoods.mockResolvedValue(items);

    const { result } = renderHook(() => useSharedFoodSearch());

    act(() => {
      result.current.setQuery("c");
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.setQuery("ch");
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.setQuery("chi");
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.setQuery("chicken");
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Only the final query should have been searched
    expect(mockSearchSharedFoods).toHaveBeenCalledTimes(1);
    expect(mockSearchSharedFoods).toHaveBeenCalledWith("chicken");
  });

  it("retry re-fires the last query", async () => {
    mockSearchSharedFoods.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useSharedFoodSearch());

    // Trigger a failed search
    act(() => {
      result.current.setQuery("chicken");
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Setup success for retry
    const items = [makeListItem()];
    mockSearchSharedFoods.mockResolvedValue(items);

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.results).toEqual(items);
    expect(mockSearchSharedFoods).toHaveBeenCalledTimes(2);
  });
});
