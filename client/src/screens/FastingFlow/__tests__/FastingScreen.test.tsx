import React from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGoBack = vi.fn();
const mockEndSession = vi.fn(() => Promise.resolve(null));

let mockRouteParams = { sessionId: "session-active" };

vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: mockRouteParams,
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

const now = new Date("2026-04-04T12:00:00Z");
const startedAt = new Date("2026-04-04T08:00:00Z"); // 4 hours ago
const targetEndAt = new Date("2026-04-05T00:00:00Z"); // 12 hours from now

const mockActiveSession = {
  id: "session-active",
  technique: "16:8" as const,
  fastingHours: 16,
  startedAt: startedAt.toISOString(),
  targetEndAt: targetEndAt.toISOString(),
  endedAt: null as string | null,
  completed: false,
  createdAt: startedAt.toISOString(),
  updatedAt: startedAt.toISOString(),
};

const mockEndedSession = {
  ...mockActiveSession,
  id: "session-ended",
  endedAt: targetEndAt.toISOString(),
  completed: true,
};

let mockSessions = [mockActiveSession];

vi.mock("@hooks/useFasting", () => ({
  useFasting: () => ({
    sessions: mockSessions,
    activeSession: mockSessions.find((s) => s.endedAt === null) ?? null,
    loading: false,
    error: null,
    refresh: vi.fn(),
    startSession: vi.fn(),
    endSession: mockEndSession,
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
      error: "#DC2626",
      success: "#16A34A",
      successLight: "#DCFCE7",
      warning: "#D97706",
      warningLight: "#FFEDD5",
      fastingAccent: "#8B5CF6",
      fastingBg: "#F5F3FF",
    },
  }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) =>
    React.createElement("ionicons-mock", props),
}));

import FastingScreen from "../FastingScreen";

describe("FastingScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(now);
    mockSessions = [mockActiveSession];
    mockRouteParams = { sessionId: "session-active" };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the active session with technique badge", () => {
    const { getByTestId } = render(<FastingScreen />);
    expect(getByTestId("technique-badge").textContent).toBe("16:8");
  });

  it("renders the timer display", () => {
    const { getByTestId } = render(<FastingScreen />);
    expect(getByTestId("timer-display")).not.toBeNull();
  });

  it("renders the end fast button", () => {
    const { getByTestId } = render(<FastingScreen />);
    expect(getByTestId("end-fast-button")).not.toBeNull();
  });

  it("shows progress percentage", () => {
    const { getByTestId } = render(<FastingScreen />);
    // 4 hours of 16 = 25%
    expect(getByTestId("progress-text").textContent).toBe("25% complete");
  });

  it("toggles timer mode when toggle button is pressed", () => {
    const { getByTestId, getByText } = render(<FastingScreen />);

    // Default is "Time Remaining"
    expect(getByText("Show Time Fasted")).not.toBeNull();

    fireEvent.click(getByTestId("toggle-timer-mode"));

    expect(getByText("Show Time Remaining")).not.toBeNull();
  });

  it("calls endSession and navigates back when end fast is pressed", async () => {
    const { getByTestId } = render(<FastingScreen />);

    await act(async () => {
      fireEvent.click(getByTestId("end-fast-button"));
    });

    expect(mockEndSession).toHaveBeenCalledWith("session-active");
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it("shows error state when session is not found", () => {
    mockSessions = [];
    const { getByTestId } = render(<FastingScreen />);
    expect(getByTestId("session-not-found")).not.toBeNull();
  });

  it("shows summary view for ended session", () => {
    mockSessions = [mockEndedSession];
    mockRouteParams = { sessionId: "session-ended" };

    const { getByTestId, getByText } = render(<FastingScreen />);
    expect(getByTestId("completion-badge").textContent).toBe("Completed");
    expect(getByText("Started")).not.toBeNull();
    expect(getByText("Ended")).not.toBeNull();
    expect(getByText("Duration")).not.toBeNull();
  });

  it("navigates back when back button is pressed", () => {
    const { getByTestId } = render(<FastingScreen />);
    fireEvent.click(getByTestId("back-button"));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
