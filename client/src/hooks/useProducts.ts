import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

import { Product, ScaleType, Unit } from "@models/types";
import { SCALE_UNITS } from "@services/constants/scaleConstants";
import { useDatabaseContext } from "@storage/DatabaseProvider";
import { productRepository, outboxRepository } from "@storage/repositories";
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
  const { db, userId } = useDatabaseContext();
  const [products, setProducts] = useState<Product[]>([]);
  const productsRef = useRef<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await productRepository.findAll(db, userId);
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
  }, [db, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addProduct = useCallback(
    async (input: NewProductInput) => {
      const barcode = input.barcode?.trim();
      if (barcode) {
        const existing = productsRef.current.find((p) => p.barcode === barcode);
        if (existing) {
          const updated = {
            ...existing,
            name: input.name,
            caloriesPer100g: input.caloriesPer100g,
            proteinPer100g: input.proteinPer100g,
            carbsPer100g: input.carbsPer100g,
            fatPer100g: input.fatPer100g,
            updatedAt: new Date().toISOString(),
          };
          await productRepository.upsert(db, userId, updated);
          productsRef.current = productsRef.current.map((p) =>
            p.id === existing.id ? updated : p,
          );
          setProducts(productsRef.current);
          return updated;
        }
      }

      const newProduct = createProductRecord(input);
      await productRepository.upsert(db, userId, newProduct);
      productsRef.current = [...productsRef.current, newProduct];
      setProducts(productsRef.current);

      await outboxRepository.enqueue(db, {
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
    [db, userId],
  );

  const updateProduct = useCallback(
    async (id: string, patch: UpdateProductInput) => {
      const existing = productsRef.current.find((p) => p.id === id);
      if (!existing) return null;

      const updated = patchProductRecord(existing, patch);
      await productRepository.upsert(db, userId, updated);
      productsRef.current = productsRef.current.map((p) =>
        p.id === id ? updated : p,
      );
      setProducts(productsRef.current);

      await outboxRepository.enqueue(db, {
        id: `product:${updated.id}`,
        entityType: "product",
        action: "upsert",
        entityId: updated.id,
        data: buildProductOutboxData(updated),
        updatedAt: updated.updatedAt,
      });
      debouncedSync();
      return updated;
    },
    [db, userId],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const exists = productsRef.current.some((p) => p.id === id);
      if (!exists) return false;

      await productRepository.markDeleted(db, id);
      productsRef.current = productsRef.current.filter((p) => p.id !== id);
      setProducts(productsRef.current);

      await outboxRepository.enqueue(db, {
        id: `product:${id}`,
        entityType: "product",
        action: "delete",
        entityId: id,
        data: null,
        updatedAt: now(),
      });
      debouncedSync();
      return true;
    },
    [db, userId],
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
