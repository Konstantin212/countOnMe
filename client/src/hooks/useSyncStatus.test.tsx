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
vi.mock("@services/syncEngine", () => ({
  getState: vi.fn(() => ({
    status: "idle",
    lastSyncAt: null,
    lastError: null,
    pendingCount: 0,
  })),
  subscribe: vi.fn(() => vi.fn()),
  sync: vi.fn(() => Promise.resolve()),
}));

import NetInfo from "@react-native-community/netinfo";
import * as config from "@services/api/config";
import * as syncEngine from "@services/syncEngine";
import * as device from "@storage/device";
import { useSyncStatus } from "./useSyncStatus";

const mockNetInfo = vi.mocked(NetInfo);
const mockGetApiBaseUrl = vi.mocked(config.getApiBaseUrl);
const mockGetOrCreateDeviceId = vi.mocked(device.getOrCreateDeviceId);
const mockGetDeviceToken = vi.mocked(device.getDeviceToken);
const mockSubscribe = vi.mocked(syncEngine.subscribe);
const mockGetState = vi.mocked(syncEngine.getState);
const mockSync = vi.mocked(syncEngine.sync);

describe("useSyncStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockGetApiBaseUrl.mockReturnValue("http://localhost:8000");
    mockGetOrCreateDeviceId.mockResolvedValue("device-123");
    mockGetDeviceToken.mockResolvedValue("token-abc");
    mockGetState.mockReturnValue({
      status: "idle",
      lastSyncAt: null,
      lastError: null,
      pendingCount: 0,
    });
    mockSubscribe.mockReturnValue(() => {});
    mockSync.mockResolvedValue();
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
    let netInfoListener: ((state: { isConnected: boolean }) => void) | null =
      null;
    mockNetInfo.addEventListener.mockImplementation((callback) => {
      netInfoListener = callback as (state: { isConnected: boolean }) => void;
      return () => {};
    });

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.deviceId).not.toBe("");
    });

    // Trigger connection change
    act(() => {
      netInfoListener?.({ isConnected: false });
    });

    expect(result.current.isOnline).toBe(false);

    act(() => {
      netInfoListener?.({ isConnected: true });
    });

    expect(result.current.isOnline).toBe(true);
  });

  it("returns pending count from sync engine", async () => {
    mockGetState.mockReturnValue({
      status: "idle",
      lastSyncAt: null,
      lastError: null,
      pendingCount: 5,
    });

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.queueSize).toBe(5);
  });

  it("returns last sync timestamp from sync engine", async () => {
    const timestamp = Date.now();
    mockGetState.mockReturnValue({
      status: "idle",
      lastSyncAt: timestamp,
      lastError: null,
      pendingCount: 0,
    });

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.lastSyncAt).toBe(timestamp);
  });

  it("returns last sync error from sync engine", async () => {
    mockGetState.mockReturnValue({
      status: "error",
      lastSyncAt: null,
      lastError: "Network timeout",
      pendingCount: 0,
    });

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.lastError).toBe("Network timeout");
  });

  it("subscribes to sync engine state changes", async () => {
    let syncListener: ((state: syncEngine.SyncState) => void) | null = null;
    mockSubscribe.mockImplementation((listener) => {
      syncListener = listener;
      return () => {};
    });

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.deviceId).not.toBe("");
    });

    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    // Simulate sync engine state change
    act(() => {
      syncListener?.({
        status: "pulling",
        lastSyncAt: null,
        lastError: null,
        pendingCount: 3,
      });
    });

    expect(result.current.flushing).toBe(true);
    expect(result.current.queueSize).toBe(3);
  });

  it("refreshes device info", async () => {
    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.deviceId).not.toBe("");
    });

    mockGetOrCreateDeviceId.mockResolvedValue("device-456");
    mockGetDeviceToken.mockResolvedValue(null);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.deviceId).toBe("device-456");
    expect(result.current.hasToken).toBe(false);
    expect(mockGetOrCreateDeviceId).toHaveBeenCalledTimes(2);
  });

  it("calls sync engine sync on flushNow", async () => {
    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.deviceId).not.toBe("");
    });

    await act(async () => {
      await result.current.flushNow();
    });

    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  it("reports flushing=true when sync engine is pulling", async () => {
    mockGetState.mockReturnValue({
      status: "pulling",
      lastSyncAt: null,
      lastError: null,
      pendingCount: 0,
    });

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.flushing).toBe(true);
  });

  it("reports flushing=true when sync engine is pushing", async () => {
    mockGetState.mockReturnValue({
      status: "pushing",
      lastSyncAt: null,
      lastError: null,
      pendingCount: 0,
    });

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.flushing).toBe(true);
  });

  it("reports flushing=false when sync engine is idle", async () => {
    mockGetState.mockReturnValue({
      status: "idle",
      lastSyncAt: null,
      lastError: null,
      pendingCount: 0,
    });

    const { result } = renderHook(() => useSyncStatus());

    expect(result.current.flushing).toBe(false);
  });
});
