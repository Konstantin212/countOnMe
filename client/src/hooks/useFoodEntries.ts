import { useCallback, useRef } from 'react';

import { MealItem, MealTypeKey, Product, Unit } from '@models/types';
import {
  createFoodEntry,
  deleteFoodEntry,
  FoodEntryCreateRequest,
  FoodEntryResponse,
  listFoodEntries,
} from '@services/api/foodEntries';
import {
  createPortion,
  listPortions,
  PortionResponse,
} from '@services/api/portions';
import {
  createProduct as apiCreateProduct,
  getProduct as apiGetProduct,
} from '@services/api/products';

export type UseFoodEntriesResult = {
  /**
   * Save a meal (multiple food items) to the backend.
   * Creates default portions if needed, then creates food entries.
   */
  saveMealToBackend: (
    mealType: MealTypeKey,
    items: MealItem[],
    products: Product[],
    day?: string,
  ) => Promise<FoodEntryResponse[]>;

  /**
   * Get all food entries for a specific day.
   */
  getEntriesForDay: (day: string) => Promise<FoodEntryResponse[]>;

  /**
   * Delete a food entry.
   */
  deleteEntry: (entryId: string) => Promise<void>;
};

/**
 * Get today's date in YYYY-MM-DD format.
 */
const getTodayDate = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Cache for product portion IDs to avoid repeated API calls.
 * Maps productId -> portionId
 */
const portionCache = new Map<string, string>();

/**
 * Cache for products that have been synced to backend.
 */
const productSyncedCache = new Set<string>();

/**
 * Ensure a product exists in the backend.
 * Creates it if it doesn't exist.
 */
const ensureProductInBackend = async (product: Product): Promise<void> => {
  // Check cache first
  if (productSyncedCache.has(product.id)) {
    return;
  }

  try {
    // Check if product exists in backend
    await apiGetProduct(product.id);
    productSyncedCache.add(product.id);
  } catch (err) {
    // Product doesn't exist, create it
    console.log('Product not found in backend, creating:', product.name);
    try {
      await apiCreateProduct({ id: product.id, name: product.name });
      productSyncedCache.add(product.id);
    } catch (createErr) {
      console.error('Failed to create product in backend:', createErr);
      throw new Error(`Cannot sync product ${product.name} to backend`);
    }
  }
};

/**
 * Get or create a default portion for a product.
 * The default portion is "100g" with the product's nutritional values.
 */
const getOrCreateDefaultPortion = async (
  productId: string,
  product: Product,
): Promise<string> => {
  // Check cache first
  const cached = portionCache.get(productId);
  if (cached) {
    return cached;
  }

  // Ensure product exists in backend first
  await ensureProductInBackend(product);

  try {
    // Try to get existing portions for this product
    const portions = await listPortions(productId);
    
    // Look for default portion or any "100g" portion
    const defaultPortion = portions.find((p) => p.is_default) 
      ?? portions.find((p) => p.label.toLowerCase().includes('100g'))
      ?? portions[0];

    if (defaultPortion) {
      portionCache.set(productId, defaultPortion.id);
      return defaultPortion.id;
    }
  } catch (err) {
    // No portions found, continue to create one
    console.log('No existing portions found for product:', productId);
  }

  // Create a default "100g" portion
  try {
    const baseAmount = product.portionSize ?? 100;
    const baseUnit = product.scaleUnit ?? 'g';
    
    const newPortion = await createPortion(productId, {
      label: `${baseAmount}${baseUnit}`,
      base_amount: baseAmount,
      base_unit: baseUnit,
      calories: product.caloriesPerBase ?? product.caloriesPer100g ?? 0,
      protein: product.proteinPerBase ?? product.proteinPer100g ?? null,
      carbs: product.carbsPerBase ?? product.carbsPer100g ?? null,
      fat: product.fatPerBase ?? product.fatPer100g ?? null,
      is_default: true,
    });

    portionCache.set(productId, newPortion.id);
    return newPortion.id;
  } catch (err) {
    console.error('Failed to create default portion:', err);
    throw new Error(`Cannot create portion for product ${product.name}`);
  }
};

/**
 * Hook to manage food entries with backend sync.
 */
export const useFoodEntries = (): UseFoodEntriesResult => {
  const savingRef = useRef(false);

  const saveMealToBackend = useCallback(
    async (
      mealType: MealTypeKey,
      items: MealItem[],
      products: Product[],
      day?: string,
    ): Promise<FoodEntryResponse[]> => {
      if (savingRef.current) {
        console.warn('Already saving, please wait...');
        return [];
      }

      if (items.length === 0) {
        return [];
      }

      savingRef.current = true;
      const createdEntries: FoodEntryResponse[] = [];
      const entryDay = day ?? getTodayDate();

      try {
        for (const item of items) {
          const product = products.find((p) => p.id === item.productId);
          if (!product) {
            console.warn('Product not found:', item.productId);
            continue;
          }

          // Get or create default portion for this product
          let portionId: string;
          try {
            portionId = await getOrCreateDefaultPortion(item.productId, product);
          } catch (err) {
            console.error('Failed to get/create portion:', err);
            continue;
          }

          // Create food entry
          const request: FoodEntryCreateRequest = {
            product_id: item.productId,
            portion_id: portionId,
            day: entryDay,
            meal_type: mealType === 'water' ? 'snacks' : mealType, // Map water to snacks
            amount: item.amount,
            unit: item.unit,
          };

          try {
            const entry = await createFoodEntry(request);
            createdEntries.push(entry);
          } catch (err) {
            console.error('Failed to create food entry:', err);
            // Continue with other items even if one fails
          }
        }

        return createdEntries;
      } finally {
        savingRef.current = false;
      }
    },
    [],
  );

  const getEntriesForDay = useCallback(async (day: string): Promise<FoodEntryResponse[]> => {
    try {
      return await listFoodEntries({ day });
    } catch (err) {
      console.error('Failed to fetch food entries:', err);
      return [];
    }
  }, []);

  const deleteEntry = useCallback(async (entryId: string): Promise<void> => {
    await deleteFoodEntry(entryId);
  }, []);

  return {
    saveMealToBackend,
    getEntriesForDay,
    deleteEntry,
  };
};

/**
 * Clear the caches (useful for testing or logout).
 */
export const clearFoodEntryCaches = (): void => {
  portionCache.clear();
  productSyncedCache.clear();
};
