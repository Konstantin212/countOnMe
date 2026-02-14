import { describe, expect, it } from "vitest";

import { MEAL_TYPE_KEYS, MEAL_TYPE_LABEL } from "./mealTypes";

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
});
