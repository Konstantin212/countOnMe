import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@services/api/catalog");
vi.mock("@services/openFoodFacts");

import * as catalogApi from "@services/api/catalog";
import * as offApi from "@services/openFoodFacts";
import { useBarcodeLookup } from "./useBarcodeLookup";

const mockGetCatalogProductByBarcode = vi.mocked(
  catalogApi.getCatalogProductByBarcode,
);
const mockGetProductByBarcode = vi.mocked(offApi.getProductByBarcode);
const mockExtractCalories = vi.mocked(offApi.extractCalories);
const mockExtractMacros = vi.mocked(offApi.extractMacros);

const makeCatalogResponse = (
  overrides?: Partial<catalogApi.CatalogBarcodeResponse>,
): catalogApi.CatalogBarcodeResponse => ({
  id: "cat-1",
  source: "usda",
  source_id: "usda-123",
  name: "Chicken Breast",
  display_name: "Chicken Breast, raw",
  brand: null,
  barcode: "1234567890123",
  category: "Poultry",
  default_portion: {
    id: "por-1",
    name: "100g",
    gram_weight: 100,
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    is_default: true,
    base_amount: 100,
    base_unit: "g",
  },
  portions: [],
  ...overrides,
});

const makeOffProduct = (): offApi.OpenFoodFactsProduct => ({
  code: "1234567890123",
  product_name: "Off Brand Chicken",
  brands: "Off Brand",
  nutriments: {
    "energy-kcal_100g": 120,
    proteins_100g: 25,
    carbohydrates_100g: 0,
    fat_100g: 2,
  },
});

describe("useBarcodeLookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with idle status", () => {
    const { result } = renderHook(() => useBarcodeLookup());

    expect(result.current.status).toBe("idle");
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("lookup calls catalog API first", async () => {
    const catalogProduct = makeCatalogResponse();
    mockGetCatalogProductByBarcode.mockResolvedValue(catalogProduct);

    const { result } = renderHook(() => useBarcodeLookup());

    await act(async () => {
      await result.current.lookup("1234567890123");
    });

    expect(mockGetCatalogProductByBarcode).toHaveBeenCalledWith(
      "1234567890123",
    );
    expect(result.current.status).toBe("found");
    expect(result.current.result).toMatchObject({
      code: "1234567890123",
      name: "Chicken Breast, raw",
      source: "catalog",
      caloriesPer100g: 165,
    });
    // OFF not called when catalog succeeds
    expect(mockGetProductByBarcode).not.toHaveBeenCalled();
  });

  it("lookup falls back to OFF when catalog returns null", async () => {
    mockGetCatalogProductByBarcode.mockResolvedValue(null);
    const offProduct = makeOffProduct();
    mockGetProductByBarcode.mockResolvedValue(offProduct);
    mockExtractCalories.mockReturnValue(120);
    mockExtractMacros.mockReturnValue({ protein: 25, carbs: 0, fat: 2 });

    const { result } = renderHook(() => useBarcodeLookup());

    await act(async () => {
      await result.current.lookup("1234567890123");
    });

    expect(result.current.status).toBe("found");
    expect(result.current.result).toMatchObject({
      name: "Off Brand Chicken",
      source: "off",
    });
  });

  it("lookup returns not_found when both return null", async () => {
    mockGetCatalogProductByBarcode.mockResolvedValue(null);
    mockGetProductByBarcode.mockResolvedValue(null);

    const { result } = renderHook(() => useBarcodeLookup());

    await act(async () => {
      await result.current.lookup("0000000000000");
    });

    expect(result.current.status).toBe("not_found");
    expect(result.current.result).toBeNull();
  });

  it("lookup sets error on network failure", async () => {
    mockGetCatalogProductByBarcode.mockRejectedValue(
      new Error("Network error"),
    );

    const { result } = renderHook(() => useBarcodeLookup());

    await act(async () => {
      await result.current.lookup("1234567890123");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Network error");
  });

  it("duplicate scan within cooldown is ignored", async () => {
    mockGetCatalogProductByBarcode.mockResolvedValue(makeCatalogResponse());

    const { result } = renderHook(() => useBarcodeLookup());

    await act(async () => {
      await result.current.lookup("1234567890123");
    });

    expect(mockGetCatalogProductByBarcode).toHaveBeenCalledTimes(1);

    // Same barcode within cooldown — ignored
    await act(async () => {
      await result.current.lookup("1234567890123");
    });

    expect(mockGetCatalogProductByBarcode).toHaveBeenCalledTimes(1);

    // Advance past cooldown
    act(() => {
      vi.advanceTimersByTime(2001);
    });

    await act(async () => {
      await result.current.lookup("1234567890123");
    });

    expect(mockGetCatalogProductByBarcode).toHaveBeenCalledTimes(2);
  });

  it("cooldown applies to not_found results too", async () => {
    mockGetCatalogProductByBarcode.mockResolvedValue(null);
    mockGetProductByBarcode.mockResolvedValue(null);

    const { result } = renderHook(() => useBarcodeLookup());

    await act(async () => {
      await result.current.lookup("0000000000000");
    });

    expect(result.current.status).toBe("not_found");
    expect(mockGetCatalogProductByBarcode).toHaveBeenCalledTimes(1);

    // Same barcode within cooldown — ignored
    await act(async () => {
      await result.current.lookup("0000000000000");
    });

    expect(mockGetCatalogProductByBarcode).toHaveBeenCalledTimes(1);
  });

  it("reset clears state back to idle", async () => {
    mockGetCatalogProductByBarcode.mockResolvedValue(makeCatalogResponse());

    const { result } = renderHook(() => useBarcodeLookup());

    await act(async () => {
      await result.current.lookup("1234567890123");
    });

    expect(result.current.status).toBe("found");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("catalog portion calories normalized to per-100g", async () => {
    const catalogProduct = makeCatalogResponse({
      default_portion: {
        id: "por-1",
        name: "200g serving",
        gram_weight: 200,
        calories: 400,
        protein: 60,
        carbs: 10,
        fat: 8,
        is_default: true,
        base_amount: 200,
        base_unit: "g",
      },
    });
    mockGetCatalogProductByBarcode.mockResolvedValue(catalogProduct);

    const { result } = renderHook(() => useBarcodeLookup());

    await act(async () => {
      await result.current.lookup("1234567890123");
    });

    expect(result.current.result).toMatchObject({
      caloriesPer100g: 200,
      proteinPer100g: 30,
      carbsPer100g: 5,
      fatPer100g: 4,
    });
  });

  it("different barcode within cooldown is not blocked", async () => {
    mockGetCatalogProductByBarcode.mockResolvedValue(makeCatalogResponse());

    const { result } = renderHook(() => useBarcodeLookup());

    await act(async () => {
      await result.current.lookup("1234567890123");
    });

    expect(mockGetCatalogProductByBarcode).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.lookup("9876543210987");
    });

    expect(mockGetCatalogProductByBarcode).toHaveBeenCalledTimes(2);
  });
});
