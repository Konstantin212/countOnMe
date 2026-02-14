import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { getDayStats, DayStatsResponse } from "@services/api/stats";
import { useDayStats, getMealTypeTotals } from "./useDayStats";
import { makeDayStatsResponse } from "../test/helpers";

vi.mock("@services/api/stats", () => ({
  getDayStats: vi.fn(),
}));

const mockGetDayStats = vi.mocked(getDayStats);

describe("useDayStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches day stats on mount", async () => {
    const mockResponse = makeDayStatsResponse();
    mockGetDayStats.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useDayStats());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetDayStats).toHaveBeenCalledTimes(1);
    expect(result.current.stats).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("transforms API response strings to numbers", async () => {
    const mockResponse = makeDayStatsResponse({
      totals: {
        calories: "2500",
        protein: "200",
        carbs: "250",
        fat: "83",
      },
    });
    mockGetDayStats.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useDayStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats?.totals.calories).toBe(2500);
    expect(result.current.stats?.totals.protein).toBe(200);
    expect(result.current.stats?.totals.carbs).toBe(250);
    expect(result.current.stats?.totals.fat).toBe(83);
  });

  it("transforms meal type totals correctly", async () => {
    const mockResponse = makeDayStatsResponse();
    mockGetDayStats.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useDayStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const breakfastTotals = result.current.stats?.byMealType.breakfast;
    expect(breakfastTotals?.calories).toBe(500);
    expect(breakfastTotals?.protein).toBe(40);
  });

  it("handles missing meal type totals", async () => {
    const mockResponse = makeDayStatsResponse({
      by_meal_type: {
        breakfast: {
          calories: "500",
          protein: "40",
          carbs: "50",
          fat: "17",
        },
      },
    });
    mockGetDayStats.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useDayStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats?.byMealType.breakfast).toBeDefined();
    expect(result.current.stats?.byMealType.lunch).toBeUndefined();
  });

  it("handles API errors gracefully", async () => {
    mockGetDayStats.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useDayStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to load daily stats");
    // Stats should still be an object with today's date and zero totals
    expect(result.current.stats?.totals).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(result.current.stats?.byMealType).toEqual({});
  });

  it("refreshes stats when refresh is called", async () => {
    const mockResponse = makeDayStatsResponse();
    mockGetDayStats.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useDayStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetDayStats).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetDayStats).toHaveBeenCalledTimes(2);
  });

  it("handles invalid number strings by converting to 0", async () => {
    const mockResponse: DayStatsResponse = {
      day: "2025-06-01",
      totals: {
        calories: "invalid",
        protein: "",
        carbs: "NaN",
        fat: "10.5",
      },
      by_meal_type: {},
    };
    mockGetDayStats.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useDayStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats?.totals.calories).toBe(0);
    expect(result.current.stats?.totals.protein).toBe(0);
    expect(result.current.stats?.totals.carbs).toBe(0);
    expect(result.current.stats?.totals.fat).toBe(10.5);
  });
});

describe("getMealTypeTotals", () => {
  it("returns meal type totals when they exist", () => {
    const stats = {
      day: "2025-06-01",
      totals: { calories: 2000, protein: 150, carbs: 200, fat: 67 },
      byMealType: {
        breakfast: { calories: 500, protein: 40, carbs: 50, fat: 17 },
      },
    };

    const totals = getMealTypeTotals(stats, "breakfast");
    expect(totals).toEqual({ calories: 500, protein: 40, carbs: 50, fat: 17 });
  });

  it("returns zero macros when meal type does not exist", () => {
    const stats = {
      day: "2025-06-01",
      totals: { calories: 2000, protein: 150, carbs: 200, fat: 67 },
      byMealType: {},
    };

    const totals = getMealTypeTotals(stats, "breakfast");
    expect(totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("returns zero macros when stats is null", () => {
    const totals = getMealTypeTotals(null, "breakfast");
    expect(totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});
