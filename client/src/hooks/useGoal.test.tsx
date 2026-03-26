import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as goalsApi from "@services/api/goals";
import { goalRepository, outboxRepository } from "@storage/repositories";
import { useGoal } from "./useGoal";
import { makeUserGoal } from "../test/helpers";

const mockDbContext = { db: {}, userId: "test-user" };
vi.mock("../storage/DatabaseProvider", () => ({
  useDatabaseContext: vi.fn(() => mockDbContext),
}));

vi.mock("@services/api/goals");

vi.mock("../storage/repositories", () => ({
  goalRepository: {
    getCurrent: vi.fn(() => Promise.resolve(null)),
    upsert: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
  },
  outboxRepository: {
    enqueue: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("@services/syncEngine", () => ({
  debouncedSync: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "uuid-mock"),
}));

const mockApiGetCurrentGoal = vi.mocked(goalsApi.getCurrentGoal);
const mockApiCalculateGoal = vi.mocked(goalsApi.calculateGoal);
const mockGetCurrent = vi.mocked(goalRepository.getCurrent);
const mockUpsert = vi.mocked(goalRepository.upsert);
const mockRemove = vi.mocked(goalRepository.remove);
const mockEnqueue = vi.mocked(outboxRepository.enqueue);

describe("useGoal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrent.mockResolvedValue(null);
    mockUpsert.mockResolvedValue();
    mockRemove.mockResolvedValue();
    mockApiGetCurrentGoal.mockResolvedValue(null);
  });

  it("loads goal from local storage first", async () => {
    const localGoal = makeUserGoal();
    mockGetCurrent.mockResolvedValue(localGoal);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.goal).toEqual(localGoal);
    expect(mockGetCurrent).toHaveBeenCalledTimes(1);
  });

  it("syncs with remote goal if available", async () => {
    const localGoal = makeUserGoal({ id: "local-1" });
    const remoteGoal = makeUserGoal({ id: "remote-1" });
    mockGetCurrent.mockResolvedValue(localGoal);
    mockApiGetCurrentGoal.mockResolvedValue(remoteGoal);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.goal).toEqual(remoteGoal);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.anything(),
      "test-user",
      remoteGoal,
    );
  });

  it("handles backend unavailable gracefully", async () => {
    const localGoal = makeUserGoal();
    mockGetCurrent.mockResolvedValue(localGoal);
    mockApiGetCurrentGoal.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.goal).toEqual(localGoal);
    expect(result.current.error).toBeNull();
  });

  it("calculates goal via API", async () => {
    mockGetCurrent.mockResolvedValue(null);
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

  it("saves calculated goal locally and enqueues to outbox", async () => {
    mockGetCurrent.mockResolvedValue(null);

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

    expect(result.current.goal).toBeDefined();
    expect(result.current.goal?.goalType).toBe("calculated");
    expect(result.current.goal?.id).toBe("uuid-mock");
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: "user_goal",
        action: "upsert",
        entityId: "uuid-mock",
        data: expect.objectContaining({
          goal_type: "calculated",
          gender: "male",
        }),
      }),
    );
  });

  it("saves manual goal locally and enqueues to outbox", async () => {
    mockGetCurrent.mockResolvedValue(null);

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

    expect(result.current.goal).toBeDefined();
    expect(result.current.goal?.goalType).toBe("manual");
    expect(result.current.goal?.dailyCaloriesKcal).toBe(2000);
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: "user_goal",
        action: "upsert",
        data: expect.objectContaining({
          goal_type: "manual",
          daily_calories_kcal: 2000,
        }),
      }),
    );
  });

  it("updates goal locally and enqueues to outbox", async () => {
    const existingGoal = makeUserGoal();
    mockGetCurrent.mockResolvedValue(existingGoal);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateGoal({ dailyCaloriesKcal: 2500 });
    });

    expect(result.current.goal?.dailyCaloriesKcal).toBe(2500);
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: "user_goal",
        action: "upsert",
        data: expect.objectContaining({
          daily_calories_kcal: 2500,
        }),
      }),
    );
  });

  it("returns null when updating with no existing goal", async () => {
    mockGetCurrent.mockResolvedValue(null);

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
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("deletes goal locally and enqueues to outbox", async () => {
    const existingGoal = makeUserGoal();
    mockGetCurrent.mockResolvedValue(existingGoal);

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
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: "user_goal",
        action: "delete",
        entityId: existingGoal.id,
        data: null,
      }),
    );
  });

  it("returns false when deleting with no existing goal", async () => {
    mockGetCurrent.mockResolvedValue(null);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success;
    await act(async () => {
      success = await result.current.deleteGoal();
    });

    expect(success).toBe(false);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("refreshes goal from storage and backend", async () => {
    const goal = makeUserGoal();
    mockGetCurrent.mockResolvedValue(null);
    mockApiGetCurrentGoal.mockResolvedValue(goal);

    const { result } = renderHook(() => useGoal());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetCurrent).toHaveBeenCalledTimes(2);
    expect(mockApiGetCurrentGoal).toHaveBeenCalledTimes(2);
  });
});
