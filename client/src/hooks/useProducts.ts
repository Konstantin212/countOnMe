import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';

import { Product } from '../models/types';
import { loadProducts, saveProducts } from '../storage/storage';

export type NewProductInput = {
  name: string;
  caloriesPer100g: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
};

export type UpdateProductInput = Partial<NewProductInput>;

export type UseProductsResult = {
  products: Product[];
  loading: boolean;
  refresh: () => Promise<void>;
  addProduct: (input: NewProductInput) => Promise<Product>;
  updateProduct: (id: string, patch: UpdateProductInput) => Promise<Product | null>;
  deleteProduct: (id: string) => Promise<boolean>;
};

const now = () => new Date().toISOString();

const sanitizeRequiredNumber = (value: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return 0;
  }
  return Number(value);
};

const sanitizeOptionalNumber = (value?: number): number | undefined => {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return undefined;
  }
  return Number(value);
};

const normalizeName = (name: string): string => {
  const trimmed = name?.trim();
  return trimmed?.length ? trimmed : 'Untitled product';
};

const createProductRecord = (input: NewProductInput): Product => {
  const timestamp = now();
  return {
    id: uuid(),
    name: normalizeName(input.name),
    caloriesPer100g: sanitizeRequiredNumber(input.caloriesPer100g),
    proteinPer100g: sanitizeOptionalNumber(input.proteinPer100g),
    carbsPer100g: sanitizeOptionalNumber(input.carbsPer100g),
    fatPer100g: sanitizeOptionalNumber(input.fatPer100g),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const patchProductRecord = (product: Product, patch: UpdateProductInput): Product => {
  return {
    ...product,
    name: patch.name !== undefined ? normalizeName(patch.name) : product.name,
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

  const applyChanges = useCallback(async (updater: (prev: Product[]) => Product[]) => {
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
      console.error('Failed to save products', error);
      throw error;
    }

    return next;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await loadProducts();
      if (isMountedRef.current) {
        productsRef.current = stored;
        setProducts(stored);
      }
    } catch (error) {
      console.error('Failed to load products', error);
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
      const newProduct = createProductRecord(input);
      await applyChanges((prev) => [...prev, newProduct]);
      return newProduct;
    },
    [applyChanges],
  );

  const updateProduct = useCallback(
    async (id: string, patch: UpdateProductInput) => {
      let updatedProduct: Product | null = null;
      await applyChanges((prev) => {
        let changed = false;
        const next = prev.map((product) => {
          if (product.id !== id) {
            return product;
          }
          changed = true;
          updatedProduct = patchProductRecord(product, patch);
          return updatedProduct;
        });

        return changed ? next : prev;
      });

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
