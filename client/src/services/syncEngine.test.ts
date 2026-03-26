import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const storageStore = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storageStore.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storageStore.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageStore.delete(key);
    }),
  },
}));

vi.mock("@react-native-community/netinfo", () => ({
  default: {
    addEventListener: vi.fn(() => vi.fn()),
    fetch: vi.fn(() => Promise.resolve({ isConnected: true })),
  },
}));

vi.mock("@services/api/sync", () => ({
  pullDeltas: vi.fn(),
  pushMutations: vi.fn(),
}));

vi.mock("@storage/syncQueue", () => ({
  getQueue: vi.fn(async () => []),
}));

import type { SyncPullResponse } from "@services/api/sync";
import * as syncApi from "@services/api/sync";
import {
  __resetForTesting,
  getState,
  pull,
  push,
  startPeriodicSync,
  stopPeriodicSync,
  subscribe,
  sync as fullSync,
} from "./syncEngine";

const mockPullDeltas = vi.mocked(syncApi.pullDeltas);
const mockPushMutations = vi.mocked(syncApi.pushMutations);

// Helper to set up outbox data directly in storage
const setOutbox = async (entries: unknown[]): Promise<void> => {
  storageStore.set("@countOnMe/outbox/v1", JSON.stringify(entries));
};

describe("syncEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageStore.clear();
    __resetForTesting();

    // Default: pull returns nothing
    mockPullDeltas.mockResolvedValue({
      items: [],
      nextVersion: null,
      hasMore: false,
    });

    // Default: push returns all accepted
    mockPushMutations.mockResolvedValue({
      accepted: 0,
      rejected: 0,
      conflicts: [],
    });
  });

  describe("getState", () => {
    it("returns initial state", () => {
      const state = getState();
      expect(state).toEqual({
        status: "idle",
        lastSyncAt: null,
        lastError: null,
        pendingCount: 0,
      });
    });
  });

  describe("subscribe", () => {
    it("notifies listener on state changes", async () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      await pull();

      expect(listener).toHaveBeenCalled();
      const calls = listener.mock.calls;
      const statuses = calls.map(
        (c: unknown[]) => (c[0] as { status: string }).status,
      );
      expect(statuses).toContain("pulling");

      unsubscribe();
    });

    it("unsubscribes correctly", async () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);
      unsubscribe();

      await pull();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("pull", () => {
    it("calls pullDeltas with sync cursor from storage", async () => {
      // Set sync cursor
      storageStore.set("@countOnMe/sync-cursor/v1", "42");

      await pull();

      expect(mockPullDeltas).toHaveBeenCalledWith({
        sinceVersion: 42,
        limit: 500,
      });
    });

    it("uses 0 as default sync cursor", async () => {
      await pull();

      expect(mockPullDeltas).toHaveBeenCalledWith({
        sinceVersion: 0,
        limit: 500,
      });
    });

    it("handles pagination (multiple pages)", async () => {
      mockPullDeltas
        .mockResolvedValueOnce({
          items: [
            {
              entityType: "product",
              id: "p1",
              data: {
                name: "Chicken",
                calories_per_100g: 165,
              },
              syncVersion: 1,
              updatedAt: "2026-01-01T00:00:00Z",
              deletedAt: null,
            },
          ],
          nextVersion: 1,
          hasMore: true,
        })
        .mockResolvedValueOnce({
          items: [
            {
              entityType: "product",
              id: "p2",
              data: {
                name: "Rice",
                calories_per_100g: 130,
              },
              syncVersion: 2,
              updatedAt: "2026-01-01T00:00:00Z",
              deletedAt: null,
            },
          ],
          nextVersion: 2,
          hasMore: false,
        });

      await pull();

      expect(mockPullDeltas).toHaveBeenCalledTimes(2);
      // Second call should use the nextVersion from first response
      expect(mockPullDeltas).toHaveBeenNthCalledWith(2, {
        sinceVersion: 1,
        limit: 500,
      });

      // Sync cursor should be saved
      expect(storageStore.get("@countOnMe/sync-cursor/v1")).toBe("2");
    });

    it("merges products into local storage", async () => {
      mockPullDeltas.mockResolvedValueOnce({
        items: [
          {
            entityType: "product",
            id: "p1",
            data: {
              name: "Chicken",
              calories_per_100g: 165,
            },
            syncVersion: 1,
            updatedAt: "2026-01-01T00:00:00Z",
            deletedAt: null,
          },
        ],
        nextVersion: 1,
        hasMore: false,
      });

      await pull();

      // Products should be saved to storage
      const productsRaw = storageStore.get("@countOnMe/products/v2");
      expect(productsRaw).toBeDefined();
      const products = JSON.parse(productsRaw ?? "[]");
      expect(products).toHaveLength(1);
      expect(products[0].id).toBe("p1");
      expect(products[0].name).toBe("Chicken");
    });

    it("removes deleted products from local storage", async () => {
      // Pre-populate local storage with a product
      storageStore.set(
        "@countOnMe/products/v2",
        JSON.stringify([
          {
            id: "p1",
            name: "Chicken",
            caloriesPer100g: 165,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ]),
      );

      mockPullDeltas.mockResolvedValueOnce({
        items: [
          {
            entityType: "product",
            id: "p1",
            data: {},
            syncVersion: 2,
            updatedAt: "2026-01-02T00:00:00Z",
            deletedAt: "2026-01-02T00:00:00Z",
          },
        ],
        nextVersion: 2,
        hasMore: false,
      });

      await pull();

      const productsRaw = storageStore.get("@countOnMe/products/v2");
      const products = JSON.parse(productsRaw ?? "[]");
      expect(products).toHaveLength(0);
    });

    it("merges body weights into local storage", async () => {
      mockPullDeltas.mockResolvedValueOnce({
        items: [
          {
            entityType: "body_weight",
            id: "bw1",
            data: {
              day: "2026-01-15",
              weight_kg: 80,
            },
            syncVersion: 1,
            updatedAt: "2026-01-15T00:00:00Z",
            deletedAt: null,
          },
        ],
        nextVersion: 1,
        hasMore: false,
      });

      await pull();

      const weightsRaw = storageStore.get("@countOnMe/body-weights/v1");
      expect(weightsRaw).toBeDefined();
      const weights = JSON.parse(weightsRaw ?? "[]");
      expect(weights).toHaveLength(1);
      expect(weights[0].id).toBe("bw1");
      expect(weights[0].weightKg).toBe(80);
    });

    it("merges goals into local storage", async () => {
      mockPullDeltas.mockResolvedValueOnce({
        items: [
          {
            entityType: "user_goal",
            id: "g1",
            data: {
              goal_type: "manual",
              daily_calories_kcal: 2000,
              protein_percent: 30,
              carbs_percent: 40,
              fat_percent: 30,
              protein_grams: 150,
              carbs_grams: 200,
              fat_grams: 67,
              water_ml: 2000,
            },
            syncVersion: 1,
            updatedAt: "2026-01-01T00:00:00Z",
            deletedAt: null,
          },
        ],
        nextVersion: 1,
        hasMore: false,
      });

      await pull();

      const goalRaw = storageStore.get("@countOnMe/goal/v1");
      expect(goalRaw).toBeDefined();
      const goal = JSON.parse(goalRaw ?? "null");
      expect(goal.id).toBe("g1");
      expect(goal.dailyCaloriesKcal).toBe(2000);
    });

    it("merges water logs into local storage", async () => {
      mockPullDeltas.mockResolvedValueOnce({
        items: [
          {
            entityType: "water_log",
            id: "wl1",
            data: {
              day: "2026-01-15",
              amount_ml: 250,
            },
            syncVersion: 1,
            updatedAt: "2026-01-15T08:00:00Z",
            deletedAt: null,
          },
        ],
        nextVersion: 1,
        hasMore: false,
      });

      await pull();

      const logsRaw = storageStore.get("@countOnMe/water-logs/v1");
      expect(logsRaw).toBeDefined();
      const logs = JSON.parse(logsRaw ?? "[]");
      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe("wl1");
      expect(logs[0].amountMl).toBe(250);
    });

    it("updates sync cursor after successful pull", async () => {
      mockPullDeltas.mockResolvedValueOnce({
        items: [],
        nextVersion: 10,
        hasMore: false,
      });

      await pull();

      expect(storageStore.get("@countOnMe/sync-cursor/v1")).toBe("10");
    });
  });

  describe("push", () => {
    it("does nothing when outbox is empty", async () => {
      await push();

      expect(mockPushMutations).not.toHaveBeenCalled();
    });

    it("pushes outbox entries to server", async () => {
      await setOutbox([
        {
          id: "mut-1",
          entityType: "product",
          action: "upsert",
          entityId: "p1",
          data: { name: "Chicken" },
          updatedAt: "2026-01-01T00:00:00Z",
          createdAt: Date.now(),
          attempts: 0,
        },
      ]);

      mockPushMutations.mockResolvedValueOnce({
        accepted: 1,
        rejected: 0,
        conflicts: [],
      });

      await push();

      expect(mockPushMutations).toHaveBeenCalledTimes(1);
      expect(mockPushMutations).toHaveBeenCalledWith([
        {
          entityType: "product",
          action: "upsert",
          id: "p1",
          data: { name: "Chicken" },
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]);
    });

    it("clears accepted entries from outbox", async () => {
      await setOutbox([
        {
          id: "mut-1",
          entityType: "product",
          action: "upsert",
          entityId: "p1",
          data: { name: "Chicken" },
          updatedAt: "2026-01-01T00:00:00Z",
          createdAt: Date.now(),
          attempts: 0,
        },
      ]);

      mockPushMutations.mockResolvedValueOnce({
        accepted: 1,
        rejected: 0,
        conflicts: [],
      });

      await push();

      // Outbox should be empty now
      const outboxRaw = storageStore.get("@countOnMe/outbox/v1");
      const outbox = JSON.parse(outboxRaw ?? "[]");
      expect(outbox).toHaveLength(0);
    });

    it("marks entries as failed on push error", async () => {
      await setOutbox([
        {
          id: "mut-1",
          entityType: "product",
          action: "upsert",
          entityId: "p1",
          data: { name: "Chicken" },
          updatedAt: "2026-01-01T00:00:00Z",
          createdAt: Date.now(),
          attempts: 0,
        },
      ]);

      mockPushMutations.mockRejectedValueOnce(new Error("Network error"));

      await expect(push()).rejects.toThrow("Network error");

      // Entry should be marked as failed
      const outboxRaw = storageStore.get("@countOnMe/outbox/v1");
      const outbox = JSON.parse(outboxRaw ?? "[]");
      expect(outbox).toHaveLength(1);
      expect(outbox[0].attempts).toBe(1);
      expect(outbox[0].lastError).toBe("Network error");
    });

    it("pushes in batches of 50", async () => {
      const entries = Array.from({ length: 75 }, (_, i) => ({
        id: `mut-${i}`,
        entityType: "product",
        action: "upsert" as const,
        entityId: `p${i}`,
        data: { name: `Product ${i}` },
        updatedAt: "2026-01-01T00:00:00Z",
        createdAt: Date.now(),
        attempts: 0,
      }));

      await setOutbox(entries);

      mockPushMutations.mockResolvedValue({
        accepted: 50,
        rejected: 0,
        conflicts: [],
      });

      await push();

      // Should be called twice: 50 + 25
      expect(mockPushMutations).toHaveBeenCalledTimes(2);
      expect(mockPushMutations.mock.calls[0][0]).toHaveLength(50);
      expect(mockPushMutations.mock.calls[1][0]).toHaveLength(25);
    });
  });

  describe("sync (full)", () => {
    it("runs pull then push in order", async () => {
      const callOrder: string[] = [];

      mockPullDeltas.mockImplementation(async () => {
        callOrder.push("pull");
        return { items: [], nextVersion: null, hasMore: false };
      });

      // Add something to outbox so push runs
      await setOutbox([
        {
          id: "mut-1",
          entityType: "product",
          action: "upsert",
          entityId: "p1",
          data: { name: "Test" },
          updatedAt: "2026-01-01T00:00:00Z",
          createdAt: Date.now(),
          attempts: 0,
        },
      ]);

      mockPushMutations.mockImplementation(async () => {
        callOrder.push("push");
        return { accepted: 1, rejected: 0, conflicts: [] };
      });

      await fullSync();

      expect(callOrder).toEqual(["pull", "push"]);
    });

    it("updates state to idle with lastSyncAt on success", async () => {
      const before = Date.now();
      await fullSync();
      const after = Date.now();

      const state = getState();
      expect(state.status).toBe("idle");
      expect(state.lastSyncAt).toBeGreaterThanOrEqual(before);
      expect(state.lastSyncAt).toBeLessThanOrEqual(after);
      expect(state.lastError).toBeNull();
    });

    it("sets error state on failure", async () => {
      mockPullDeltas.mockRejectedValueOnce(new Error("Connection refused"));

      await fullSync();

      const state = getState();
      expect(state.status).toBe("error");
      expect(state.lastError).toBe("Connection refused");
    });

    it("prevents concurrent syncs", async () => {
      const deferred: {
        resolve: (value: SyncPullResponse) => void;
      } = { resolve: () => {} };
      const pullPromise = new Promise<SyncPullResponse>((resolve) => {
        deferred.resolve = resolve;
      });
      mockPullDeltas.mockReturnValueOnce(pullPromise);

      const sync1 = fullSync();
      const sync2 = fullSync(); // Should be no-op

      deferred.resolve({ items: [], nextVersion: null, hasMore: false });
      await sync1;
      await sync2;

      // pullDeltas should only be called once
      expect(mockPullDeltas).toHaveBeenCalledTimes(1);
    });
  });

  describe("periodic sync", () => {
    it("starts and stops periodic timer", () => {
      vi.useFakeTimers();

      startPeriodicSync(1000);

      // Advance timer but since sync is async, we just verify it doesn't throw
      vi.advanceTimersByTime(1000);

      stopPeriodicSync();

      // After stopping, no more calls should happen
      const pullCountBeforeStop = mockPullDeltas.mock.calls.length;
      vi.advanceTimersByTime(5000);
      expect(mockPullDeltas.mock.calls.length).toBe(pullCountBeforeStop);

      vi.useRealTimers();
    });

    it("stop is safe to call when not started", () => {
      expect(() => stopPeriodicSync()).not.toThrow();
    });
  });
});
