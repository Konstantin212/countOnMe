import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EfficiencyResult } from "@models/types";

vi.mock("@hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "light",
    themeMode: "system",
    setThemeMode: vi.fn(),
    colors: {
      cardBackgroundLight: "#F1F5F9",
      borderLight: "#CBD5E1",
      shadow: "#000000",
      text: "#1E293B",
      textSecondary: "#475569",
      primary: "#16A34A",
      efficiencyPositive: "#16A34A",
      efficiencyNegative: "#DC2626",
    },
  }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) =>
    React.createElement("ionicons-mock", props),
}));

import { EfficiencyWidget } from "../EfficiencyWidget";

describe("EfficiencyWidget", () => {
  it("renders empty state when efficiency is null", () => {
    const { getByText } = render(<EfficiencyWidget efficiency={null} />);
    expect(getByText("Track meals for 2 weeks to see efficiency")).toBeTruthy();
  });

  it("renders without crashing with valid data", () => {
    const efficiency: EfficiencyResult = {
      deviationPercent: 14,
      direction: "over",
      avgCaloriesThisWeek: 2300,
      avgCaloriesLastWeek: 2018,
    };
    const { getByTestId } = render(
      <EfficiencyWidget efficiency={efficiency} />,
    );
    expect(getByTestId("efficiency-widget")).toBeTruthy();
  });

  it("shows positive deviation with + sign for over", () => {
    const efficiency: EfficiencyResult = {
      deviationPercent: 14,
      direction: "over",
      avgCaloriesThisWeek: 2300,
      avgCaloriesLastWeek: 2018,
    };
    const { getByText } = render(<EfficiencyWidget efficiency={efficiency} />);
    expect(getByText("+14%")).toBeTruthy();
  });

  it("shows negative deviation with - sign for under", () => {
    const efficiency: EfficiencyResult = {
      deviationPercent: 8,
      direction: "under",
      avgCaloriesThisWeek: 1850,
      avgCaloriesLastWeek: 2010,
    };
    const { getByText } = render(<EfficiencyWidget efficiency={efficiency} />);
    expect(getByText("-8%")).toBeTruthy();
  });

  it("shows 0% for on_target direction", () => {
    const efficiency: EfficiencyResult = {
      deviationPercent: 0,
      direction: "on_target",
      avgCaloriesThisWeek: 2000,
      avgCaloriesLastWeek: 2000,
    };
    const { getByText } = render(<EfficiencyWidget efficiency={efficiency} />);
    expect(getByText("0%")).toBeTruthy();
  });

  it("shows subtitle text", () => {
    const efficiency: EfficiencyResult = {
      deviationPercent: 5,
      direction: "over",
      avgCaloriesThisWeek: 2100,
      avgCaloriesLastWeek: 2000,
    };
    const { getByText } = render(<EfficiencyWidget efficiency={efficiency} />);
    expect(
      getByText("Metabolic rate deviation vs last week average."),
    ).toBeTruthy();
  });
});
