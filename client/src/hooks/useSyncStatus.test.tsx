import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock NetInfo before importing useSyncStatus
vi.mock("@react-native-community/netinfo", () => ({
  default: {
    addEventListener: vi.fn(() => vi.fn()),
    fetch: vi.fn(() => Promise.resolve({ isConnected: true })),
  },
}));

vi.mock("@services/api/config");
vi.mock("@storage/device");
vi.mock("@storage/syncQueue");

import NetInfo from "@react-native-community/netinfo";
import * as config from "@services/api/config";
import * as device from "@storage/device";
import * as syncQueue from "@storage/syncQueue";
import { useSyncStatus } from "./useSyncStatus";

const mockNetInfo = vi.mocked(NetInfo);
const mockGetApiBaseUrl = vi.mocked(config.getApiBaseUrl);
const mockGetOrCreateDeviceId = vi.mocked(device.getOrCreateDeviceId);
const mockGetDeviceToken = vi.mocked(device.getDeviceToken);
const mockGetQueue = vi.mocked(syncQueue.getQueue);
const mockGetLastSyncAt = vi.mocked(syncQueue.getLastSyncAt);
const mockGetLastSyncError = vi.mocked(syncQueue.getLastSyncError);
const mockFlush = vi.mocked(syncQueue.flush);

describe("useSyncStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockGetApiBaseUrl.mockReturnValue("http://localhost:8000");
    mockGetOrCreateDeviceId.mockResolvedValue("device-123");
    mockGetDeviceToken.mockResolvedValue("token-abc");
    mockGetQueue.mockResolvedValue([]);
    mockGetLastSyncAt.mockResolvedValue(null);
    mockGetLastSyncError.mockResolvedValue(null);
    mockFlush.mockResolvedValue();

    // Mock NetInfo listener
    mockNetInfo.addEventListener.mockReturnValue(() => {});
  });

  it("returns base URL from config", async () => {
    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.deviceId).not.toBe("");
    });

    expect(result.current.baseUrl).toBe("http://localhost:8000");
  });

  it("loads device ID on mount", async () => {
    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.deviceId).toBe("device-123");
    });

    expect(mockGetOrCreateDeviceId).toHaveBeenCalledTimes(1);
  });

  it("checks if device has token", async () => {
    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.hasToken).toBe(true);
    });

    expect(mockGetDeviceToken).toHaveBeenCalledTimes(1);
  });

  it("returns false for hasToken when no token exists", async () => {
    mockGetDeviceToken.mockResolvedValue(null);

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.hasToken).toBe(false);
    });
  });

  it("tracks online status from NetInfo", async () => {
    let netInfoListener: any;
    mockNetInfo.addEventListener.mockImplementation((callback) => {
      netInfoListener = callback;
      return () => {};
    });

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.deviceId).not.toBe("");
    });

    // Initial state (default mock isConnected: true from setup.ts won't apply here)
    // Trigger connection change
    act(() => {
      netInfoListener({ isConnected: false });
    });

    expect(result.current.isOnline).toBe(false);

    act(() => {
      netInfoListener({ isConnected: true });
    });

    expect(result.current.isOnline).toBe(true);
  });

  it("returns queue size", async () => {
    mockGetQueue.mockResolvedValue([
      { id: "1", resource: "products", action: "create", payload: {} },
      { id: "2", resource: "meals", action: "update", payload: {} },
    ]);

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.queueSize).toBe(2);
    });
  });

  it("returns last sync timestamp", async () => {
    const timestamp = Date.now();
    mockGetLastSyncAt.mockResolvedValue(timestamp);

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.lastSyncAt).toBe(timestamp);
    });
  });

  it("returns last sync error", async () => {
    mockGetLastSyncError.mockResolvedValue("Network timeout");

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.lastError).toBe("Network timeout");
    });
  });

  it("refreshes status", async () => {
    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.deviceId).not.toBe("");
    });

    mockGetQueue.mockResolvedValue([
      { id: "3", resource: "products", action: "delete", payload: {} },
    ]);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.queueSize).toBe(1);
    expect(mockGetQueue).toHaveBeenCalledTimes(2); // Once on mount, once on refresh
  });

  it("flushes sync queue", async () => {
    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.deviceId).not.toBe("");
    });

    expect(result.current.flushing).toBe(false);

    const flushPromise = act(async () => {
      await result.current.flushNow();
    });

    // flushing should be true during flush (but hard to test due to async)

    await flushPromise;

    expect(result.current.flushing).toBe(false);
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });
});
