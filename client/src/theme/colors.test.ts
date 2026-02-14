import { describe, expect, it } from "vitest";

import { DarkTheme, LightTheme } from "./colors";

describe("colors", () => {
  it("LightTheme has all required color keys", () => {
    const requiredKeys = [
      "background",
      "primary",
      "secondary",
      "text",
      "border",
      "cardBackground",
      "success",
      "error",
      "warning",
      "info",
    ];

    requiredKeys.forEach((key) => {
      expect(LightTheme).toHaveProperty(key);
      expect(typeof LightTheme[key as keyof typeof LightTheme]).toBe("string");
    });
  });

  it("DarkTheme has all required color keys", () => {
    const requiredKeys = [
      "background",
      "primary",
      "secondary",
      "text",
      "border",
      "cardBackground",
      "success",
      "error",
      "warning",
      "info",
    ];

    requiredKeys.forEach((key) => {
      expect(DarkTheme).toHaveProperty(key);
      expect(typeof DarkTheme[key as keyof typeof DarkTheme]).toBe("string");
    });
  });

  it("LightTheme and DarkTheme have matching key sets", () => {
    const lightKeys = Object.keys(LightTheme).sort();
    const darkKeys = Object.keys(DarkTheme).sort();
    expect(lightKeys).toEqual(darkKeys);
  });
});
