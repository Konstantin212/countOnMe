import React from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock react-navigation hooks
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn();
const mockAddListener = vi.fn(() => vi.fn()); // returns unsubscribe fn
const mockGetParent = vi.fn();

vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    addListener: mockAddListener,
    getParent: mockGetParent,
  }),
  useIsFocused: vi.fn(() => true),
}));

// ---------------------------------------------------------------------------
// Mock react-native-safe-area-context
// ---------------------------------------------------------------------------
vi.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      React.createElement("div", { style }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// ---------------------------------------------------------------------------
// Mock react-native-paper — FAB.Group is the component under test
// ---------------------------------------------------------------------------
vi.mock("react-native-paper", () => {
  const React = require("react");

  /**
   * Minimal FAB.Group mock.
   * - Renders a main button that fires `onStateChange({ open: !open })` on press.
   * - When `open` is true, renders each action label as a pressable element.
   * - Respects the `visible` prop (renders nothing when false).
   */
  function FABGroup({
    open,
    visible,
    actions,
    onStateChange,
    testID,
  }: {
    open: boolean;
    visible: boolean;
    actions: Array<{ label: string; onPress: () => void }>;
    onStateChange: (state: { open: boolean }) => void;
    onPress?: () => void;
    testID?: string;
  }) {
    if (!visible) return null;
    return React.createElement(
      "div",
      { "data-testid": testID ?? "fab-group" },
      // Main FAB toggle button
      React.createElement(
        "button",
        {
          "data-testid": "fab-main-button",
          onClick: () => onStateChange({ open: !open }),
        },
        open ? "close" : "plus",
      ),
      // Action items — only rendered when open
      open &&
        actions.map((action: { label: string; onPress: () => void }) =>
          React.createElement(
            "button",
            {
              key: action.label,
              "data-testid": `fab-action-${action.label}`,
              onClick: action.onPress,
            },
            action.label,
          ),
        ),
    );
  }

  const FAB = () => null;
  FAB.Group = FABGroup;

  return {
    FAB,
    Portal: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "portal" }, children),
    ActivityIndicator: () => React.createElement("div", { "data-testid": "activity-indicator" }),
    ProgressBar: () => React.createElement("div", { "data-testid": "progress-bar" }),
  };
});

// ---------------------------------------------------------------------------
// Mock heavy hooks so the screen renders without real storage / API calls
// ---------------------------------------------------------------------------
vi.mock("@hooks/useGoal", () => ({
  useGoal: () => ({
    goal: null,
    loading: false,
    refresh: vi.fn(() => Promise.resolve()),
    calculateGoal: vi.fn(),
    saveCalculatedGoal: vi.fn(),
    saveManualGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn(),
    error: null,
  }),
}));

vi.mock("@hooks/useBodyWeight", () => ({
  useBodyWeight: () => ({
    weights: [],
    loading: false,
    refresh: vi.fn(() => Promise.resolve()),
  }),
}));

vi.mock("@hooks/useStatsRange", () => ({
  useStatsRange: () => ({
    dailyStats: [],
    period: "7d",
    setPeriod: vi.fn(),
    loading: false,
    refresh: vi.fn(() => Promise.resolve()),
  }),
}));

