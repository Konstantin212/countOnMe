import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BodyWeightEntry, StatsPeriod, WeightTrend } from "@models/types";

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
      primary: "#16A34A",
      success: "#16A34A",
      error: "#DC2626",
      buttonText: "#F8FAFC",
      chartLine: "#2563EB",
      border: "#E2E8F0",
    },
  }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) =>
    React.createElement("ionicons-mock", props),
}));

vi.mock("react-native-gifted-charts", () => ({
  LineChart: (props: Record<string, unknown>) =>
    React.createElement("line-chart-mock", { "data-testid": "line-chart" }),
}));

import { WeightMetricWidget } from "../WeightMetricWidget";

describe("WeightMetricWidget", () => {
  const mockWeights: BodyWeightEntry[] = [
    {
      id: "w1",
      day: "2026-03-01",
      weightKg: 75.0,
      createdAt: "2026-03-01T08:00:00Z",
      updatedAt: "2026-03-01T08:00:00Z",
    },
    {
      id: "w2",
      day: "2026-03-07",
      weightKg: 74.24,
      createdAt: "2026-03-07T08:00:00Z",
      updatedAt: "2026-03-07T08:00:00Z",
    },
  ];

  const mockTrend: WeightTrend = {
    direction: "down",
    changeKg: -0.76,
    changePercent: 1.2,
    dataPoints: [
      { day: "2026-03-01", weightKg: 75.0 },
      { day: "2026-03-07", weightKg: 74.24 },
    ],
  };

  const defaultProps = {
    weights: mockWeights,
    trend: mockTrend,
    period: "7d" as StatsPeriod,
    onPeriodChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no weights", () => {
    const emptyTrend: WeightTrend = {
      direction: "stable",
      changeKg: 0,
      changePercent: 0,
      dataPoints: [],
    };
    const { getByText } = render(
      <WeightMetricWidget
        weights={[]}
        trend={emptyTrend}
        period="7d"
        onPeriodChange={vi.fn()}
      />,
    );
    expect(getByText("Log your first weight to see trends")).toBeTruthy();
  });

  it("renders without crashing with valid data", () => {
    const { getByTestId } = render(<WeightMetricWidget {...defaultProps} />);
    expect(getByTestId("weight-metric-widget")).toBeTruthy();
  });

  it("shows latest weight value", () => {
    const { getByText } = render(<WeightMetricWidget {...defaultProps} />);
    expect(getByText("74.24 kg")).toBeTruthy();
  });

  it("shows trend percentage", () => {
    const { getByText } = render(<WeightMetricWidget {...defaultProps} />);
    expect(getByText("1.2%")).toBeTruthy();
  });

  it("renders period selector tabs", () => {
    const { getByText } = render(<WeightMetricWidget {...defaultProps} />);
    expect(getByText("1W")).toBeTruthy();
    expect(getByText("1M")).toBeTruthy();
    expect(getByText("3M")).toBeTruthy();
  });

  it("calls onPeriodChange when a tab is pressed", () => {
    const onPeriodChange = vi.fn();
    const { getByTestId } = render(
      <WeightMetricWidget {...defaultProps} onPeriodChange={onPeriodChange} />,
    );
    fireEvent.click(getByTestId("period-tab-30d"));
    expect(onPeriodChange).toHaveBeenCalledWith("30d");
  });

  it("renders a chart", () => {
    const { getByTestId } = render(<WeightMetricWidget {...defaultProps} />);
    expect(getByTestId("line-chart")).toBeTruthy();
  });
});
