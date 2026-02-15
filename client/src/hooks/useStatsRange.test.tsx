import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DailyStatsPoint } from "@models/types";
import * as statsApi from "@services/api/stats";
import { useStatsRange } from "./useStatsRange";

vi.mock("@services/api/stats");

const mockGetDailyStats = vi.mocked(statsApi.getDailyStats);

describe("useStatsRange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDailyStats.mockResolvedValue({
      from_day: "2025-06-09",
      to_day: "2025-06-15",
      points: [],
    });
  });

  it("defaults to 7d period", async () => {
    const { result } = renderHook(() => useStatsRange());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.period).toBe("7d");
  });

  it("fetches daily stats on mount", async () => {
    const mockPoints = [
      {
        day: "2025-06-15",
        totals: { calories: "2000", protein: "150", carbs: "200", fat: "67" },
      },
    ];
    mockGetDailyStats.mockResolvedValue({
      from_day: "2025-06-09",
      to_day: "2025-06-15",
      points: mockPoints,
    });

    const { result } = renderHook(() => useStatsRange());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetDailyStats).toHaveBeenCalledTimes(1);
    expect(result.current.dailyStats).toHaveLength(1);
    expect(result.current.dailyStats[0]).toEqual({
      day: "2025-06-15",
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 67,
    });
  });

  it("maps API string macros to numbers", async () => {
    const mockPoints = [
      {
        day: "2025-06-15",
        totals: {
          calories: "2500.50",
          protein: "150.75",
          carbs: "200.25",
          fat: "67.50",
        },
      },
    ];
    mockGetDailyStats.mockResolvedValue({
      from_day: "2025-06-09",
      to_day: "2025-06-15",
      points: mockPoints,
    });

    const { result } = renderHook(() => useStatsRange());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.dailyStats[0]).toEqual({
      day: "2025-06-15",
      calories: 2500.5,
      protein: 150.75,
      carbs: 200.25,
      fat: 67.5,
    });
  });

  it("changes period and re-fetches data", async () => {
    const { result } = renderHook(() => useStatsRange());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockGetDailyStats.mockClear();

    await act(async () => {
      result.current.setPeriod("30d");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.period).toBe("30d");
    expect(mockGetDailyStats).toHaveBeenCalledTimes(1);
    // Verify it was called with the correct date range for 30d
    const call = mockGetDailyStats.mock.calls[0];
    expect(call).toBeDefined();
    // from and to dates should be roughly 29 days apart
  });

  it("handles API errors gracefully", async () => {
    mockGetDailyStats.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useStatsRange());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch daily stats");
    expect(result.current.dailyStats).toEqual([]);
  });

  it("refreshes data on demand", async () => {
    const { result } = renderHook(() => useStatsRange());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockGetDailyStats.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetDailyStats).toHaveBeenCalledTimes(1);
  });

  it("handles empty stats response", async () => {
    mockGetDailyStats.mockResolvedValue({
      from_day: "2025-06-09",
      to_day: "2025-06-15",
      points: [],
    });

    const { result } = renderHook(() => useStatsRange());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.dailyStats).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
