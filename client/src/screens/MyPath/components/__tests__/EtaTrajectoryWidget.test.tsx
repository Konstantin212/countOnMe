import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EtaProjection, UserGoal } from "@models/types";

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
      textTertiary: "#94A3B8",
      primary: "#16A34A",
      buttonText: "#F8FAFC",
      border: "#E2E8F0",
      disabled: "#94a3b8",
    },
  }),
}));

import { EtaTrajectoryWidget } from "../EtaTrajectoryWidget";

describe("EtaTrajectoryWidget", () => {
  const mockGoal: UserGoal = {
    id: "goal-1",
    goalType: "calculated",
    targetWeightKg: 70,
    dailyCaloriesKcal: 2000,
    proteinPercent: 30,
    carbsPercent: 40,
    fatPercent: 30,
    proteinGrams: 150,
    carbsGrams: 200,
    fatGrams: 67,
    waterMl: 2500,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const mockEta: EtaProjection = {
    targetDate: "2026-10-02T00:00:00.000Z",
    daysRemaining: 180,
    progressPercent: 68,
    isOnTrack: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders no-goal state with setup button", () => {
    const onSetupGoal = vi.fn();
    const { getByText, getByTestId } = render(
      <EtaTrajectoryWidget eta={null} goal={null} onSetupGoal={onSetupGoal} />,
    );
    expect(getByText("Set a goal to see your ETA")).toBeTruthy();
    fireEvent.click(getByTestId("eta-setup-goal-button"));
    expect(onSetupGoal).toHaveBeenCalledTimes(1);
  });

  it("renders no-data state when goal exists but no eta", () => {
    const { getByText } = render(
      <EtaTrajectoryWidget eta={null} goal={mockGoal} />,
    );
    expect(getByText("Need more weight data")).toBeTruthy();
  });

  it("renders target date and goal weight", () => {
    const { getByText } = render(
      <EtaTrajectoryWidget eta={mockEta} goal={mockGoal} />,
    );
    expect(getByText("Hitting 70kg goal")).toBeTruthy();
  });

  it("renders progress percentage", () => {
    const { getByText } = render(
      <EtaTrajectoryWidget eta={mockEta} goal={mockGoal} />,
    );
    expect(getByText("68%")).toBeTruthy();
  });

  it("caps progress at 100%", () => {
    const overEta: EtaProjection = {
      ...mockEta,
      progressPercent: 120,
    };
    const { getByText } = render(
      <EtaTrajectoryWidget eta={overEta} goal={mockGoal} />,
    );
    expect(getByText("100%")).toBeTruthy();
  });

  it("renders widget container with testID", () => {
    const { getByTestId } = render(
      <EtaTrajectoryWidget eta={mockEta} goal={mockGoal} />,
    );
    expect(getByTestId("eta-trajectory-widget")).toBeTruthy();
  });
});
