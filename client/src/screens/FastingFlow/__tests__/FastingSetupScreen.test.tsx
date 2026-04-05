import React from "react";
import { render, fireEvent, act } from "@testing-library/react";
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

const mockStartSession = vi.fn();

vi.mock("@hooks/useFasting", () => ({
  useFasting: () => ({
    sessions: [],
    activeSession: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
    startSession: mockStartSession,
    endSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
  }),
}));

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
    mockStartSession.mockResolvedValue({
      id: "session-123",
      technique: "16:8",
      fastingHours: 16,
      startedAt: new Date().toISOString(),
      targetEndAt: new Date(Date.now() + 16 * 3600000).toISOString(),
      endedAt: null,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
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

  it("calls startSession and navigates on start fast", async () => {
    const { getByTestId } = render(<FastingSetupScreen />);

    await act(async () => {
      fireEvent.click(getByTestId("start-fast-button"));
    });

    expect(mockStartSession).toHaveBeenCalledWith("16:8", 16);
    expect(mockNavigate).toHaveBeenCalledWith("FastingScreen", {
      sessionId: "session-123",
    });
  });

  it("navigates back when back button is pressed", () => {
    const { getByTestId } = render(<FastingSetupScreen />);
    fireEvent.click(getByTestId("back-button"));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("selects a different technique when pressed", async () => {
    const { getByTestId } = render(<FastingSetupScreen />);

    fireEvent.click(getByTestId("technique-18:6"));

    await act(async () => {
      fireEvent.click(getByTestId("start-fast-button"));
    });

    expect(mockStartSession).toHaveBeenCalledWith("18:6", 18);
  });
});
