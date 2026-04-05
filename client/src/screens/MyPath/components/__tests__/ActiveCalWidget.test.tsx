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
      warning: "#D97706",
    },
  }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) =>
    React.createElement("ionicons-mock", props),
}));

import { ActiveCalWidget } from "../ActiveCalWidget";

describe("ActiveCalWidget", () => {
  it("renders without crashing", () => {
    const { getByTestId } = render(<ActiveCalWidget />);
    expect(getByTestId("active-cal-widget")).toBeTruthy();
  });

  it("shows static placeholder value of 420", () => {
    const { getByText } = render(<ActiveCalWidget />);
    expect(getByText("420")).toBeTruthy();
  });

  it("shows ACTIVE CAL label", () => {
    const { getByText } = render(<ActiveCalWidget />);
    expect(getByText("Active Cal")).toBeTruthy();
  });
});
