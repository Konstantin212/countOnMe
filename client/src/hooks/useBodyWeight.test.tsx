import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BodyWeightEntry } from "@models/types";
import * as bodyWeightsApi from "@services/api/bodyWeights";
import { bodyWeightRepository, outboxRepository } from "@storage/repositories";
import { useBodyWeight } from "./useBodyWeight";

const mockDbContext = { db: {}, userId: "test-user" };
vi.mock("../storage/DatabaseProvider", () => ({
  useDatabaseContext: vi.fn(() => mockDbContext),
}));

vi.mock("@services/api/bodyWeights");

vi.mock("../storage/repositories", () => ({
  bodyWeightRepository: {
    findAll: vi.fn(() => Promise.resolve([])),
    upsert: vi.fn(() => Promise.resolve()),
    markDeleted: vi.fn(() => Promise.resolve()),
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

const mockListBodyWeights = vi.mocked(bodyWeightsApi.listBodyWeights);
const mockFindAll = vi.mocked(bodyWeightRepository.findAll);
const mockUpsert = vi.mocked(bodyWeightRepository.upsert);
const mockMarkDeleted = vi.mocked(bodyWeightRepository.markDeleted);
const mockEnqueue = vi.mocked(outboxRepository.enqueue);

const makeBodyWeightEntry = (
  overrides: Partial<BodyWeightEntry> = {},
): BodyWeightEntry => ({
  id: "w1",
  day: "2025-06-15",
  weightKg: 80,
  createdAt: "2025-06-15T00:00:00.000Z",
  updatedAt: "2025-06-15T00:00:00.000Z",
  ...overrides,
});

describe("useBodyWeight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindAll.mockResolvedValue([]);
    mockUpsert.mockResolvedValue();
    mockMarkDeleted.mockResolvedValue();
    mockListBodyWeights.mockResolvedValue([]);
  });

  it("loads weights from local storage first", async () => {
    const localWeights = [makeBodyWeightEntry()];
    mockFindAll.mockResolvedValue(localWeights);
    mockListBodyWeights.mockResolvedValue(localWeights);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weights).toEqual(localWeights);
    expect(mockFindAll).toHaveBeenCalledTimes(1);
  });

  it("syncs with remote weights if available", async () => {
    const localWeights = [makeBodyWeightEntry({ id: "w1" })];
    const remoteWeights = [
      makeBodyWeightEntry({ id: "w1" }),
      makeBodyWeightEntry({ id: "w2", day: "2025-06-16", weightKg: 79 }),
    ];
    mockFindAll.mockResolvedValue(localWeights);
    mockListBodyWeights.mockResolvedValue(remoteWeights);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weights).toEqual(remoteWeights);
    // Each remote entry is upserted individually
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it("handles backend unavailable gracefully", async () => {
    const localWeights = [makeBodyWeightEntry()];
    mockFindAll.mockResolvedValue(localWeights);
    mockListBodyWeights.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weights).toEqual(localWeights);
    expect(result.current.error).toBeNull();
  });

  it("logs new weight entry locally and enqueues to outbox", async () => {
    mockFindAll.mockResolvedValue([]);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let createdEntry: BodyWeightEntry | undefined;
    await act(async () => {
      createdEntry = await result.current.logWeight("2025-06-15", 80);
    });

    expect(createdEntry).toBeDefined();
    expect(createdEntry?.id).toBe("uuid-mock");
    expect(createdEntry?.day).toBe("2025-06-15");
    expect(createdEntry?.weightKg).toBe(80);
    expect(result.current.weights).toHaveLength(1);
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: "body_weight",
        action: "upsert",
        entityId: "uuid-mock",
        data: expect.objectContaining({
          day: "2025-06-15",
          weight_kg: 80,
        }),
      }),
    );
  });

  it("updates existing entry when logging weight for same day", async () => {
    const existingEntry = makeBodyWeightEntry({
      id: "existing-w1",
      day: "2025-06-15",
      weightKg: 79,
    });
    mockFindAll.mockResolvedValue([existingEntry]);
    mockListBodyWeights.mockResolvedValue([existingEntry]);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let resultEntry: BodyWeightEntry | undefined;
    await act(async () => {
      resultEntry = await result.current.logWeight("2025-06-15", 80);
    });

    expect(resultEntry?.id).toBe("existing-w1");
    expect(resultEntry?.weightKg).toBe(80);
    expect(result.current.weights).toHaveLength(1);
    expect(result.current.weights[0].weightKg).toBe(80);
  });

  it("updates weight entry locally and enqueues to outbox", async () => {
    const existingEntry = makeBodyWeightEntry();
    mockFindAll.mockResolvedValue([existingEntry]);
    mockListBodyWeights.mockResolvedValue([existingEntry]);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let resultEntry: BodyWeightEntry | undefined;
    await act(async () => {
      resultEntry = await result.current.updateWeight("w1", 78);
    });

    expect(resultEntry?.weightKg).toBe(78);
    expect(result.current.weights[0].weightKg).toBe(78);
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: "body_weight",
        action: "upsert",
        data: expect.objectContaining({
          weight_kg: 78,
        }),
      }),
    );
  });

  it("throws when updating a non-existent weight entry", async () => {
    mockFindAll.mockResolvedValue([]);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.updateWeight("nonexistent", 78);
      }),
    ).rejects.toThrow("Entry not found");
  });

  it("deletes weight entry locally and enqueues to outbox", async () => {
    const existingEntry = makeBodyWeightEntry();
    mockFindAll.mockResolvedValue([existingEntry]);
    mockListBodyWeights.mockResolvedValue([existingEntry]);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.deleteWeight("w1");
    });

    expect(success).toBe(true);
    expect(result.current.weights).toHaveLength(0);
    expect(mockMarkDeleted).toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: "body_weight",
        action: "delete",
        entityId: "w1",
        data: null,
      }),
    );
  });

  it("returns false when deleting non-existent weight", async () => {
    mockFindAll.mockResolvedValue([]);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = true;
    await act(async () => {
      success = await result.current.deleteWeight("nonexistent");
    });

    expect(success).toBe(false);
  });

  it("refreshes weights from storage and backend", async () => {
    const weights = [makeBodyWeightEntry()];
    mockFindAll.mockResolvedValue([]);
    mockListBodyWeights.mockResolvedValue(weights);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockFindAll).toHaveBeenCalledTimes(2);
    expect(mockListBodyWeights).toHaveBeenCalledTimes(2);
  });
});
