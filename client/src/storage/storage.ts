import AsyncStorage from '@react-native-async-storage/async-storage';

import { Meal, MealItem, Product } from '@models/types';
import { ThemeMode } from '@theme/ThemeContext';

const STORAGE_PREFIX = '@countOnMe';
const STORAGE_VERSION_V1 = 'v1';
const STORAGE_VERSION_V2 = 'v2';

const STORAGE_KEYS = {
  productsV1: `${STORAGE_PREFIX}/products/${STORAGE_VERSION_V1}`,
  mealsV1: `${STORAGE_PREFIX}/meals/${STORAGE_VERSION_V1}`,
  productsV2: `${STORAGE_PREFIX}/products/${STORAGE_VERSION_V2}`,
  mealsV2: `${STORAGE_PREFIX}/meals/${STORAGE_VERSION_V2}`,
  theme: `${STORAGE_PREFIX}/theme/${STORAGE_VERSION_V1}`,
  productFavourites: `${STORAGE_PREFIX}/products-favourites/${STORAGE_VERSION_V1}`,
  productRecents: `${STORAGE_PREFIX}/products-recents/${STORAGE_VERSION_V1}`,
} as const;

const parseCollection = <T>(rawValue: string | null): T[] => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const loadCollection = async <T>(key: string): Promise<T[]> => {
  try {
    const rawValue = await AsyncStorage.getItem(key);
    return parseCollection<T>(rawValue);
  } catch (error) {
    console.error(`Failed to load data for ${key}`, error);
    return [];
  }
};

const saveCollection = async <T>(key: string, data: T[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to save data for ${key}`, error);
    throw error;
  }
};

const migrateProductsV1ToV2 = (productsV1: Product[]): Product[] => {
  return productsV1.map((p) => {
    const scaleType = p.scaleType ?? 'Solid';
    const scaleUnit = p.scaleUnit ?? 'g';
    const portionSize = p.portionSize ?? 100;

    return {
      ...p,
      scaleType,
      scaleUnit,
      portionSize,
      allowedUnits: p.allowedUnits ?? (scaleType ? (scaleType === 'Solid'
        ? (scaleUnit === 'kg' ? ['g', 'mg'] : scaleUnit === 'g' ? ['kg', 'mg'] : ['kg', 'g'])
        : scaleType === 'Liquid'
          ? (scaleUnit === 'l' ? ['ml'] : ['l'])
          : (scaleUnit === 'cup' ? ['tbsp', 'tsp'] : scaleUnit === 'tbsp' ? ['cup', 'tsp'] : ['cup', 'tbsp'])) : undefined),
      caloriesPerBase: p.caloriesPerBase ?? p.caloriesPer100g,
      proteinPerBase: p.proteinPerBase ?? p.proteinPer100g,
      carbsPerBase: p.carbsPerBase ?? p.carbsPer100g,
      fatPerBase: p.fatPerBase ?? p.fatPer100g,
    };
  });
};

const migrateMealsV1ToV2 = (mealsV1: Meal[]): Meal[] => {
  return mealsV1.map((meal) => {
    const items = (meal.items as any[]).map((item) => {
      if (typeof item?.grams === 'number') {
        const migrated: MealItem = { productId: item.productId, amount: item.grams, unit: 'g' };
        return migrated;
      }
      if (typeof item?.amount === 'number' && typeof item?.unit === 'string') {
        return item as MealItem;
      }
      return null;
    }).filter(Boolean) as MealItem[];

    return { ...meal, items };
  });
};

export const loadProducts = async (): Promise<Product[]> => {
  const v2 = await loadCollection<Product>(STORAGE_KEYS.productsV2);
  if (v2.length > 0) {
    return v2;
  }

  const v1 = await loadCollection<Product>(STORAGE_KEYS.productsV1);
  if (v1.length === 0) {
    return [];
  }

  const migrated = migrateProductsV1ToV2(v1);
  // Best-effort: write migrated data to v2 for future loads.
  try {
    await saveCollection<Product>(STORAGE_KEYS.productsV2, migrated);
  } catch {
    // ignore
  }
  return migrated;
};

export const saveProducts = async (products: Product[]): Promise<void> => {
  console.log('Saving products to storage, count:', products.length);
  await saveCollection<Product>(STORAGE_KEYS.productsV2, products);
  console.log('Products saved successfully');
};

export const loadMeals = async (): Promise<Meal[]> => {
  const v2 = await loadCollection<Meal>(STORAGE_KEYS.mealsV2);
  if (v2.length > 0) {
    return v2;
  }

  const v1 = await loadCollection<Meal>(STORAGE_KEYS.mealsV1);
  if (v1.length === 0) {
    return [];
  }

  const migrated = migrateMealsV1ToV2(v1);
  try {
    await saveCollection<Meal>(STORAGE_KEYS.mealsV2, migrated);
  } catch {
    // ignore
  }
  return migrated;
};

export const saveMeals = async (meals: Meal[]): Promise<void> => {
  await saveCollection<Meal>(STORAGE_KEYS.mealsV2, meals);
};

export const loadProductFavourites = async (): Promise<string[]> => {
  return loadCollection<string>(STORAGE_KEYS.productFavourites);
};

export const saveProductFavourites = async (productIds: string[]): Promise<void> => {
  await saveCollection<string>(STORAGE_KEYS.productFavourites, productIds);
};

export const loadProductRecents = async (): Promise<string[]> => {
  return loadCollection<string>(STORAGE_KEYS.productRecents);
};

export const saveProductRecents = async (productIds: string[]): Promise<void> => {
  await saveCollection<string>(STORAGE_KEYS.productRecents, productIds);
};

export const loadThemePreference = async (): Promise<ThemeMode | null> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.theme);
    console.log('Loaded theme preference from storage:', value);
    if (value === 'light' || value === 'dark' || value === 'system') {
      return value;
    }
    console.log('No valid theme preference found, using system default');
    return null;
  } catch (error) {
    console.error('Failed to load theme preference', error);
    return null;
  }
};

export const saveThemePreference = async (mode: ThemeMode): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.theme, mode);
  } catch (error) {
    console.error('Failed to save theme preference', error);
    throw error;
  }
};
