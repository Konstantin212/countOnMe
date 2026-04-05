import React from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGoBack = vi.fn();
const mockEndSession = vi.fn(() => Promise.resolve(null));
const mockStartSession = vi.fn();

let mockRouteParams: Record<string, unknown> = {
  sessionId: "session-active",
};

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
  pausedAt: null as string | null,
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
let mockLoading = false;

vi.mock("@hooks/useFasting", () => ({
  useFasting: () => ({
    sessions: mockSessions,
    activeSession: mockSessions.find((s) => s.endedAt === null) ?? null,
    loading: mockLoading,
    error: null,
    refresh: vi.fn(),
    startSession: mockStartSession,
    endSession: mockEndSession,
    pauseSession: vi.fn(() => Promise.resolve(null)),
    resumeSession: vi.fn(() => Promise.resolve(null)),
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
    mockLoading = false;
    mockRouteParams = { sessionId: "session-active" };
    mockStartSession.mockResolvedValue({
      ...mockActiveSession,
      id: "session-new",
    });
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

  it("calls endSession without navigating back when end fast is pressed", async () => {
    const { getByTestId } = render(<FastingScreen />);

    await act(async () => {
      fireEvent.click(getByTestId("end-fast-button"));
    });

    expect(mockEndSession).toHaveBeenCalledWith("session-active");
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it("shows error state when session is not found and no initialSession", () => {
    mockSessions = [];
    mockRouteParams = { sessionId: "session-unknown" };
    const { getByTestId } = render(<FastingScreen />);
    expect(getByTestId("session-not-found")).not.toBeNull();
  });

  it("uses initialSession as fallback when session not in hook state", () => {
    mockSessions = [];
    mockLoading = false;
    mockRouteParams = {
      sessionId: "session-active",
      initialSession: mockActiveSession,
    };
    const { getByTestId } = render(<FastingScreen />);
    expect(getByTestId("technique-badge").textContent).toBe("16:8");
  });

  it("shows loading spinner when session not found and still loading", () => {
    mockSessions = [];
    mockLoading = true;
    mockRouteParams = { sessionId: "session-unknown" };
    const { queryByTestId } = render(<FastingScreen />);
    expect(queryByTestId("session-not-found")).toBeNull();
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

  describe("pre-start flow (technique + fastingHours params)", () => {
    beforeEach(() => {
      mockSessions = [];
      mockRouteParams = { technique: "16:8", fastingHours: 16 };
    });

    it("shows pre-start view with technique badge and Start Fast button", () => {
      const { getByTestId, getByText } = render(<FastingScreen />);
      expect(getByTestId("pre-start-technique-badge").textContent).toBe("16:8");
      expect(getByText("Ready to Fast?")).not.toBeNull();
      expect(getByTestId("confirm-start-fast-button")).not.toBeNull();
    });

    it("calls startSession with technique and hours when Start Fast is pressed", async () => {
      const { getByTestId } = render(<FastingScreen />);

      await act(async () => {
        fireEvent.click(getByTestId("confirm-start-fast-button"));
      });

      expect(mockStartSession).toHaveBeenCalledWith("16:8", 16);
    });

    it("transitions to active timer view after startSession resolves", async () => {
      mockSessions = [{ ...mockActiveSession, id: "session-new" }];
      const { getByTestId, queryByTestId } = render(<FastingScreen />);

      await act(async () => {
        fireEvent.click(getByTestId("confirm-start-fast-button"));
      });

      expect(queryByTestId("confirm-start-fast-button")).toBeNull();
      expect(getByTestId("technique-badge")).not.toBeNull();
    });

    it("navigates back from pre-start view", () => {
      const { getByTestId } = render(<FastingScreen />);
      fireEvent.click(getByTestId("back-button"));
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });
});
