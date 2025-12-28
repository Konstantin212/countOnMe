import AsyncStorage from '@react-native-async-storage/async-storage';

import { Meal, Product } from '@models/types';
import { ThemeMode } from '@theme/ThemeContext';

const STORAGE_PREFIX = '@countOnMe';
const STORAGE_VERSION = 'v1';

const STORAGE_KEYS = {
  products: `${STORAGE_PREFIX}/products/${STORAGE_VERSION}`,
  meals: `${STORAGE_PREFIX}/meals/${STORAGE_VERSION}`,
  theme: `${STORAGE_PREFIX}/theme/${STORAGE_VERSION}`,
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

export const loadProducts = async (): Promise<Product[]> => {
  return loadCollection<Product>(STORAGE_KEYS.products);
};

export const saveProducts = async (products: Product[]): Promise<void> => {
  console.log('Saving products to storage, count:', products.length);
  await saveCollection<Product>(STORAGE_KEYS.products, products);
  console.log('Products saved successfully');
};

export const loadMeals = async (): Promise<Meal[]> => {
  return loadCollection<Meal>(STORAGE_KEYS.meals);
};

export const saveMeals = async (meals: Meal[]): Promise<void> => {
  await saveCollection<Meal>(STORAGE_KEYS.meals, meals);
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
