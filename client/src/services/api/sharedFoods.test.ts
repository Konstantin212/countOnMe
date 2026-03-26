import { beforeEach, describe, expect, it, vi } from "vitest";

import * as sharedFoodsApi from "./sharedFoods";

vi.mock("./http", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status?: number;
    constructor(msg: string, opts?: { status?: number }) {
      super(msg);
      this.status = opts?.status;
    }
  },
}));

const { apiFetch } = await import("./http");

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const mockPortionApiResponse = {
  id: "portion-1",
  shared_food_id: "food-1",
  label: "100g",
  base_amount: "100",
  base_unit: "g",
  gram_weight: "100",
  calories: "250.5",
  protein: "20.1",
  carbs: "30.2",
  fat: "10.3",
  is_default: true,
};

const mockPortionNullsApiResponse = {
  id: "portion-2",
  shared_food_id: "food-1",
  label: "1 serving",
  base_amount: 50,
  base_unit: "g",
  gram_weight: null,
  calories: 125,
  protein: null,
  carbs: null,
  fat: null,
  is_default: false,
};

const mockSharedFoodApiResponse = {
  id: "food-1",
  owner_user_id: "user-1",
  name: "chicken_breast",
  display_name: "Chicken Breast",
  description: "Grilled chicken breast",
  brand: "FarmFresh",
  barcode: "1234567890",
  category: "Protein",
  visibility: "public",
  moderation_status: "approved",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  portions: [mockPortionApiResponse, mockPortionNullsApiResponse],
};

const mockListItemApiResponse = {
  id: "food-1",
  owner_user_id: "user-1",
  name: "chicken_breast",
  display_name: "Chicken Breast",
  brand: "FarmFresh",
  barcode: "1234567890",
  category: "Protein",
  visibility: "public",
  moderation_status: "approved",
  default_portion: mockPortionApiResponse,
};

