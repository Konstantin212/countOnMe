import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

vi.mock("@services/api/sync", () => ({
  pullDeltas: vi.fn(),
  pushMutations: vi.fn(),
}));

vi.mock("@storage/repositories", () => ({
  productRepository: {
    upsert: vi.fn(() => Promise.resolve()),
    markDeleted: vi.fn(() => Promise.resolve()),
  },
  goalRepository: {
    upsert: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
  },
  bodyWeightRepository: {
    upsert: vi.fn(() => Promise.resolve()),
    markDeleted: vi.fn(() => Promise.resolve()),
  },
  waterLogRepository: {
    upsert: vi.fn(() => Promise.resolve()),
    markDeleted: vi.fn(() => Promise.resolve()),
  },
  outboxRepository: {
    loadAll: vi.fn(() => Promise.resolve([])),
    remove: vi.fn(() => Promise.resolve()),
    markFailed: vi.fn(() => Promise.resolve()),
    count: vi.fn(() => Promise.resolve(0)),
  },
  syncCursorRepository: {
    getCursor: vi.fn(() => Promise.resolve(0)),
    setCursor: vi.fn(() => Promise.resolve()),
  },
}));

import type { SyncPullResponse } from "@services/api/sync";
import * as syncApi from "@services/api/sync";
import * as repos from "@storage/repositories";
import {
  __resetForTesting,
  getState,
  pull,
  push,
  setDatabase,
  startPeriodicSync,
  stopPeriodicSync,
  subscribe,
  sync as fullSync,
} from "./syncEngine";

const mockPullDeltas = vi.mocked(syncApi.pullDeltas);
const mockPushMutations = vi.mocked(syncApi.pushMutations);
const mockOutboxLoadAll = vi.mocked(repos.outboxRepository.loadAll);
const mockOutboxRemove = vi.mocked(repos.outboxRepository.remove);
const mockOutboxMarkFailed = vi.mocked(repos.outboxRepository.markFailed);
const mockOutboxCount = vi.mocked(repos.outboxRepository.count);
const mockGetCursor = vi.mocked(repos.syncCursorRepository.getCursor);
const mockSetCursor = vi.mocked(repos.syncCursorRepository.setCursor);
const mockProductUpsert = vi.mocked(repos.productRepository.upsert);
const mockProductMarkDeleted = vi.mocked(repos.productRepository.markDeleted);
const mockBodyWeightUpsert = vi.mocked(repos.bodyWeightRepository.upsert);
const mockGoalUpsert = vi.mocked(repos.goalRepository.upsert);
const mockWaterLogUpsert = vi.mocked(repos.waterLogRepository.upsert);

const mockDb = {};

