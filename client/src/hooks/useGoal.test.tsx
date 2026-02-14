import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as goalsApi from "@services/api/goals";
import * as storage from "@storage/storage";
import { useGoal } from "./useGoal";
import { makeUserGoal } from "../test/helpers";

vi.mock("@services/api/goals");
vi.mock("@storage/storage");
vi.mock("@storage/syncQueue", () => ({
  enqueue: vi.fn(() => Promise.resolve()),
}));

const mockApiGetCurrentGoal = vi.mocked(goalsApi.getCurrentGoal);
const mockApiCalculateGoal = vi.mocked(goalsApi.calculateGoal);
const mockApiCreateCalculatedGoal = vi.mocked(goalsApi.createCalculatedGoal);
const mockApiCreateManualGoal = vi.mocked(goalsApi.createManualGoal);
const mockApiUpdateGoal = vi.mocked(goalsApi.updateGoal);
const mockApiDeleteGoal = vi.mocked(goalsApi.deleteGoal);
const mockLoadGoal = vi.mocked(storage.loadGoal);
const mockSaveGoal = vi.mocked(storage.saveGoal);
const mockClearGoal = vi.mocked(storage.clearGoal);

describe("useGoal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadGoal.mockResolvedValue(null);
    mockSaveGoal.mockResolvedValue();
    mockClearGoal.mockResolvedValue();
    mockApiGetCurrentGoal.mockResolvedValue(null);
  });

  it("loads goal from local storage first", async () => {
    const localGoal = makeUserGoal();
    mockLoadGoal.mockResolvedValue(localGoal);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.goal).toEqual(localGoal);
    expect(mockLoadGoal).toHaveBeenCalledTimes(1);
  });

  it("syncs with remote goal if available", async () => {
    const localGoal = makeUserGoal({ id: "local-1" });
    const remoteGoal = makeUserGoal({ id: "remote-1" });
    mockLoadGoal.mockResolvedValue(localGoal);
    mockApiGetCurrentGoal.mockResolvedValue(remoteGoal);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.goal).toEqual(remoteGoal);
    expect(mockSaveGoal).toHaveBeenCalledWith(remoteGoal);
  });

  it("handles backend unavailable gracefully", async () => {
    const localGoal = makeUserGoal();
    mockLoadGoal.mockResolvedValue(localGoal);
    mockApiGetCurrentGoal.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.goal).toEqual(localGoal);
    expect(result.current.error).toBeNull();
  });

  it("calculates goal", async () => {
    mockLoadGoal.mockResolvedValue(null);
    const calculateResponse = {
      bmrKcal: 1800,
      tdeeKcal: 2200,
      dailyCaloriesKcal: 2000,
      proteinPercent: 30,
      carbsPercent: 40,
      fatPercent: 30,
      proteinGrams: 150,
      carbsGrams: 200,
      fatGrams: 67,
      waterMl: 2000,
      healthyWeightMinKg: 60,
      healthyWeightMaxKg: 80,
      currentBmi: 24.7,
      bmiCategory: "normal",
    };
    mockApiCalculateGoal.mockResolvedValue(calculateResponse);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let response;
    await act(async () => {
      response = await result.current.calculateGoal({
        gender: "male",
        birthDate: "1996-01-01",
        heightCm: 180,
        currentWeightKg: 80,
        activityLevel: "moderate",
        weightGoalType: "maintain",
      });
    });

    expect(response).toEqual(calculateResponse);
    expect(mockApiCalculateGoal).toHaveBeenCalledTimes(1);
  });

  it("saves calculated goal", async () => {
    mockLoadGoal.mockResolvedValue(null);
    const newGoal = makeUserGoal({ goalType: "calculated" });
    mockApiCreateCalculatedGoal.mockResolvedValue(newGoal);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.saveCalculatedGoal({
        gender: "male",
        birthDate: "1996-01-01",
        heightCm: 180,
        currentWeightKg: 80,
        activityLevel: "moderate",
        weightGoalType: "maintain",
      });
    });

    expect(result.current.goal).toEqual(newGoal);
    expect(mockSaveGoal).toHaveBeenCalledWith(newGoal);
  });

  it("saves manual goal", async () => {
    mockLoadGoal.mockResolvedValue(null);
    const newGoal = makeUserGoal({ goalType: "manual" });
    mockApiCreateManualGoal.mockResolvedValue(newGoal);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.saveManualGoal({
        dailyCaloriesKcal: 2000,
        proteinPercent: 30,
        carbsPercent: 40,
        fatPercent: 30,
        waterMl: 2000,
      });
    });

    expect(result.current.goal).toEqual(newGoal);
    expect(mockSaveGoal).toHaveBeenCalledWith(newGoal);
  });

  it("updates goal", async () => {
    const existingGoal = makeUserGoal();
    const updatedGoal = makeUserGoal({ dailyCaloriesKcal: 2500 });
    mockLoadGoal.mockResolvedValue(existingGoal);
    mockApiUpdateGoal.mockResolvedValue(updatedGoal);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateGoal({ dailyCaloriesKcal: 2500 });
    });

    expect(result.current.goal).toEqual(updatedGoal);
    expect(mockSaveGoal).toHaveBeenCalledWith(updatedGoal);
  });

  it("returns null when updating with no existing goal", async () => {
    mockLoadGoal.mockResolvedValue(null);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let updatedGoal;
    await act(async () => {
      updatedGoal = await result.current.updateGoal({
        dailyCaloriesKcal: 2500,
      });
    });

    expect(updatedGoal).toBeNull();
    expect(mockApiUpdateGoal).not.toHaveBeenCalled();
  });

  it("deletes goal", async () => {
    const existingGoal = makeUserGoal();
    mockLoadGoal.mockResolvedValue(existingGoal);
    mockApiDeleteGoal.mockResolvedValue(undefined);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success;
    await act(async () => {
      success = await result.current.deleteGoal();
    });

    expect(success).toBe(true);
    expect(result.current.goal).toBeNull();
    expect(mockClearGoal).toHaveBeenCalledTimes(1);
  });

  it("returns false when deleting with no existing goal", async () => {
    mockLoadGoal.mockResolvedValue(null);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success;
    await act(async () => {
      success = await result.current.deleteGoal();
    });

    expect(success).toBe(false);
    expect(mockApiDeleteGoal).not.toHaveBeenCalled();
  });

  it("refreshes goal from storage and backend", async () => {
    const goal = makeUserGoal();
    mockLoadGoal.mockResolvedValue(null);
    mockApiGetCurrentGoal.mockResolvedValue(goal);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockLoadGoal).toHaveBeenCalledTimes(2);
    expect(mockApiGetCurrentGoal).toHaveBeenCalledTimes(2);
  });
});
