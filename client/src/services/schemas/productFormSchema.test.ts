import { describe, it, expect } from "vitest";
import { productFormSchema } from "./productFormSchema";

describe("productFormSchema", () => {
  const validBaseData = {
    name: "Chicken Breast",
    category: "Protein",
    portionSize: 100,
    scaleType: "Solid" as const,
    scaleUnit: "g",
    calories: 165,
    includeNutrients: false,
  };

  describe("name validation", () => {
    it("accepts valid product name", () => {
      const result = productFormSchema.safeParse(validBaseData);
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        name: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Product name is required");
      }
    });

    it("rejects name longer than 50 characters", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        name: "A".repeat(51),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Product name must be 50 characters or less",
        );
      }
    });

    it("accepts name with exactly 50 characters", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        name: "A".repeat(50),
      });
      expect(result.success).toBe(true);
    });

    it("accepts name with spaces and special characters", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        name: "Chicken Breast (Grilled) - 100g",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("category validation", () => {
    it("accepts valid category", () => {
      const result = productFormSchema.safeParse(validBaseData);
      expect(result.success).toBe(true);
    });

    it("rejects empty category", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        category: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Category is required");
      }
    });

    it("rejects category longer than 50 characters", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        category: "A".repeat(51),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Category must be 50 characters or less",
        );
      }
    });

    it("accepts category with exactly 50 characters", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        category: "A".repeat(50),
      });
      expect(result.success).toBe(true);
    });
  });

  describe("portionSize validation", () => {
    it("accepts valid positive portion size", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        portionSize: 150,
      });
      expect(result.success).toBe(true);
    });

    it("accepts decimal portion size", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        portionSize: 75.5,
      });
      expect(result.success).toBe(true);
    });

    it("rejects zero portion size", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        portionSize: 0,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Portion size must be greater than 0",
        );
      }
    });

    it("rejects negative portion size", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        portionSize: -100,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Portion size must be greater than 0",
        );
      }
    });

    it("rejects string portion size", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        portionSize: "100",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Portion size must be a number",
        );
      }
    });
  });

  describe("scaleType validation", () => {
    it("accepts Solid scale type", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        scaleType: "Solid",
      });
      expect(result.success).toBe(true);
    });

    it("accepts Liquid scale type", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        scaleType: "Liquid",
      });
      expect(result.success).toBe(true);
    });

    it("accepts Dry scale type", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        scaleType: "Dry",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid scale type", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        scaleType: "Invalid",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Please select a scale type",
        );
      }
    });

    it("rejects empty scale type", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        scaleType: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("scaleUnit validation", () => {
    it("accepts valid scale unit", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        scaleUnit: "kg",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty scale unit", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        scaleUnit: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Please select a unit");
      }
    });
  });

  describe("calories validation", () => {
    it("accepts valid positive calories", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        calories: 200,
      });
      expect(result.success).toBe(true);
    });

    it("accepts zero calories", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        calories: 0,
      });
      expect(result.success).toBe(true);
    });

    it("accepts decimal calories", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        calories: 165.5,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative calories", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        calories: -100,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Calories cannot be negative",
        );
      }
    });

    it("rejects string calories", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        calories: "165",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Calories must be a number",
        );
      }
    });
  });

  describe("includeNutrients validation", () => {
    it("accepts false when nutrients not provided", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: false,
      });
      expect(result.success).toBe(true);
    });

    it("accepts true when all nutrients provided", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: true,
        fat: 3.6,
        carbs: 0,
        protein: 31,
      });
      expect(result.success).toBe(true);
    });

    it("rejects true when fat is missing", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: true,
        carbs: 0,
        protein: 31,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "All nutrient fields are required when nutrients are enabled",
        );
      }
    });

    it("rejects true when carbs is missing", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: true,
        fat: 3.6,
        protein: 31,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "All nutrient fields are required when nutrients are enabled",
        );
      }
    });

    it("rejects true when protein is missing", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: true,
        fat: 3.6,
        carbs: 0,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "All nutrient fields are required when nutrients are enabled",
        );
      }
    });

    it("rejects true when all nutrients are missing", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: true,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "All nutrient fields are required when nutrients are enabled",
        );
      }
    });
  });

  describe("nutrient field validation", () => {
    it("accepts valid fat value", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: true,
        fat: 10.5,
        carbs: 0,
        protein: 20,
      });
      expect(result.success).toBe(true);
    });

    it("accepts zero fat", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: true,
        fat: 0,
        carbs: 5,
        protein: 20,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative fat", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: true,
        fat: -1,
        carbs: 0,
        protein: 20,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative carbs", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: true,
        fat: 5,
        carbs: -10,
        protein: 20,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative protein", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: true,
        fat: 5,
        carbs: 10,
        protein: -20,
      });
      expect(result.success).toBe(false);
    });

    it("accepts decimal nutrient values", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: true,
        fat: 3.6,
        carbs: 0.5,
        protein: 31.2,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("optional nutrients when includeNutrients is false", () => {
    it("ignores nutrient values when includeNutrients is false", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: false,
        fat: 10,
        carbs: 5,
        protein: 20,
      });
      expect(result.success).toBe(true);
    });

    it("accepts missing nutrients when includeNutrients is false", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        includeNutrients: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("complete valid examples", () => {
    it("validates complete product without nutrients", () => {
      const data = {
        name: "White Rice",
        category: "Grains",
        portionSize: 100,
        scaleType: "Solid" as const,
        scaleUnit: "g",
        calories: 130,
        includeNutrients: false,
      };
      const result = productFormSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates complete product with nutrients", () => {
      const data = {
        name: "Chicken Breast",
        category: "Protein",
        portionSize: 100,
        scaleType: "Solid" as const,
        scaleUnit: "g",
        calories: 165,
        includeNutrients: true,
        fat: 3.6,
        carbs: 0,
        protein: 31,
      };
      const result = productFormSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });

    it("validates liquid product", () => {
      const data = {
        name: "Whole Milk",
        category: "Dairy",
        portionSize: 100,
        scaleType: "Liquid" as const,
        scaleUnit: "ml",
        calories: 61,
        includeNutrients: true,
        fat: 3.25,
        carbs: 4.8,
        protein: 3.15,
      };
      const result = productFormSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("validates dry product with volume units", () => {
      const data = {
        name: "All-Purpose Flour",
        category: "Baking",
        portionSize: 1,
        scaleType: "Dry" as const,
        scaleUnit: "cup",
        calories: 455,
        includeNutrients: true,
        fat: 1.2,
        carbs: 95.4,
        protein: 12.9,
      };
      const result = productFormSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("rejects when multiple fields are invalid", () => {
      const result = productFormSchema.safeParse({
        name: "",
        category: "",
        portionSize: 0,
        scaleType: "Invalid",
        scaleUnit: "",
        calories: -100,
        includeNutrients: true,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have multiple errors
        expect(result.error.issues.length).toBeGreaterThan(1);
      }
    });

    it("accepts very large portion sizes", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        portionSize: 10000,
      });
      expect(result.success).toBe(true);
    });

    it("accepts very large calorie values", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        calories: 9999,
      });
      expect(result.success).toBe(true);
    });

    it("accepts very small positive portion size", () => {
      const result = productFormSchema.safeParse({
        ...validBaseData,
        portionSize: 0.001,
      });
      expect(result.success).toBe(true);
    });
  });
});
