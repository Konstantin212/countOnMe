import { describe, expect, it } from "vitest";

import {
  FOOD_MEAL_TYPE_KEYS,
  MEAL_TYPE_KEYS,
  MEAL_TYPE_LABEL,
} from "./mealTypes";

describe("mealTypes", () => {
  it("MEAL_TYPE_KEYS has expected keys", () => {
    expect(MEAL_TYPE_KEYS).toContain("breakfast");
    expect(MEAL_TYPE_KEYS).toContain("lunch");
    expect(MEAL_TYPE_KEYS).toContain("dinner");
    expect(MEAL_TYPE_KEYS).toContain("snacks");
    expect(MEAL_TYPE_KEYS).toContain("water");
    expect(MEAL_TYPE_KEYS).toHaveLength(5);
  });

  it("MEAL_TYPE_LABEL maps all keys", () => {
    MEAL_TYPE_KEYS.forEach((key) => {
      expect(MEAL_TYPE_LABEL[key]).toBeDefined();
      expect(typeof MEAL_TYPE_LABEL[key]).toBe("string");
    });
  });

  it("FOOD_MEAL_TYPE_KEYS has 4 food-only keys and excludes water", () => {
    expect(FOOD_MEAL_TYPE_KEYS).toHaveLength(4);
    expect(FOOD_MEAL_TYPE_KEYS).toContain("breakfast");
    expect(FOOD_MEAL_TYPE_KEYS).toContain("lunch");
    expect(FOOD_MEAL_TYPE_KEYS).toContain("dinner");
    expect(FOOD_MEAL_TYPE_KEYS).toContain("snacks");
    expect(FOOD_MEAL_TYPE_KEYS).not.toContain("water");
  });
});
