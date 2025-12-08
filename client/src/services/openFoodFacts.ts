/**
 * Open Food Facts API Service
 * Documentation: https://openfoodfacts.github.io/api-documentation/
 */

const API_BASE_URL = 'https://world.openfoodfacts.org';

export type OpenFoodFactsProduct = {
  code: string; // Barcode
  product_name: string;
  brands?: string;
  quantity?: string;
  image_url?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    'proteins_100g'?: number;
    'carbohydrates_100g'?: number;
    'fat_100g'?: number;
  };
};

export type SearchResponse = {
  count: number;
  page: number;
  page_count: number;
  page_size: number;
  products: OpenFoodFactsProduct[];
};

/**
 * Search for products by name
 */
export const searchProducts = async (query: string, page = 1): Promise<SearchResponse> => {
  if (!query.trim()) {
    return {
      count: 0,
      page: 1,
      page_count: 0,
      page_size: 0,
      products: [],
    };
  }

  try {
    const url = `${API_BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(
      query,
    )}&page=${page}&page_size=20&json=1&fields=code,product_name,brands,quantity,image_url,nutriments`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data: SearchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Open Food Facts API error:', error);
    throw new Error('Failed to search products. Please check your internet connection.');
  }
};

/**
 * Get a specific product by barcode
 */
export const getProductByBarcode = async (
  barcode: string,
): Promise<OpenFoodFactsProduct | null> => {
  try {
    const url = `${API_BASE_URL}/api/v2/product/${barcode}.json`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.status === 1 && data.product) {
      return data.product as OpenFoodFactsProduct;
    }

    return null;
  } catch (error) {
    console.error('Open Food Facts API error:', error);
    return null;
  }
};

/**
 * Extract calories from Open Food Facts product
 */
export const extractCalories = (product: OpenFoodFactsProduct): number => {
  return product.nutriments?.['energy-kcal_100g'] ?? 0;
};

/**
 * Extract macros from Open Food Facts product
 */
export const extractMacros = (
  product: OpenFoodFactsProduct,
): {
  protein?: number;
  carbs?: number;
  fat?: number;
} => {
  return {
    protein: product.nutriments?.['proteins_100g'],
    carbs: product.nutriments?.['carbohydrates_100g'],
    fat: product.nutriments?.['fat_100g'],
  };
};

