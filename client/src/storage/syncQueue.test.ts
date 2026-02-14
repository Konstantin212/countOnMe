import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enqueue,
  flush,
  getLastSyncAt,
  getLastSyncError,
  getQueue,
} from "./syncQueue";

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
    fetch: vi.fn(),
  },
}));

vi.mock("@services/api/goals", () => ({
  createCalculatedGoal: vi.fn(),
  createManualGoal: vi.fn(),
  deleteGoal: vi.fn(),
  updateGoal: vi.fn(),
}));

vi.mock("@services/api/products", () => ({
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  updateProduct: vi.fn(),
}));

const NetInfo = await import("@react-native-community/netinfo");
const productsApi = await import("@services/api/products");
const goalsApi = await import("@services/api/goals");

describe("syncQueue", () => {
  beforeEach(() => {
    storageStore.clear();
    vi.clearAllMocks();
    vi.mocked(NetInfo.default.fetch).mockResolvedValue({
      isConnected: true,
    } as any);
  });

  describe("enqueue", () => {
    it("adds operation to the queue", async () => {
      await enqueue({
        id: "op-1",
        resource: "products",
        action: "create",
        payload: { id: "p1", name: "Chicken" },
      });

      const queue = await getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({
        id: "op-1",
        resource: "products",
        action: "create",
        payload: { id: "p1", name: "Chicken" },
        attempts: 0,
      });
      expect(queue[0].createdAt).toBeGreaterThan(0);
    });

    it("appends multiple operations in order", async () => {
      await enqueue({
        id: "op-1",
        resource: "products",
        action: "create",
        payload: {},
      });
      await enqueue({
        id: "op-2",
        resource: "products",
        action: "update",
        payload: {},
      });

      const queue = await getQueue();
      expect(queue).toHaveLength(2);
      expect(queue[0].id).toBe("op-1");
      expect(queue[1].id).toBe("op-2");
    });
  });

  describe("getQueue", () => {
    it("returns empty array when no queue exists", async () => {
      const queue = await getQueue();
      expect(queue).toEqual([]);
    });

    it("returns operations from storage", async () => {
      await enqueue({
        id: "op-1",
        resource: "products",
        action: "create",
        payload: {},
      });
      const queue = await getQueue();
      expect(queue).toHaveLength(1);
    });
  });

  describe("getLastSyncAt / getLastSyncError", () => {
    it("returns null when no last sync", async () => {
      expect(await getLastSyncAt()).toBeNull();
      expect(await getLastSyncError()).toBeNull();
    });
  });

  describe("flush", () => {
    it("returns offline result when not connected", async () => {
      vi.mocked(NetInfo.default.fetch).mockResolvedValue({
        isConnected: false,
      } as any);
      await enqueue({
        id: "op-1",
        resource: "products",
        action: "create",
        payload: {},
      });

      const result = await flush();

      expect(result).toEqual({
        attempted: 0,
        succeeded: 0,
        remaining: 1,
        skipped: 0,
        offline: true,
      });
    });

    it("processes product create operation successfully", async () => {
      vi.mocked(productsApi.createProduct).mockResolvedValue({
        id: "p1",
        name: "Chicken",
        created_at: "",
        updated_at: "",
      });

      await enqueue({
        id: "op-1",
        resource: "products",
        action: "create",
        payload: { id: "p1", name: "Chicken" },
      });

      const result = await flush();

      expect(result).toEqual({
        attempted: 1,
        succeeded: 1,
        remaining: 0,
        skipped: 0,
        offline: false,
      });
      expect(productsApi.createProduct).toHaveBeenCalledWith({
        id: "p1",
        name: "Chicken",
      });
      expect(await getQueue()).toHaveLength(0);
    });

    it("processes product update operation successfully", async () => {
      vi.mocked(productsApi.updateProduct).mockResolvedValue({
        id: "p1",
        name: "Chicken Breast",
        created_at: "",
        updated_at: "",
      });

      await enqueue({
        id: "op-1",
        resource: "products",
        action: "update",
        payload: { id: "p1", name: "Chicken Breast" },
      });

      const result = await flush();

      expect(result.succeeded).toBe(1);
      expect(productsApi.updateProduct).toHaveBeenCalledWith("p1", {
        name: "Chicken Breast",
      });
    });

    it("processes product delete operation successfully", async () => {
      vi.mocked(productsApi.deleteProduct).mockResolvedValue(undefined);

      await enqueue({
        id: "op-1",
        resource: "products",
        action: "delete",
        payload: { id: "p1" },
      });

      const result = await flush();

      expect(result.succeeded).toBe(1);
      expect(productsApi.deleteProduct).toHaveBeenCalledWith("p1");
    });

    it("processes goal update operation successfully", async () => {
      vi.mocked(goalsApi.updateGoal).mockResolvedValue({
        id: "goal-1",
        goalType: "manual",
        dailyCaloriesKcal: 2000,
        proteinPercent: 30,
        carbsPercent: 40,
        fatPercent: 30,
        proteinGrams: 150,
        carbsGrams: 200,
        fatGrams: 67,
        waterMl: 2500,
        createdAt: "",
        updatedAt: "",
      });

      await enqueue({
        id: "op-1",
        resource: "goals",
        action: "update",
        payload: { id: "goal-1", dailyCaloriesKcal: 2000 },
      });

      const result = await flush();

      expect(result.succeeded).toBe(1);
      expect(goalsApi.updateGoal).toHaveBeenCalledWith("goal-1", {
        dailyCaloriesKcal: 2000,
      });
    });

    it("processes goal delete operation successfully", async () => {
      vi.mocked(goalsApi.deleteGoal).mockResolvedValue(undefined);

      await enqueue({
        id: "op-1",
        resource: "goals",
        action: "delete",
        payload: { id: "goal-1" },
      });

      const result = await flush();

      expect(result.succeeded).toBe(1);
      expect(goalsApi.deleteGoal).toHaveBeenCalledWith("goal-1");
    });

    it("retries failed operation with backoff", async () => {
      vi.mocked(productsApi.createProduct).mockRejectedValue(
        new Error("Network error"),
      );

      await enqueue({
        id: "op-1",
        resource: "products",
        action: "create",
        payload: { id: "p1", name: "Chicken" },
      });

      const result = await flush();

      expect(result).toEqual({
        attempted: 1,
        succeeded: 0,
        remaining: 1,
        skipped: 0,
        offline: false,
      });

      const queue = await getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].attempts).toBe(1);
      expect(queue[0].lastError).toBe("Network error");
      expect(queue[0].nextAttemptAt).toBeGreaterThan(Date.now());
    });

    it("skips operations with future nextAttemptAt", async () => {
      await enqueue({
        id: "op-1",
        resource: "products",
        action: "create",
        payload: { id: "p1", name: "Chicken" },
      });

      // Manually set nextAttemptAt to future
      const queue = await getQueue();
      queue[0].nextAttemptAt = Date.now() + 10000;
      storageStore.set("syncQueue:v1", JSON.stringify(queue));

      const result = await flush();

      expect(result).toEqual({
        attempted: 0,
        succeeded: 0,
        remaining: 1,
        skipped: 1,
        offline: false,
      });
    });

    it("updates lastSyncAt when all operations succeed", async () => {
      vi.mocked(productsApi.createProduct).mockResolvedValue({
        id: "p1",
        name: "Chicken",
        created_at: "",
        updated_at: "",
      });

      await enqueue({
        id: "op-1",
        resource: "products",
        action: "create",
        payload: { id: "p1", name: "Chicken" },
      });

      const beforeSync = Date.now();
      await flush();
      const afterSync = Date.now();

      const lastSyncAt = await getLastSyncAt();
      expect(lastSyncAt).toBeGreaterThanOrEqual(beforeSync);
      expect(lastSyncAt).toBeLessThanOrEqual(afterSync);
    });

    it("stores lastSyncError when operation fails", async () => {
      vi.mocked(productsApi.createProduct).mockRejectedValue(
        new Error("Server error"),
      );

      await enqueue({
        id: "op-1",
        resource: "products",
        action: "create",
        payload: { id: "p1", name: "Chicken" },
      });

      await flush();

      const lastError = await getLastSyncError();
      expect(lastError).toBe("Server error");
    });

    it("clears lastSyncError when all operations succeed", async () => {
      // Set an error first
      storageStore.set("syncQueue:lastError", "Previous error");

      vi.mocked(productsApi.createProduct).mockResolvedValue({
        id: "p1",
        name: "Chicken",
        created_at: "",
        updated_at: "",
      });

      await enqueue({
        id: "op-1",
        resource: "products",
        action: "create",
        payload: { id: "p1", name: "Chicken" },
      });

      await flush();

      const lastError = await getLastSyncError();
      expect(lastError).toBeNull();
    });
  });
});