describe("sharedFoods API service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("transformPortion", () => {
    it("transforms string Decimal values to numbers", () => {
      const result = sharedFoodsApi.transformPortion(mockPortionApiResponse);

      expect(result).toEqual({
        id: "portion-1",
        sharedFoodId: "food-1",
        label: "100g",
        baseAmount: 100,
        baseUnit: "g",
        gramWeight: 100,
        calories: 250.5,
        protein: 20.1,
        carbs: 30.2,
        fat: 10.3,
        isDefault: true,
      });
    });

    it("handles null optional fields", () => {
      const result = sharedFoodsApi.transformPortion(
        mockPortionNullsApiResponse,
      );

      expect(result).toEqual({
        id: "portion-2",
        sharedFoodId: "food-1",
        label: "1 serving",
        baseAmount: 50,
        baseUnit: "g",
        gramWeight: null,
        calories: 125,
        protein: null,
        carbs: null,
        fat: null,
        isDefault: false,
      });
    });

    it("handles numeric values (not just strings)", () => {
      const raw = {
        ...mockPortionApiResponse,
        base_amount: 100,
        calories: 250,
      };
      const result = sharedFoodsApi.transformPortion(raw);
      expect(result.baseAmount).toBe(100);
      expect(result.calories).toBe(250);
    });
  });

  describe("searchSharedFoods", () => {
    it("passes query params and transforms response", async () => {
      vi.mocked(apiFetch).mockResolvedValue([mockListItemApiResponse]);

      const result = await sharedFoodsApi.searchSharedFoods("chicken", 20, 0);

      expect(apiFetch).toHaveBeenCalledWith("/v1/shared/foods/search", {
        query: { q: "chicken", limit: 20, offset: 0 },
      });
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe("Chicken Breast");
      expect(result[0].defaultPortion?.calories).toBe(250.5);
    });

    it("omits empty query param", async () => {
      vi.mocked(apiFetch).mockResolvedValue([]);

      await sharedFoodsApi.searchSharedFoods();

      expect(apiFetch).toHaveBeenCalledWith("/v1/shared/foods/search", {
        query: {},
      });
    });
  });

  describe("getSharedFood", () => {
    it("transforms full response with portions", async () => {
      vi.mocked(apiFetch).mockResolvedValue(mockSharedFoodApiResponse);

      const result = await sharedFoodsApi.getSharedFood("food-1");

      expect(apiFetch).toHaveBeenCalledWith("/v1/shared/foods/food-1");
      expect(result.displayName).toBe("Chicken Breast");
      expect(result.description).toBe("Grilled chicken breast");
      expect(result.portions).toHaveLength(2);
      expect(result.portions[0].calories).toBe(250.5);
      expect(result.portions[1].protein).toBeNull();
    });
  });

  describe("listMySharedFoods", () => {
    it("fetches user's shared foods with pagination", async () => {
      vi.mocked(apiFetch).mockResolvedValue([mockListItemApiResponse]);

      const result = await sharedFoodsApi.listMySharedFoods(50, 0);

      expect(apiFetch).toHaveBeenCalledWith("/v1/shared/foods/mine", {
        query: { limit: 50, offset: 0 },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("createSharedFood", () => {
    it("sends snake_case body and returns transformed response", async () => {
      vi.mocked(apiFetch).mockResolvedValue(mockSharedFoodApiResponse);

      const result = await sharedFoodsApi.createSharedFood({
        name: "chicken_breast",
        displayName: "Chicken Breast",
        description: "Grilled chicken breast",
        brand: "FarmFresh",
        category: "Protein",
      });

      expect(apiFetch).toHaveBeenCalledWith("/v1/shared/foods", {
        method: "POST",
        body: {
          name: "chicken_breast",
          display_name: "Chicken Breast",
          description: "Grilled chicken breast",
          brand: "FarmFresh",
          barcode: undefined,
          category: "Protein",
        },
      });
      expect(result.displayName).toBe("Chicken Breast");
    });
  });

  describe("publishSharedFood", () => {
    it("sends POST and returns transformed response", async () => {
      vi.mocked(apiFetch).mockResolvedValue(mockSharedFoodApiResponse);

      const result = await sharedFoodsApi.publishSharedFood("food-1");

      expect(apiFetch).toHaveBeenCalledWith("/v1/shared/foods/food-1/publish", {
        method: "POST",
      });
      expect(result.visibility).toBe("public");
    });
  });

  describe("unpublishSharedFood", () => {
    it("sends POST and returns transformed response", async () => {
      const unpublishedResponse = {
        ...mockSharedFoodApiResponse,
        visibility: "private",
      };
      vi.mocked(apiFetch).mockResolvedValue(unpublishedResponse);

      const result = await sharedFoodsApi.unpublishSharedFood("food-1");

      expect(apiFetch).toHaveBeenCalledWith(
        "/v1/shared/foods/food-1/unpublish",
        { method: "POST" },
      );
      expect(result.visibility).toBe("private");
    });
  });

  describe("addSharedFoodPortion", () => {
    it("sends snake_case body and returns transformed portion", async () => {
      vi.mocked(apiFetch).mockResolvedValue(mockPortionApiResponse);

      const result = await sharedFoodsApi.addSharedFoodPortion("food-1", {
        label: "100g",
        baseAmount: 100,
        baseUnit: "g",
        gramWeight: 100,
        calories: 250.5,
        protein: 20.1,
        carbs: 30.2,
        fat: 10.3,
        isDefault: true,
      });

      expect(apiFetch).toHaveBeenCalledWith(
        "/v1/shared/foods/food-1/portions",
        {
          method: "POST",
          body: {
            label: "100g",
            base_amount: 100,
            base_unit: "g",
            gram_weight: 100,
            calories: 250.5,
            protein: 20.1,
            carbs: 30.2,
            fat: 10.3,
            is_default: true,
          },
        },
      );
      expect(result.calories).toBe(250.5);
    });
  });

  describe("importSharedFood", () => {
    it("returns transformed import result", async () => {
      vi.mocked(apiFetch).mockResolvedValue({
        product_id: "prod-1",
        portion_count: 3,
      });

      const result = await sharedFoodsApi.importSharedFood("food-1");

      expect(apiFetch).toHaveBeenCalledWith("/v1/shared/foods/food-1/import", {
        method: "POST",
      });
      expect(result).toEqual({
        productId: "prod-1",
        portionCount: 3,
      });
    });
  });

  describe("deleteSharedFood", () => {
    it("sends DELETE request", async () => {
      vi.mocked(apiFetch).mockResolvedValue(undefined);

      await sharedFoodsApi.deleteSharedFood("food-1");

      expect(apiFetch).toHaveBeenCalledWith("/v1/shared/foods/food-1", {
        method: "DELETE",
      });
    });
  });
});
