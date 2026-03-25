import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "light",
    themeMode: "system",
    setThemeMode: vi.fn(),
    colors: {
      background: "#F8FAFC",
      text: "#1E293B",
      textSecondary: "#475569",
      textTertiary: "#94A3B8",
      primary: "#16A34A",
      border: "#E2E8F0",
      cardBackground: "#FFFFFF",
      waterFill: "#3B82F6",
      waterFillDeep: "#2563EB",
      waterFillBg: "#DBEAFE",
    },
  }),
}));

vi.mock("react-native-paper", () => {
  const React = require("react");
  return {
    ProgressBar: ({
      progress,
      testID,
    }: {
      progress: number;
      testID?: string;
    }) =>
      React.createElement("div", {
        "data-testid": testID ?? "progress-bar",
        "data-progress": progress,
      }),
  };
});

vi.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) =>
    React.createElement("ionicons-mock", props),
}));

import { WaterProgressCard } from "../WaterProgressCard";

describe("WaterProgressCard", () => {
  const defaultProps = {
    currentMl: 500,
    goalMl: 2000,
    onPress: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders current ml and goal ml text", () => {
    const { getByText } = render(<WaterProgressCard {...defaultProps} />);

    expect(getByText("500 / 2000 ml")).toBeTruthy();
  });

  it("renders a progress indicator", () => {
    const { getByTestId } = render(<WaterProgressCard {...defaultProps} />);

    expect(getByTestId("water-progress-bar")).toBeTruthy();
  });

  it("calls onPress callback when tapped", () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <WaterProgressCard {...defaultProps} onPress={onPress} />,
    );

    fireEvent.click(getByTestId("water-progress-card"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows "0 ml" when no water logged', () => {
    const { getByText } = render(
      <WaterProgressCard currentMl={0} goalMl={2000} onPress={vi.fn()} />,
    );

    expect(getByText("0 / 2000 ml")).toBeTruthy();
  });

  it("shows correct percentage", () => {
    const { getByText } = render(
      <WaterProgressCard currentMl={1000} goalMl={2000} onPress={vi.fn()} />,
    );

    expect(getByText("50%")).toBeTruthy();
  });

  it("caps percentage at 100%", () => {
    const { getByText } = render(
      <WaterProgressCard currentMl={3000} goalMl={2000} onPress={vi.fn()} />,
    );

    expect(getByText("100%")).toBeTruthy();
  });
});
