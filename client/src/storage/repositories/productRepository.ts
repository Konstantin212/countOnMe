import type { Product } from "@models/types";
import type { Database } from "../database";

// ---------------------------------------------------------------------------
// Row ↔ Product mapping
// ---------------------------------------------------------------------------

type ProductRow = {
  id: string;
  user_id: string;
  name: string;
  barcode: string | null;
  category: string | null;
  portion_size: number | null;
  scale_type: string | null;
  scale_unit: string | null;
  allowed_units: string | null;
  calories_per_base: number | null;
  protein_per_base: number | null;
  carbs_per_base: number | null;
  fat_per_base: number | null;
  calories_per_100g: number;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  source: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_dirty: number;
};

const rowToProduct = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  barcode: row.barcode ?? undefined,
  category: row.category ?? undefined,
  portionSize: row.portion_size ?? undefined,
  scaleType: (row.scale_type as Product["scaleType"]) ?? undefined,
  scaleUnit: (row.scale_unit as Product["scaleUnit"]) ?? undefined,
  allowedUnits: row.allowed_units ? JSON.parse(row.allowed_units) : undefined,
  caloriesPerBase: row.calories_per_base ?? undefined,
  proteinPerBase: row.protein_per_base ?? undefined,
  carbsPerBase: row.carbs_per_base ?? undefined,
  fatPerBase: row.fat_per_base ?? undefined,
  caloriesPer100g: row.calories_per_100g,
  proteinPer100g: row.protein_per_100g ?? undefined,
  carbsPer100g: row.carbs_per_100g ?? undefined,
  fatPer100g: row.fat_per_100g ?? undefined,
  source: (row.source as Product["source"]) ?? "user",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export const productRepository = {
  findAll: async (db: Database, userId: string): Promise<Product[]> => {
    const rows = await db.getAllAsync<ProductRow>(
      "SELECT * FROM products WHERE user_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE",
      [userId],
    );
    return rows.map(rowToProduct);
  },

  findById: async (db: Database, id: string): Promise<Product | null> => {
    const row = await db.getFirstAsync<ProductRow>(
      "SELECT * FROM products WHERE id = ? AND deleted_at IS NULL",
      [id],
    );
    return row ? rowToProduct(row) : null;
  },

  upsert: async (
    db: Database,
    userId: string,
    product: Product,
  ): Promise<void> => {
    await db.runAsync(
      `INSERT OR REPLACE INTO products (
        id, user_id, name, barcode, category,
        portion_size, scale_type, scale_unit, allowed_units,
        calories_per_base, protein_per_base, carbs_per_base, fat_per_base,
        calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
        source, created_at, updated_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        product.id,
        userId,
        product.name,
        product.barcode ?? null,
        product.category ?? null,
        product.portionSize ?? null,
        product.scaleType ?? null,
        product.scaleUnit ?? null,
        product.allowedUnits ? JSON.stringify(product.allowedUnits) : null,
        product.caloriesPerBase ?? null,
        product.proteinPerBase ?? null,
        product.carbsPerBase ?? null,
        product.fatPerBase ?? null,
        product.caloriesPer100g,
        product.proteinPer100g ?? null,
        product.carbsPer100g ?? null,
        product.fatPer100g ?? null,
        product.source ?? "user",
        product.createdAt,
        product.updatedAt,
      ],
    );
  },

  markDeleted: async (db: Database, id: string): Promise<void> => {
    await db.runAsync(
      "UPDATE products SET deleted_at = ?, is_dirty = 1 WHERE id = ?",
      [new Date().toISOString(), id],
    );
  },

  findDirty: async (db: Database): Promise<Product[]> => {
    const rows = await db.getAllAsync<ProductRow>(
      "SELECT * FROM products WHERE is_dirty = 1",
    );
    return rows.map(rowToProduct);
  },

  clearDirty: async (db: Database, ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(", ");
    await db.runAsync(
      `UPDATE products SET is_dirty = 0 WHERE id IN (${placeholders})`,
      ids,
    );
  },

  deleteAll: async (db: Database, userId: string): Promise<void> => {
    await db.runAsync("DELETE FROM products WHERE user_id = ?", [userId]);
  },
};
