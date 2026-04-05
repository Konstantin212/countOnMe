import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

vi.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    SafeAreaView: ({
      children,
      style,
    }: {
      children: React.ReactNode;
      style?: unknown;
    }) => React.createElement("div", { style }, children),
  };
});

vi.mock("@hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "light",
    themeMode: "system",
    setThemeMode: vi.fn(),
    colors: {
      background: "#F8FAFC",
      text: "#1E293B",
      textSecondary: "#475569",
      textInverse: "#F8FAFC",
      primary: "#16A34A",
      border: "#E2E8F0",
      borderLight: "#CBD5E1",
      cardBackground: "#FFFFFF",
      inputBackground: "#F1F5F9",
      buttonText: "#F8FAFC",
      disabled: "#94a3b8",
      fastingAccent: "#8B5CF6",
      fastingBg: "#F5F3FF",
    },
  }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) =>
    React.createElement("ionicons-mock", props),
}));

import FastingSetupScreen from "../FastingSetupScreen";

describe("FastingSetupScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the title and technique options", () => {
    const { getByText } = render(<FastingSetupScreen />);
    expect(getByText("Choose Your Fast")).not.toBeNull();
    expect(getByText("16:8")).not.toBeNull();
    expect(getByText("18:6")).not.toBeNull();
    expect(getByText("20:4")).not.toBeNull();
    expect(getByText("Custom")).not.toBeNull();
  });

  it("renders the start fast button", () => {
    const { getByTestId } = render(<FastingSetupScreen />);
    expect(getByTestId("start-fast-button")).not.toBeNull();
  });

  it("renders technique descriptions", () => {
    const { getByText } = render(<FastingSetupScreen />);
    expect(getByText("16 hours fasting, 8 hours eating")).not.toBeNull();
    expect(getByText("18 hours fasting, 6 hours eating")).not.toBeNull();
    expect(getByText("20 hours fasting, 4 hours eating")).not.toBeNull();
  });

  it("renders badges on technique cards", () => {
    const { getByText } = render(<FastingSetupScreen />);
    expect(getByText("Popular")).not.toBeNull();
    expect(getByText("Intermediate")).not.toBeNull();
    expect(getByText("Advanced")).not.toBeNull();
  });

  it("navigates to FastingScreen with technique and hours on start fast", () => {
    const { getByTestId } = render(<FastingSetupScreen />);

    fireEvent.click(getByTestId("start-fast-button"));

    expect(mockNavigate).toHaveBeenCalledWith("FastingScreen", {
      technique: "16:8",
      fastingHours: 16,
    });
  });

  it("navigates back when back button is pressed", () => {
    const { getByTestId } = render(<FastingSetupScreen />);
    fireEvent.click(getByTestId("back-button"));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("navigates with correct technique and hours for 18:6", () => {
    const { getByTestId } = render(<FastingSetupScreen />);

    fireEvent.click(getByTestId("technique-18:6"));
    fireEvent.click(getByTestId("start-fast-button"));

    expect(mockNavigate).toHaveBeenCalledWith("FastingScreen", {
      technique: "18:6",
      fastingHours: 18,
    });
  });
});
