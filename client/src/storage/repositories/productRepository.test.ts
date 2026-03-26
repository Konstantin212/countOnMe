import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Product } from "@models/types";
import type { Database } from "../database";
import { productRepository } from "./productRepository";
import { makeProduct } from "../../test/helpers";

const createMockDb = (): Database => ({
  execAsync: vi.fn(),
  runAsync: vi.fn(async () => ({ lastInsertRowId: 0, changes: 0 })),
  getFirstAsync: vi.fn(async () => null),
  getAllAsync: vi.fn(async () => []),
  withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => await fn()),
});

const sampleRow = {
  id: "prod-1",
  user_id: "user-1",
  name: "Chicken",
  barcode: null,
  category: null,
  portion_size: 100,
  scale_type: "Solid",
  scale_unit: "g",
  allowed_units: '["kg","mg"]',
  calories_per_base: 165,
  protein_per_base: 31,
  carbs_per_base: 0,
  fat_per_base: 3.6,
  calories_per_100g: 165,
  protein_per_100g: 31,
  carbs_per_100g: 0,
  fat_per_100g: 3.6,
  source: "user",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  deleted_at: null,
  is_dirty: 0,
};

describe("productRepository", () => {
  let db: Database;

  beforeEach(() => {
    db = createMockDb();
  });

  describe("findAll", () => {
    it("returns products mapped from rows", async () => {
      (db.getAllAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        sampleRow,
      ]);

      const result = await productRepository.findAll(db, "user-1");

      expect(db.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("WHERE user_id = ?"),
        ["user-1"],
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("prod-1");
      expect(result[0].name).toBe("Chicken");
      expect(result[0].allowedUnits).toEqual(["kg", "mg"]);
      expect(result[0].caloriesPer100g).toBe(165);
    });

    it("returns empty array when no products", async () => {
      const result = await productRepository.findAll(db, "user-1");
      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("returns product when found", async () => {
      (db.getFirstAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        sampleRow,
      );

      const result = await productRepository.findById(db, "prod-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("prod-1");
    });

    it("returns null when not found", async () => {
      const result = await productRepository.findById(db, "nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("upsert", () => {
    it("calls runAsync with correct SQL and parameters", async () => {
      const product = makeProduct({
        allowedUnits: ["kg", "mg"],
        portionSize: 100,
        scaleType: "Solid",
        scaleUnit: "g",
      });

      await productRepository.upsert(db, "user-1", product);

      expect(db.runAsync).toHaveBeenCalledTimes(1);
      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("INSERT OR REPLACE INTO products");
      // First arg is product.id
      expect(call[1][0]).toBe(product.id);
      // Second arg is userId
      expect(call[1][1]).toBe("user-1");
    });
  });

  describe("markDeleted", () => {
    it("sets deleted_at and marks dirty", async () => {
      await productRepository.markDeleted(db, "prod-1");

      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("UPDATE products SET deleted_at");
      expect(call[0]).toContain("is_dirty = 1");
      expect(call[1][1]).toBe("prod-1");
    });
  });

  describe("findDirty", () => {
    it("returns only dirty products", async () => {
      (db.getAllAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { ...sampleRow, is_dirty: 1 },
      ]);

      const result = await productRepository.findDirty(db);

      expect(db.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("WHERE is_dirty = 1"),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("clearDirty", () => {
    it("clears dirty flag for given ids", async () => {
      await productRepository.clearDirty(db, ["p1", "p2"]);

      const call = (db.runAsync as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("UPDATE products SET is_dirty = 0");
      expect(call[0]).toContain("?, ?");
      expect(call[1]).toEqual(["p1", "p2"]);
    });

    it("does nothing when ids array is empty", async () => {
      await productRepository.clearDirty(db, []);
      expect(db.runAsync).not.toHaveBeenCalled();
    });
  });

  describe("deleteAll", () => {
    it("deletes all products for user", async () => {
      await productRepository.deleteAll(db, "user-1");

      expect(db.runAsync).toHaveBeenCalledWith(
        "DELETE FROM products WHERE user_id = ?",
        ["user-1"],
      );
    });
  });
});
