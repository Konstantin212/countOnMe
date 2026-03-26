import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

import { Product, ScaleType, Unit } from "@models/types";
import { SCALE_UNITS } from "@services/constants/scaleConstants";
import { loadProducts, saveProducts } from "@storage/storage";
import { enqueueOutbox } from "@storage/outbox";
import { debouncedSync } from "@services/syncEngine";

export type NewProductInput = {
  name: string;
  barcode?: string;

  // New (AddMealFlow v2) fields
  category?: string;
  portionSize?: number;
  scaleType?: ScaleType;
  scaleUnit?: Unit;
  caloriesPerBase?: number;
  proteinPerBase?: number;
  carbsPerBase?: number;
  fatPerBase?: number;

  // Legacy fields (pre v2)
  caloriesPer100g: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  source?: "user" | "catalog";
};

export type UpdateProductInput = Partial<NewProductInput>;

export type UseProductsResult = {
  products: Product[];
  loading: boolean;
  refresh: () => Promise<void>;
  addProduct: (input: NewProductInput) => Promise<Product>;
  updateProduct: (
    id: string,
    patch: UpdateProductInput,
  ) => Promise<Product | null>;
  deleteProduct: (id: string) => Promise<boolean>;
};

const now = () => new Date().toISOString();

const sanitizeRequiredNumber = (value: number): number => {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return 0;
  }
  return Number(value);
};

const sanitizeOptionalNumber = (value?: number): number | undefined => {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return undefined;
  }
  return Number(value);
};

const normalizeName = (name: string): string => {
  const trimmed = name?.trim();
  return trimmed?.length ? trimmed : "Untitled product";
};

/** Build full outbox data for a product upsert. */
const buildProductOutboxData = (product: Product): Record<string, unknown> => ({
  name: product.name,
  barcode: product.barcode,
  category: product.category,
  portion_size: product.portionSize,
  scale_type: product.scaleType,
  scale_unit: product.scaleUnit,
  calories_per_base: product.caloriesPerBase,
  protein_per_base: product.proteinPerBase,
  carbs_per_base: product.carbsPerBase,
  fat_per_base: product.fatPerBase,
  calories_per_100g: product.caloriesPer100g,
  protein_per_100g: product.proteinPer100g,
  carbs_per_100g: product.carbsPer100g,
  fat_per_100g: product.fatPer100g,
  source: product.source,
  created_at: product.createdAt,
});

const deriveAllowedUnits = (
  scaleType?: ScaleType,
  scaleUnit?: Unit,
): Unit[] | undefined => {
  if (!scaleType || !scaleUnit) {
    return undefined;
  }

  const units = SCALE_UNITS[scaleType] as unknown as Unit[];
  return units.filter((u) => u !== scaleUnit);
};

