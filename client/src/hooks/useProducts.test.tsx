import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { Product } from "@models/types";
import { productRepository, outboxRepository } from "@storage/repositories";
import { useDatabaseContext } from "@storage/DatabaseProvider";
import { useProducts } from "./useProducts";

const mockDbContext = { db: {}, userId: "test-user" };
vi.mock("../storage/DatabaseProvider", () => ({
  useDatabaseContext: vi.fn(() => mockDbContext),
}));

vi.mock("../storage/repositories", () => ({
  productRepository: {
    findAll: vi.fn(() => Promise.resolve([])),
    upsert: vi.fn(() => Promise.resolve()),
    markDeleted: vi.fn(() => Promise.resolve()),
    findById: vi.fn(() => Promise.resolve(null)),
  },
  outboxRepository: {
    enqueue: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("../services/syncEngine", () => ({
  debouncedSync: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "uuid-mock"),
}));

const mockFindAll = vi.mocked(productRepository.findAll);
const mockUpsert = vi.mocked(productRepository.upsert);
const mockMarkDeleted = vi.mocked(productRepository.markDeleted);
const mockEnqueue = vi.mocked(outboxRepository.enqueue);

const sampleProduct: Product = {
  id: "product-1",
  name: "Chicken",
  caloriesPer100g: 165,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const setupHook = async (initialProducts: Product[] = []) => {
  mockFindAll.mockResolvedValue(initialProducts);

  const hook = renderHook(() => useProducts());

  await waitFor(() => {
    expect(hook.result.current.loading).toBe(false);
  });

  return hook;
};

describe("useProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindAll.mockResolvedValue([]);
    mockUpsert.mockResolvedValue();
    mockMarkDeleted.mockResolvedValue();
    mockEnqueue.mockResolvedValue();
  });

  it("loads products on mount", async () => {
    const { result } = await setupHook([sampleProduct]);

    expect(result.current.products).toEqual([sampleProduct]);
    expect(mockFindAll).toHaveBeenCalledTimes(1);
  });

  it("adds a product with sanitized values and persists", async () => {
    const { result } = await setupHook();

    await act(async () => {
      await result.current.addProduct({
        name: "  Banana ",
        caloriesPer100g: -10,
      });
    });

    expect(result.current.products).toHaveLength(1);
    expect(result.current.products[0]).toMatchObject({
      id: "uuid-mock",
      name: "Banana",
      caloriesPer100g: 0,
    });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("updates an existing product and clamps numbers", async () => {
    const { result } = await setupHook([sampleProduct]);

    await act(async () => {
      await result.current.updateProduct(sampleProduct.id, {
        name: "  Updated  ",
        caloriesPer100g: -5,
      });
    });

    expect(result.current.products[0]).toMatchObject({
      id: sampleProduct.id,
      name: "Updated",
      caloriesPer100g: 0,
    });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("deletes product by id and persists changes", async () => {
    const { result } = await setupHook([sampleProduct]);

    await act(async () => {
      await result.current.deleteProduct(sampleProduct.id);
    });

    expect(result.current.products).toHaveLength(0);
    expect(mockMarkDeleted).toHaveBeenCalledTimes(1);
  });

  it("ignores updates for missing product ids without persisting", async () => {
    const { result } = await setupHook([sampleProduct]);

    await act(async () => {
      await result.current.updateProduct("missing", { name: "Ghost" });
    });

    expect(result.current.products).toEqual([sampleProduct]);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("defaults source to 'user' when not provided", async () => {
    const { result } = await setupHook();

    await act(async () => {
      await result.current.addProduct({
        name: "Homemade Bread",
        caloriesPer100g: 250,
      });
    });

    expect(result.current.products[0].source).toBe("user");
  });

  it("preserves source: 'catalog' when explicitly provided", async () => {
    const { result } = await setupHook();

    await act(async () => {
      await result.current.addProduct({
        name: "Catalog Item",
        caloriesPer100g: 300,
        source: "catalog",
      });
    });

    expect(result.current.products[0].source).toBe("catalog");
  });

  it("addProduct with barcode stores it on the product", async () => {
    const { result } = await setupHook();

    await act(async () => {
      await result.current.addProduct({
        name: "Scanned Product",
        caloriesPer100g: 200,
        barcode: "1234567890123",
      });
    });

    expect(result.current.products).toHaveLength(1);
    expect(result.current.products[0].barcode).toBe("1234567890123");
  });

  it("addProduct with duplicate barcode updates existing product with new data", async () => {
    const existingProduct: Product = {
      ...sampleProduct,
      barcode: "1234567890123",
      caloriesPer100g: 100,
    };
    const { result } = await setupHook([existingProduct]);

    let returned: Product | undefined;
    await act(async () => {
      returned = await result.current.addProduct({
        name: "Updated Scan",
        caloriesPer100g: 999,
        barcode: "1234567890123",
      });
    });

    expect(result.current.products).toHaveLength(1);
    expect(returned?.id).toBe(existingProduct.id);
    expect(returned?.name).toBe("Updated Scan");
    expect(returned?.caloriesPer100g).toBe(999);
  });

  it("addProduct without barcode creates normally (no dedup)", async () => {
    const existingProduct: Product = {
      ...sampleProduct,
      barcode: "1234567890123",
    };
    const { result } = await setupHook([existingProduct]);

    await act(async () => {
      await result.current.addProduct({
        name: "No Barcode Product",
        caloriesPer100g: 100,
      });
    });

    expect(result.current.products).toHaveLength(2);
  });
});
