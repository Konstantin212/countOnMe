import { useCallback, useRef, useState } from "react";

import {
  CatalogBarcodeResponse,
  getCatalogProductByBarcode,
} from "@services/api/catalog";
import {
  extractCalories,
  extractMacros,
  getProductByBarcode,
} from "@services/openFoodFacts";

export type CatalogPortionData = {
  id: string;
  label: string;
  baseAmount: number;
  baseUnit: string;
  gramWeight: number | null;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  isDefault: boolean;
};

export type BarcodeLookupResult = {
  code: string;
  name: string;
  brands?: string;
  caloriesPer100g: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  source: "catalog" | "off";
  catalogProductId?: string;
  catalogPortions?: CatalogPortionData[];
};

export type BarcodeLookupStatus =
  | "idle"
  | "loading"
  | "found"
  | "not_found"
  | "error";

export type UseBarcodeLookupReturn = {
  lookup: (barcode: string) => Promise<void>;
  result: BarcodeLookupResult | null;
  status: BarcodeLookupStatus;
  error: string | null;
  reset: () => void;
};

const COOLDOWN_MS = 2000;

const normalizePer100g = (
  value: number | null,
  gramWeight: number | null,
): number => {
  if (value === null || gramWeight === null || gramWeight <= 0) {
    return 0;
  }
  return Math.round((value / gramWeight) * 100);
};

const catalogToResult = (
  barcode: string,
  product: CatalogBarcodeResponse,
): BarcodeLookupResult | null => {
  const portion = product.default_portion;
  if (!portion) {
    return null;
  }

  // catalog.ts already coerces Decimal strings to numbers via parseNumeric
  const catalogPortions: CatalogPortionData[] = product.portions.map((p) => ({
    id: p.id,
    label: p.label,
    baseAmount: p.base_amount,
    baseUnit: p.base_unit,
    gramWeight: p.gram_weight,
    calories: p.calories,
    protein: p.protein,
    carbs: p.carbs,
    fat: p.fat,
    isDefault: p.is_default,
  }));

  return {
    code: barcode,
    name: product.display_name,
    brands: product.brand ?? undefined,
    caloriesPer100g: normalizePer100g(portion.calories, portion.gram_weight),
    proteinPer100g: normalizePer100g(portion.protein, portion.gram_weight),
    carbsPer100g: normalizePer100g(portion.carbs, portion.gram_weight),
    fatPer100g: normalizePer100g(portion.fat, portion.gram_weight),
    source: "catalog",
    catalogProductId: product.id,
    catalogPortions,
  };
};

export const useBarcodeLookup = (): UseBarcodeLookupReturn => {
  const [result, setResult] = useState<BarcodeLookupResult | null>(null);
  const [status, setStatus] = useState<BarcodeLookupStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const isLoadingRef = useRef(false);
  const lastScanRef = useRef<{ barcode: string; timestamp: number } | null>(
    null,
  );

  const lookup = useCallback(async (barcode: string): Promise<void> => {
    if (isLoadingRef.current) {
      return;
    }

    const now = Date.now();
    const lastScan = lastScanRef.current;
    if (
      lastScan &&
      lastScan.barcode === barcode &&
      now - lastScan.timestamp < COOLDOWN_MS
    ) {
      return;
    }

    isLoadingRef.current = true;
    setStatus("loading");
    setResult(null);
    setError(null);

    try {
      // Try catalog API first
      const catalogProduct = await getCatalogProductByBarcode(barcode);

      if (catalogProduct) {
        const normalized = catalogToResult(barcode, catalogProduct);
        if (normalized) {
          setResult(normalized);
          setStatus("found");
          return;
        }
      }

      // Fallback to Open Food Facts
      const offProduct = await getProductByBarcode(barcode);

      if (offProduct) {
        const calories = extractCalories(offProduct);
        const macros = extractMacros(offProduct);

        setResult({
          code: barcode,
          name: offProduct.product_name,
          brands: offProduct.brands,
          caloriesPer100g: Math.round(calories),
          proteinPer100g: macros.protein,
          carbsPer100g: macros.carbs,
          fatPer100g: macros.fat,
          source: "off",
        });
        setStatus("found");
        return;
      }

      setStatus("not_found");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Barcode lookup failed";
      setError(message);
      setStatus("error");
    } finally {
      lastScanRef.current = { barcode, timestamp: Date.now() };
      isLoadingRef.current = false;
    }
  }, []);

  const reset = useCallback((): void => {
    setResult(null);
    setStatus("idle");
    setError(null);
    lastScanRef.current = null;
  }, []);

  return { lookup, result, status, error, reset };
};
