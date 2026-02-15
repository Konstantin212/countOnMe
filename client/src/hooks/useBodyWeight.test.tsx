import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BodyWeightEntry } from "@models/types";
import * as bodyWeightsApi from "@services/api/bodyWeights";
import * as storage from "@storage/storage";
import { useBodyWeight } from "./useBodyWeight";

vi.mock("@services/api/bodyWeights");
vi.mock("@storage/storage");
vi.mock("@storage/syncQueue", () => ({
  enqueue: vi.fn(() => Promise.resolve()),
}));

const mockListBodyWeights = vi.mocked(bodyWeightsApi.listBodyWeights);
const mockCreateBodyWeight = vi.mocked(bodyWeightsApi.createBodyWeight);
const mockUpdateBodyWeight = vi.mocked(bodyWeightsApi.updateBodyWeight);
const mockDeleteBodyWeight = vi.mocked(bodyWeightsApi.deleteBodyWeight);
const mockLoadBodyWeights = vi.mocked(storage.loadBodyWeights);
const mockSaveBodyWeights = vi.mocked(storage.saveBodyWeights);

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
    mockLoadBodyWeights.mockResolvedValue([]);
    mockSaveBodyWeights.mockResolvedValue();
    mockListBodyWeights.mockResolvedValue([]);
  });

  it("loads weights from local storage first", async () => {
    const localWeights = [makeBodyWeightEntry()];
    mockLoadBodyWeights.mockResolvedValue(localWeights);
    mockListBodyWeights.mockResolvedValue(localWeights);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weights).toEqual(localWeights);
    expect(mockLoadBodyWeights).toHaveBeenCalledTimes(1);
  });

  it("syncs with remote weights if available", async () => {
    const localWeights = [makeBodyWeightEntry({ id: "w1" })];
    const remoteWeights = [
      makeBodyWeightEntry({ id: "w1" }),
      makeBodyWeightEntry({ id: "w2", day: "2025-06-16", weightKg: 79 }),
    ];
    mockLoadBodyWeights.mockResolvedValue(localWeights);
    mockListBodyWeights.mockResolvedValue(remoteWeights);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weights).toEqual(remoteWeights);
    expect(mockSaveBodyWeights).toHaveBeenCalledWith(remoteWeights);
  });

  it("handles backend unavailable gracefully", async () => {
    const localWeights = [makeBodyWeightEntry()];
    mockLoadBodyWeights.mockResolvedValue(localWeights);
    mockListBodyWeights.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weights).toEqual(localWeights);
    expect(result.current.error).toBeNull();
  });

  it("logs new weight entry", async () => {
    mockLoadBodyWeights.mockResolvedValue([]);
    const newEntry = makeBodyWeightEntry();
    mockCreateBodyWeight.mockResolvedValue(newEntry);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let createdEntry: BodyWeightEntry | undefined;
    await act(async () => {
      createdEntry = await result.current.logWeight("2025-06-15", 80);
    });

    expect(createdEntry).toEqual(newEntry);
    expect(result.current.weights).toContainEqual(newEntry);
    expect(mockSaveBodyWeights).toHaveBeenCalledWith([newEntry]);
  });

  it("handles 409 conflict by updating existing entry", async () => {
    mockLoadBodyWeights.mockResolvedValue([]);

    // First call (create) throws 409
    const conflictError: any = new Error("Conflict");
    conflictError.status = 409;
    mockCreateBodyWeight.mockRejectedValue(conflictError);

    // listBodyWeights returns existing entry for that day
    const existingEntry = makeBodyWeightEntry({
      id: "existing-w1",
      day: "2025-06-15",
      weightKg: 79,
    });
    mockListBodyWeights.mockResolvedValue([existingEntry]);

    // updateBodyWeight succeeds
    const updatedEntry = makeBodyWeightEntry({
      id: "existing-w1",
      day: "2025-06-15",
      weightKg: 80,
    });
    mockUpdateBodyWeight.mockResolvedValue(updatedEntry);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let resultEntry: BodyWeightEntry | undefined;
    await act(async () => {
      resultEntry = await result.current.logWeight("2025-06-15", 80);
    });

    expect(resultEntry).toEqual(updatedEntry);
    expect(mockUpdateBodyWeight).toHaveBeenCalledWith("existing-w1", 80);
    expect(result.current.weights).toContainEqual(updatedEntry);
  });

  it("updates weight entry", async () => {
    const existingEntry = makeBodyWeightEntry();
    mockLoadBodyWeights.mockResolvedValue([existingEntry]);
    mockListBodyWeights.mockResolvedValue([existingEntry]);

    const updatedEntry = makeBodyWeightEntry({ weightKg: 78 });
    mockUpdateBodyWeight.mockResolvedValue(updatedEntry);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let resultEntry: BodyWeightEntry | undefined;
    await act(async () => {
      resultEntry = await result.current.updateWeight("w1", 78);
    });

    expect(resultEntry).toEqual(updatedEntry);
    expect(result.current.weights).toContainEqual(updatedEntry);
  });

  it("deletes weight entry", async () => {
    const existingEntry = makeBodyWeightEntry();
    mockLoadBodyWeights.mockResolvedValue([existingEntry]);
    mockDeleteBodyWeight.mockResolvedValue();

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.deleteWeight("w1");
    });

    expect(success).toBe(true);
    expect(result.current.weights).not.toContainEqual(existingEntry);
  });

  it("refreshes weights from storage and backend", async () => {
    const weights = [makeBodyWeightEntry()];
    mockLoadBodyWeights.mockResolvedValue([]);
    mockListBodyWeights.mockResolvedValue(weights);

    const { result } = renderHook(() => useBodyWeight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockLoadBodyWeights).toHaveBeenCalledTimes(2);
    expect(mockListBodyWeights).toHaveBeenCalledTimes(2);
  });
});
