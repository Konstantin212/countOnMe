import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React from "react";

// Mock React Native Appearance before other imports
vi.mock("react-native", () => ({
  Appearance: {
    getColorScheme: vi.fn(() => "light"),
    addChangeListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

// Mock storage functions used by ThemeProvider
vi.mock("../storage/storage", () => ({
  loadThemePreference: vi.fn(() => Promise.resolve(null)),
  saveThemePreference: vi.fn(() => Promise.resolve()),
  loadProducts: vi.fn(() => Promise.resolve([])),
  saveProducts: vi.fn(() => Promise.resolve()),
  loadMeals: vi.fn(() => Promise.resolve([])),
  saveMeals: vi.fn(() => Promise.resolve()),
}));

import { ThemeProvider } from "@theme/ThemeContext";
import { useTheme } from "./useTheme";

describe("useTheme", () => {
  it("returns theme context value when used inside ThemeProvider", async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current).toHaveProperty("theme");
    expect(result.current).toHaveProperty("themeMode");
    expect(result.current).toHaveProperty("colors");
    expect(result.current).toHaveProperty("setThemeMode");
    expect(typeof result.current.setThemeMode).toBe("function");
  });

  it("returns colors object with expected keys", async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    const { colors } = result.current;

    // Verify essential color keys exist
    expect(colors).toHaveProperty("background");
    expect(colors).toHaveProperty("text");
    expect(colors).toHaveProperty("primary");
    expect(colors).toHaveProperty("secondary");
  });

  it("throws error when used outside ThemeProvider", () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = () => {};

    expect(() => {
      renderHook(() => useTheme());
    }).toThrow("useTheme must be used within a ThemeProvider");

    console.error = originalError;
  });

  it("returns theme value that is either light or dark", async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(["light", "dark"]).toContain(result.current.theme);
  });
});
