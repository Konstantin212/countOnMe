import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as storage from "@storage/storage";
import { useWaterTracking } from "./useWaterTracking";

vi.mock("@storage/storage");
vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid"),
}));

const mockLoadWaterLogs = vi.mocked(storage.loadWaterLogs);
const mockSaveWaterLogs = vi.mocked(storage.saveWaterLogs);

const TODAY = new Date().toISOString().split("T")[0];

describe("useWaterTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadWaterLogs.mockResolvedValue([]);
    mockSaveWaterLogs.mockResolvedValue();
  });

  it("loads water logs from storage on mount", async () => {
    const logs = [
      {
        id: "w1",
        day: TODAY,
        amountMl: 250,
        createdAt: "2025-06-01T08:00:00.000Z",
      },
    ];
    mockLoadWaterLogs.mockResolvedValue(logs);

    const { result } = renderHook(() => useWaterTracking());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockLoadWaterLogs).toHaveBeenCalledTimes(1);
    expect(result.current.todayLogs).toEqual(logs);
  });

  it("returns correct shape", async () => {
    const { result } = renderHook(() => useWaterTracking());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current).toEqual(
      expect.objectContaining({
        todayTotal: expect.any(Number),
        todayLogs: expect.any(Array),
        waterGoal: expect.any(Number),
        loading: expect.any(Boolean),
        addWater: expect.any(Function),
        removeWater: expect.any(Function),
        deleteWaterLog: expect.any(Function),
        refresh: expect.any(Function),
      }),
    );
  });

  it("addWater creates a new WaterLog with today's date and saves", async () => {
    const { result } = renderHook(() => useWaterTracking());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addWater(250);
    });

    expect(mockSaveWaterLogs).toHaveBeenCalledTimes(1);
    const savedLogs = mockSaveWaterLogs.mock.calls[0][0];
    expect(savedLogs).toHaveLength(1);
    expect(savedLogs[0]).toMatchObject({
      id: "test-uuid",
      day: TODAY,
      amountMl: 250,
    });
    expect(savedLogs[0].createdAt).toBeDefined();
    expect(result.current.todayTotal).toBe(250);
  });

  it("todayTotal correctly sums only today's logs", async () => {
    const logs = [
      {
        id: "w1",
        day: TODAY,
        amountMl: 250,
        createdAt: "2025-06-01T08:00:00.000Z",
      },
      {
        id: "w2",
        day: TODAY,
        amountMl: 500,
        createdAt: "2025-06-01T12:00:00.000Z",
      },
      {
        id: "w3",
        day: "2020-01-01",
        amountMl: 1000,
        createdAt: "2020-01-01T08:00:00.000Z",
      },
    ];
    mockLoadWaterLogs.mockResolvedValue(logs);

    const { result } = renderHook(() => useWaterTracking());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.todayTotal).toBe(750);
  });

  it("todayLogs returns only logs for today", async () => {
    const todayLog = {
      id: "w1",
      day: TODAY,
      amountMl: 250,
      createdAt: "2025-06-01T08:00:00.000Z",
    };
    const oldLog = {
      id: "w2",
      day: "2020-01-01",
      amountMl: 500,
      createdAt: "2020-01-01T08:00:00.000Z",
    };
    mockLoadWaterLogs.mockResolvedValue([todayLog, oldLog]);

    const { result } = renderHook(() => useWaterTracking());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.todayLogs).toEqual([todayLog]);
  });

  it("deleteWaterLog removes from state and saves", async () => {
    const logs = [
      {
        id: "w1",
        day: TODAY,
        amountMl: 250,
        createdAt: "2025-06-01T08:00:00.000Z",
      },
      {
        id: "w2",
        day: TODAY,
        amountMl: 500,
        createdAt: "2025-06-01T12:00:00.000Z",
      },
    ];
    mockLoadWaterLogs.mockResolvedValue(logs);

    const { result } = renderHook(() => useWaterTracking());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteWaterLog("w1");
    });

    expect(result.current.todayLogs).toHaveLength(1);
    expect(result.current.todayLogs[0].id).toBe("w2");
    expect(result.current.todayTotal).toBe(500);
    expect(mockSaveWaterLogs).toHaveBeenCalledWith([logs[1]]);
  });

  it("removeWater creates negative log and reduces todayTotal", async () => {
    const logs = [
      {
        id: "w1",
        day: TODAY,
        amountMl: 500,
        createdAt: "2025-06-01T08:00:00.000Z",
      },
    ];
    mockLoadWaterLogs.mockResolvedValue(logs);

    const { result } = renderHook(() => useWaterTracking());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.removeWater(100);
    });

    expect(result.current.todayTotal).toBe(400);
    expect(result.current.todayLogs).toHaveLength(2);
    expect(result.current.todayLogs[1].amountMl).toBe(-100);
    expect(mockSaveWaterLogs).toHaveBeenCalled();
  });

  it("todayTotal clamps to zero when removing more than added", async () => {
    const logs = [
      {
        id: "w1",
        day: TODAY,
        amountMl: 50,
        createdAt: "2025-06-01T08:00:00.000Z",
      },
    ];
    mockLoadWaterLogs.mockResolvedValue(logs);

    const { result } = renderHook(() => useWaterTracking());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.removeWater(200);
    });

    expect(result.current.todayTotal).toBe(0);
  });

  it("handles empty storage gracefully", async () => {
    mockLoadWaterLogs.mockResolvedValue([]);

    const { result } = renderHook(() => useWaterTracking());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.todayTotal).toBe(0);
    expect(result.current.todayLogs).toEqual([]);
  });

  it("does not crash if storage load fails", async () => {
    mockLoadWaterLogs.mockRejectedValue(new Error("Storage error"));

    const { result } = renderHook(() => useWaterTracking());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.todayTotal).toBe(0);
    expect(result.current.todayLogs).toEqual([]);
  });

  it("uses default water goal of 2000", async () => {
    const { result } = renderHook(() => useWaterTracking());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.waterGoal).toBe(2000);
  });

  it("accepts custom water goal", async () => {
    const { result } = renderHook(() => useWaterTracking(3000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.waterGoal).toBe(3000);
  });

  it("refresh reloads from storage", async () => {
    mockLoadWaterLogs.mockResolvedValue([]);

    const { result } = renderHook(() => useWaterTracking());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updatedLogs = [
      {
        id: "w1",
        day: TODAY,
        amountMl: 500,
        createdAt: "2025-06-01T08:00:00.000Z",
      },
    ];
    mockLoadWaterLogs.mockResolvedValue(updatedLogs);

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockLoadWaterLogs).toHaveBeenCalledTimes(2);
    expect(result.current.todayLogs).toEqual(updatedLogs);
    expect(result.current.todayTotal).toBe(500);
  });
});