vi.mock("@hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "light",
    themeMode: "system",
    setThemeMode: vi.fn(),
    colors: {
      background: "#ffffff",
      text: "#000000",
      textSecondary: "#888888",
      textInverse: "#ffffff",
      primary: "#2563EB",
      secondary: "#D97706",
      cardBackground: "#f9fafb",
      cardBackgroundLight: "#f3f4f6",
      border: "#e5e7eb",
      borderLight: "#f3f4f6",
      shadow: "#000000",
      success: "#059669",
      warning: "#D97706",
      macroProtein: "#2563EB",
      macroCarb: "#D97706",
      macroFat: "#059669",
      buttonText: "#ffffff",
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mock child components that have their own heavy dependencies
// ---------------------------------------------------------------------------
vi.mock("@components/GoalProgressCard", () => ({
  GoalProgressCard: () => null,
}));
vi.mock("@components/WeightChart", () => ({
  WeightChart: () => null,
}));
vi.mock("@components/CalorieTrendBars", () => ({
  CalorieTrendBars: () => null,
}));
vi.mock("@components/MacroAdherenceCard", () => ({
  MacroAdherenceCard: () => null,
}));
vi.mock("@components/StreaksCard", () => ({
  StreaksCard: () => null,
}));

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
import { useIsFocused } from "@react-navigation/native";

/** Re-render helper that changes the isFocused return value */
function setIsFocused(focused: boolean) {
  vi.mocked(useIsFocused).mockReturnValue(focused);
}

// ---------------------------------------------------------------------------
// Import the component under test (after all mocks are set up)
// ---------------------------------------------------------------------------
import MyPathScreen from "./MyPathScreen";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("MyPathScreen — FAB.Group behaviour", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: screen is focused, parent nav supports addListener
    setIsFocused(true);
    const parentNav = { addListener: vi.fn(() => vi.fn()) };
    mockGetParent.mockReturnValue(parentNav);
    mockAddListener.mockReturnValue(vi.fn());
  });

  // -------------------------------------------------------------------------
  // 1. FAB renders closed by default
  // -------------------------------------------------------------------------
  it("renders the FAB.Group closed on first render (no action items visible)", () => {
    const { queryByTestId, queryByText } = render(<MyPathScreen />);

    // The group container itself should be present (visible = isFocused = true)
    expect(queryByTestId("fab-group")).not.toBeNull();

    // None of the action labels should be visible while the group is closed
    expect(queryByText("Add meal")).toBeNull();
    expect(queryByText("Add product")).toBeNull();
    expect(queryByText("Add water")).toBeNull();
    expect(queryByText("Scan food")).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 2. FAB opens on press
  // -------------------------------------------------------------------------
  it("opens the FAB group and shows 4 action items when the main button is pressed", async () => {
    const { getByTestId, getByText } = render(<MyPathScreen />);

    const mainButton = getByTestId("fab-main-button");

    await act(async () => {
      fireEvent.click(mainButton);
    });

    // All 4 actions should now be visible
    expect(getByText("Add meal")).not.toBeNull();
    expect(getByText("Add product")).not.toBeNull();
    expect(getByText("Add water")).not.toBeNull();
    expect(getByText("Scan food")).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // 3. All 4 action labels are present when the group is open
  // -------------------------------------------------------------------------
  it("renders exactly the 4 expected action labels when open", async () => {
    const { getByTestId, getByText } = render(<MyPathScreen />);

    await act(async () => {
      fireEvent.click(getByTestId("fab-main-button"));
    });

    expect(getByText("Add meal")).not.toBeNull();
    expect(getByText("Add product")).not.toBeNull();
    expect(getByText("Add water")).not.toBeNull();
    expect(getByText("Scan food")).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // 4. Backdrop Pressable closes the group
  // -------------------------------------------------------------------------
  it("closes the FAB group when the backdrop overlay is pressed", async () => {
    const { getByTestId, queryByText } = render(<MyPathScreen />);

    // Open the group first
    await act(async () => {
      fireEvent.click(getByTestId("fab-main-button"));
    });

    // Actions should be visible
    expect(queryByText("Add meal")).not.toBeNull();

    // Press the backdrop (rendered via accessibilityLabel="Close quick actions")
    const backdrop = getByTestId("backdrop-close");

    await act(async () => {
      fireEvent.click(backdrop);
    });

    // Actions should now be hidden again
    expect(queryByText("Add meal")).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 5. FAB.Group visibility is tied to isFocused
  // -------------------------------------------------------------------------
  it("hides the FAB.Group when the screen is not focused", () => {
    setIsFocused(false);

    const { queryByTestId } = render(<MyPathScreen />);

    // Our mock FAB.Group renders null when visible=false
    expect(queryByTestId("fab-group")).toBeNull();
  });

  it("shows the FAB.Group when the screen is focused", () => {
    setIsFocused(true);

    const { queryByTestId } = render(<MyPathScreen />);

    expect(queryByTestId("fab-group")).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // 6. "Add meal" action navigates to MyDayTab > AddMeal
  // -------------------------------------------------------------------------
  it("navigates to MyDayTab > AddMeal when 'Add meal' action is pressed", async () => {
    const mockParentNavigate = vi.fn();
    mockGetParent.mockReturnValue({
      navigate: mockParentNavigate,
      addListener: vi.fn(() => vi.fn()),
    });

    const { getByTestId } = render(<MyPathScreen />);

    // Open the FAB group
    await act(async () => {
      fireEvent.click(getByTestId("fab-main-button"));
    });

    // Tap the "Add meal" action
    await act(async () => {
      fireEvent.click(getByTestId("fab-action-Add meal"));
    });

    expect(mockGetParent).toHaveBeenCalled();
    expect(mockParentNavigate).toHaveBeenCalledWith("MyDayTab", {
      screen: "AddMeal",
    });
  });
});
