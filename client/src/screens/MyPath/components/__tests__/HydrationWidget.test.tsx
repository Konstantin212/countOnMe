import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "light",
    themeMode: "system",
    setThemeMode: vi.fn(),
    colors: {
      cardBackground: "#FFFFFF",
      borderLight: "#CBD5E1",
      shadow: "#000000",
      text: "#1E293B",
      textSecondary: "#475569",
      waterFill: "#3B82F6",
    },
  }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) =>
    React.createElement("ionicons-mock", props),
}));

import { HydrationWidget } from "../HydrationWidget";

describe("HydrationWidget", () => {
  it("renders without crashing", () => {
    const { getByTestId } = render(
      <HydrationWidget todayTotal={1500} waterGoal={2000} />,
    );
    expect(getByTestId("hydration-widget")).toBeTruthy();
  });

  it("formats ml as liters", () => {
    const { getByText } = render(
      <HydrationWidget todayTotal={2400} waterGoal={3000} />,
    );
    expect(getByText("2.4L")).toBeTruthy();
  });

  it("shows 0.0L when no water logged", () => {
    const { getByText } = render(
      <HydrationWidget todayTotal={0} waterGoal={2000} />,
    );
    expect(getByText("0.0L")).toBeTruthy();
  });

  it("shows Hydration label", () => {
    const { getByText } = render(
      <HydrationWidget todayTotal={500} waterGoal={2000} />,
    );
    expect(getByText("Hydration")).toBeTruthy();
  });
});
