import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearOutbox,
  enqueueOutbox,
  getOutboxCount,
  loadOutbox,
  markFailed,
  removeFromOutbox,
} from "./outbox";

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

describe("outbox", () => {
  beforeEach(() => {
    storageStore.clear();
    vi.clearAllMocks();
  });

  describe("enqueueOutbox", () => {
    it("adds an entry to the outbox", async () => {
      await enqueueOutbox({
        id: "mut-1",
        entityType: "product",
        action: "upsert",
        entityId: "p1",
        data: { name: "Chicken" },
        updatedAt: "2026-01-01T00:00:00Z",
      });

      const entries = await loadOutbox();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        id: "mut-1",
        entityType: "product",
        action: "upsert",
        entityId: "p1",
        data: { name: "Chicken" },
        attempts: 0,
      });
      expect(entries[0].createdAt).toBeGreaterThan(0);
    });

    it("deduplicates by entityType + entityId", async () => {
      await enqueueOutbox({
        id: "mut-1",
        entityType: "product",
        action: "upsert",
        entityId: "p1",
        data: { name: "Chicken" },
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await enqueueOutbox({
        id: "mut-2",
        entityType: "product",
        action: "upsert",
        entityId: "p1",
        data: { name: "Chicken Breast" },
        updatedAt: "2026-01-01T01:00:00Z",
      });

      const entries = await loadOutbox();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("mut-2");
      expect(entries[0].data).toEqual({ name: "Chicken Breast" });
    });

    it("keeps entries for different entities", async () => {
      await enqueueOutbox({
        id: "mut-1",
        entityType: "product",
        action: "upsert",
        entityId: "p1",
        data: { name: "Chicken" },
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await enqueueOutbox({
        id: "mut-2",
        entityType: "product",
        action: "upsert",
        entityId: "p2",
        data: { name: "Rice" },
        updatedAt: "2026-01-01T00:00:00Z",
      });

      const entries = await loadOutbox();
      expect(entries).toHaveLength(2);
    });

    it("does not deduplicate across different entity types", async () => {
      await enqueueOutbox({
        id: "mut-1",
        entityType: "product",
        action: "upsert",
        entityId: "id-1",
        data: {},
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await enqueueOutbox({
        id: "mut-2",
        entityType: "body_weight",
        action: "upsert",
        entityId: "id-1",
        data: {},
        updatedAt: "2026-01-01T00:00:00Z",
      });

      const entries = await loadOutbox();
      expect(entries).toHaveLength(2);
    });
  });

  describe("loadOutbox", () => {
    it("returns empty array when outbox is empty", async () => {
      const entries = await loadOutbox();
      expect(entries).toEqual([]);
    });

    it("returns entries sorted by createdAt ascending", async () => {
      // Enqueue with slight delay difference
      await enqueueOutbox({
        id: "mut-1",
        entityType: "product",
        action: "upsert",
        entityId: "p1",
        data: {},
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await enqueueOutbox({
        id: "mut-2",
        entityType: "body_weight",
        action: "upsert",
        entityId: "bw1",
        data: {},
        updatedAt: "2026-01-01T00:00:00Z",
      });

      const entries = await loadOutbox();
      expect(entries).toHaveLength(2);
      expect(entries[0].createdAt).toBeLessThanOrEqual(entries[1].createdAt);
    });
  });

  describe("removeFromOutbox", () => {
    it("removes specified entries by id", async () => {
      await enqueueOutbox({
        id: "mut-1",
        entityType: "product",
        action: "upsert",
        entityId: "p1",
        data: {},
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await enqueueOutbox({
        id: "mut-2",
        entityType: "product",
        action: "upsert",
        entityId: "p2",
        data: {},
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await removeFromOutbox(["mut-1"]);

      const entries = await loadOutbox();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("mut-2");
    });

    it("handles removing non-existent ids gracefully", async () => {
      await enqueueOutbox({
        id: "mut-1",
        entityType: "product",
        action: "upsert",
        entityId: "p1",
        data: {},
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await removeFromOutbox(["non-existent"]);

      const entries = await loadOutbox();
      expect(entries).toHaveLength(1);
    });
  });

  describe("markFailed", () => {
    it("increments attempts and sets lastError", async () => {
      await enqueueOutbox({
        id: "mut-1",
        entityType: "product",
        action: "upsert",
        entityId: "p1",
        data: {},
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await markFailed("mut-1", "Network error");

      const entries = await loadOutbox();
      expect(entries[0].attempts).toBe(1);
      expect(entries[0].lastError).toBe("Network error");
    });

    it("increments attempts on repeated failures", async () => {
      await enqueueOutbox({
        id: "mut-1",
        entityType: "product",
        action: "upsert",
        entityId: "p1",
        data: {},
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await markFailed("mut-1", "Error 1");
      await markFailed("mut-1", "Error 2");

      const entries = await loadOutbox();
      expect(entries[0].attempts).toBe(2);
      expect(entries[0].lastError).toBe("Error 2");
    });
  });

  describe("clearOutbox", () => {
    it("removes all entries", async () => {
      await enqueueOutbox({
        id: "mut-1",
        entityType: "product",
        action: "upsert",
        entityId: "p1",
        data: {},
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await clearOutbox();

      const entries = await loadOutbox();
      expect(entries).toEqual([]);
    });
  });

  describe("getOutboxCount", () => {
    it("returns 0 when outbox is empty", async () => {
      const count = await getOutboxCount();
      expect(count).toBe(0);
    });

    it("returns correct count", async () => {
      await enqueueOutbox({
        id: "mut-1",
        entityType: "product",
        action: "upsert",
        entityId: "p1",
        data: {},
        updatedAt: "2026-01-01T00:00:00Z",
      });

      await enqueueOutbox({
        id: "mut-2",
        entityType: "body_weight",
        action: "upsert",
        entityId: "bw1",
        data: {},
        updatedAt: "2026-01-01T00:00:00Z",
      });

      const count = await getOutboxCount();
      expect(count).toBe(2);
    });
  });
});