const createProductRecord = (input: NewProductInput): Product => {
  const timestamp = now();
  return {
    id: uuid(),
    name: normalizeName(input.name),
    barcode: input.barcode?.trim() || undefined,
    category: input.category?.trim() || undefined,
    portionSize: input.portionSize,
    scaleType: input.scaleType,
    scaleUnit: input.scaleUnit,
    allowedUnits: deriveAllowedUnits(input.scaleType, input.scaleUnit),
    caloriesPerBase: input.caloriesPerBase,
    proteinPerBase: sanitizeOptionalNumber(input.proteinPerBase),
    carbsPerBase: sanitizeOptionalNumber(input.carbsPerBase),
    fatPerBase: sanitizeOptionalNumber(input.fatPerBase),

    caloriesPer100g: sanitizeRequiredNumber(input.caloriesPer100g),
    proteinPer100g: sanitizeOptionalNumber(input.proteinPer100g),
    carbsPer100g: sanitizeOptionalNumber(input.carbsPer100g),
    fatPer100g: sanitizeOptionalNumber(input.fatPer100g),
    source: input.source ?? "user",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const patchProductRecord = (
  product: Product,
  patch: UpdateProductInput,
): Product => {
  return {
    ...product,
    name: patch.name !== undefined ? normalizeName(patch.name) : product.name,
    category:
      patch.category !== undefined
        ? patch.category?.trim() || undefined
        : product.category,
    portionSize:
      patch.portionSize !== undefined ? patch.portionSize : product.portionSize,
    scaleType:
      patch.scaleType !== undefined ? patch.scaleType : product.scaleType,
    scaleUnit:
      patch.scaleUnit !== undefined ? patch.scaleUnit : product.scaleUnit,
    allowedUnits:
      patch.scaleType !== undefined || patch.scaleUnit !== undefined
        ? deriveAllowedUnits(
            (patch.scaleType ?? product.scaleType) as ScaleType | undefined,
            (patch.scaleUnit ?? product.scaleUnit) as Unit | undefined,
          )
        : product.allowedUnits,
    caloriesPerBase:
      patch.caloriesPerBase !== undefined
        ? patch.caloriesPerBase
        : product.caloriesPerBase,
    proteinPerBase:
      patch.proteinPerBase !== undefined
        ? sanitizeOptionalNumber(patch.proteinPerBase)
        : product.proteinPerBase,
    carbsPerBase:
      patch.carbsPerBase !== undefined
        ? sanitizeOptionalNumber(patch.carbsPerBase)
        : product.carbsPerBase,
    fatPerBase:
      patch.fatPerBase !== undefined
        ? sanitizeOptionalNumber(patch.fatPerBase)
        : product.fatPerBase,
    caloriesPer100g:
      patch.caloriesPer100g !== undefined
        ? sanitizeRequiredNumber(patch.caloriesPer100g)
        : product.caloriesPer100g,
    proteinPer100g:
      patch.proteinPer100g !== undefined
        ? sanitizeOptionalNumber(patch.proteinPer100g)
        : product.proteinPer100g,
    carbsPer100g:
      patch.carbsPer100g !== undefined
        ? sanitizeOptionalNumber(patch.carbsPer100g)
        : product.carbsPer100g,
    fatPer100g:
      patch.fatPer100g !== undefined
        ? sanitizeOptionalNumber(patch.fatPer100g)
        : product.fatPer100g,
    updatedAt: now(),
  };
};

export const useProducts = (): UseProductsResult => {
  const [products, setProducts] = useState<Product[]>([]);
  const productsRef = useRef<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applyChanges = useCallback(
    async (updater: (prev: Product[]) => Product[]) => {
      const prev = productsRef.current;
      const next = updater(prev);

      if (next === prev) {
        return prev;
      }

      productsRef.current = next;
      setProducts(next);

      try {
        await saveProducts(next);
      } catch (error) {
        console.error("Failed to save products", error);
        throw error;
      }

      return next;
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await loadProducts();
      if (isMountedRef.current) {
        productsRef.current = stored;
        setProducts(stored);
      }
    } catch (error) {
      console.error("Failed to load products", error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addProduct = useCallback(
    async (input: NewProductInput) => {
      const barcode = input.barcode?.trim();
      if (barcode) {
        const existing = productsRef.current.find((p) => p.barcode === barcode);
        if (existing) {
          // Update existing product with latest scanned data
          const updated = {
            ...existing,
            name: input.name,
            caloriesPer100g: input.caloriesPer100g,
            proteinPer100g: input.proteinPer100g,
            carbsPer100g: input.carbsPer100g,
            fatPer100g: input.fatPer100g,
            updatedAt: new Date().toISOString(),
          };
          await applyChanges((prev) =>
            prev.map((p) => (p.id === existing.id ? updated : p)),
          );
          return updated;
        }
      }

      const newProduct = createProductRecord(input);
      await applyChanges((prev) => [...prev, newProduct]);
      await enqueueOutbox({
        id: `product:${newProduct.id}`,
        entityType: "product",
        action: "upsert",
        entityId: newProduct.id,
        data: buildProductOutboxData(newProduct),
        updatedAt: newProduct.updatedAt,
      });
      debouncedSync();
      return newProduct;
    },
    [applyChanges],
  );

  const updateProduct = useCallback(
    async (id: string, patch: UpdateProductInput) => {
      await applyChanges((prev) => {
        let changed = false;
        const next = prev.map((product) => {
          if (product.id !== id) {
            return product;
          }
          changed = true;
          return patchProductRecord(product, patch);
        });

        return changed ? next : prev;
      });

      const updatedProduct =
        productsRef.current.find((p) => p.id === id) ?? null;
      if (updatedProduct) {
        await enqueueOutbox({
          id: `product:${updatedProduct.id}`,
          entityType: "product",
          action: "upsert",
          entityId: updatedProduct.id,
          data: buildProductOutboxData(updatedProduct),
          updatedAt: updatedProduct.updatedAt,
        });
        debouncedSync();
      }
      return updatedProduct;
    },
    [applyChanges],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      let removed = false;

      await applyChanges((prev) => {
        const next = prev.filter((product) => {
          if (product.id === id) {
            removed = true;
            return false;
          }
          return true;
        });

        return removed ? next : prev;
      });

      if (removed) {
        await enqueueOutbox({
          id: `product:${id}`,
          entityType: "product",
          action: "delete",
          entityId: id,
          data: null,
          updatedAt: now(),
        });
        debouncedSync();
      }
      return removed;
    },
    [applyChanges],
  );

  return {
    products,
    loading,
    refresh,
    addProduct,
    updateProduct,
    deleteProduct,
  };
};

export const __testing = {
  normalizeName,
  sanitizeRequiredNumber,
  sanitizeOptionalNumber,
  createProductRecord,
  patchProductRecord,
};