describe("syncEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetForTesting();

    // Set the database so sync engine can operate
    setDatabase(mockDb as any, "test-user");

    // Defaults
    mockPullDeltas.mockResolvedValue({
      items: [],
      nextVersion: null,
      hasMore: false,
    });
    mockPushMutations.mockResolvedValue({
      accepted: 0,
      rejected: 0,
      conflicts: [],
    });
    mockGetCursor.mockResolvedValue(0);
    mockOutboxLoadAll.mockResolvedValue([]);
    mockOutboxCount.mockResolvedValue(0);
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
    it("calls pullDeltas with sync cursor from repository", async () => {
      mockGetCursor.mockResolvedValueOnce(42);

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
              data: { name: "Chicken", calories_per_100g: 165 },
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
              data: { name: "Rice", calories_per_100g: 130 },
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
      expect(mockPullDeltas).toHaveBeenNthCalledWith(2, {
        sinceVersion: 1,
        limit: 500,
      });
      expect(mockSetCursor).toHaveBeenCalledWith(mockDb, "all", 2);
    });

    it("merges products via repository", async () => {
      mockPullDeltas.mockResolvedValueOnce({
        items: [
          {
            entityType: "product",
            id: "p1",
            data: { name: "Chicken", calories_per_100g: 165 },
            syncVersion: 1,
            updatedAt: "2026-01-01T00:00:00Z",
            deletedAt: null,
          },
        ],
        nextVersion: 1,
        hasMore: false,
      });

      await pull();

      expect(mockProductUpsert).toHaveBeenCalledTimes(1);
      expect(mockProductUpsert).toHaveBeenCalledWith(
        mockDb,
        "test-user",
        expect.objectContaining({ id: "p1", name: "Chicken" }),
      );
    });

    it("soft-deletes deleted products", async () => {
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

      expect(mockProductMarkDeleted).toHaveBeenCalledWith(mockDb, "p1");
    });

    it("merges body weights via repository", async () => {
      mockPullDeltas.mockResolvedValueOnce({
        items: [
          {
            entityType: "body_weight",
            id: "bw1",
            data: { day: "2026-01-15", weight_kg: 80 },
            syncVersion: 1,
            updatedAt: "2026-01-15T00:00:00Z",
            deletedAt: null,
          },
        ],
        nextVersion: 1,
        hasMore: false,
      });

      await pull();

      expect(mockBodyWeightUpsert).toHaveBeenCalledTimes(1);
    });

    it("merges goals via repository", async () => {
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

      expect(mockGoalUpsert).toHaveBeenCalledTimes(1);
    });

    it("merges water logs via repository", async () => {
      mockPullDeltas.mockResolvedValueOnce({
        items: [
          {
            entityType: "water_log",
            id: "wl1",
            data: { day: "2026-01-15", amount_ml: 250 },
            syncVersion: 1,
            updatedAt: "2026-01-15T08:00:00Z",
            deletedAt: null,
          },
        ],
        nextVersion: 1,
        hasMore: false,
      });

      await pull();

      expect(mockWaterLogUpsert).toHaveBeenCalledTimes(1);
    });

    it("updates sync cursor after successful pull", async () => {
      mockPullDeltas.mockResolvedValueOnce({
        items: [],
        nextVersion: 10,
        hasMore: false,
      });

      await pull();

      expect(mockSetCursor).toHaveBeenCalledWith(mockDb, "all", 10);
    });
  });

  describe("push", () => {
    it("does nothing when outbox is empty", async () => {
      await push();
      expect(mockPushMutations).not.toHaveBeenCalled();
    });

    it("pushes outbox entries to server", async () => {
      mockOutboxLoadAll.mockResolvedValueOnce([
        {
          id: "mut-1",
          entityType: "product",
          action: "upsert" as const,
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

    it("removes accepted entries from outbox", async () => {
      mockOutboxLoadAll.mockResolvedValueOnce([
        {
          id: "mut-1",
          entityType: "product",
          action: "upsert" as const,
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

      expect(mockOutboxRemove).toHaveBeenCalledWith(mockDb, ["mut-1"]);
    });

    it("marks entries as failed on push error", async () => {
      mockOutboxLoadAll.mockResolvedValueOnce([
        {
          id: "mut-1",
          entityType: "product",
          action: "upsert" as const,
          entityId: "p1",
          data: { name: "Chicken" },
          updatedAt: "2026-01-01T00:00:00Z",
          createdAt: Date.now(),
          attempts: 0,
        },
      ]);

      mockPushMutations.mockRejectedValueOnce(new Error("Network error"));

      await expect(push()).rejects.toThrow("Network error");

      expect(mockOutboxMarkFailed).toHaveBeenCalledWith(
        mockDb,
        "mut-1",
        "Network error",
      );
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

      mockOutboxLoadAll.mockResolvedValueOnce(entries);
      mockPushMutations.mockResolvedValue({
        accepted: 50,
        rejected: 0,
        conflicts: [],
      });

      await push();

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

      mockOutboxLoadAll.mockResolvedValueOnce([
        {
          id: "mut-1",
          entityType: "product",
          action: "upsert" as const,
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
      const sync2 = fullSync();

      deferred.resolve({ items: [], nextVersion: null, hasMore: false });
      await sync1;
      await sync2;

      expect(mockPullDeltas).toHaveBeenCalledTimes(1);
    });
  });

  describe("periodic sync", () => {
    it("starts and stops periodic timer", () => {
      vi.useFakeTimers();

      startPeriodicSync(1000);
      vi.advanceTimersByTime(1000);

      stopPeriodicSync();

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
