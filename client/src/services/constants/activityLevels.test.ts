import { describe, expect, it } from "vitest";

import { ACTIVITY_LEVELS, getActivityLevelInfo } from "./activityLevels";

describe("activityLevels", () => {
  it("has 5 activity levels", () => {
    expect(ACTIVITY_LEVELS).toHaveLength(5);
  });

  it("each activity level has required properties", () => {
    ACTIVITY_LEVELS.forEach((level) => {
      expect(level).toHaveProperty("value");
      expect(level).toHaveProperty("label");
      expect(level).toHaveProperty("multiplier");
      expect(level).toHaveProperty("shortDescription");
      expect(level).toHaveProperty("detailedDescription");
      expect(level).toHaveProperty("examples");
      expect(level).toHaveProperty("icon");
      expect(Array.isArray(level.examples)).toBe(true);
    });
  });

  it("getActivityLevelInfo returns correct info for valid level", () => {
    const info = getActivityLevelInfo("moderate");
    expect(info).toBeDefined();
    expect(info?.value).toBe("moderate");
    expect(info?.multiplier).toBe(1.55);
  });

  it("getActivityLevelInfo returns undefined for invalid level", () => {
    const info = getActivityLevelInfo("invalid" as any);
    expect(info).toBeUndefined();
  });
});
