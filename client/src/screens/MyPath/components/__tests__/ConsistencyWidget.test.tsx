import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConsistencyResult } from "@models/types";

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
      textTertiary: "#94A3B8",
      secondary: "#2563EB",
      warning: "#D97706",
      heatmapHit: "#16A34A",
      heatmapPartial: "#FCD34D",
      heatmapMiss: "#FCA5A5",
      heatmapEmpty: "#F1F5F9",
    },
  }),
}));

import { ConsistencyWidget } from "../ConsistencyWidget";

describe("ConsistencyWidget", () => {
  const mockConsistency: ConsistencyResult = {
    score: 94.2,
    avgIntake7d: 2142,
    weeks: [
      {
        weekStart: "2026-03-03",
        days: [
          { day: "2026-03-03", proteinHit: true, calorieHit: true },
          { day: "2026-03-04", proteinHit: true, calorieHit: false },
          { day: "2026-03-05", proteinHit: false, calorieHit: false },
          { day: "2026-03-06", proteinHit: true, calorieHit: true },
          { day: "2026-03-07", proteinHit: false, calorieHit: true },
          { day: "2026-03-08", proteinHit: true, calorieHit: true },
          { day: "2026-03-09", proteinHit: true, calorieHit: true },
        ],
      },
      {
        weekStart: "2026-03-10",
        days: [
          { day: "2026-03-10", proteinHit: true, calorieHit: true },
          { day: "2026-03-11", proteinHit: true, calorieHit: true },
          { day: "2026-03-12", proteinHit: false, calorieHit: true },
        ],
      },
    ],
  };

  it("renders empty state when consistency is null", () => {
    const { getByText } = render(<ConsistencyWidget consistency={null} />);
    expect(getByText("Track meals to see consistency patterns")).toBeTruthy();
  });

  it("renders without crashing with valid data", () => {
    const { getByTestId } = render(
      <ConsistencyWidget consistency={mockConsistency} />,
    );
    expect(getByTestId("consistency-widget")).toBeTruthy();
  });

  it("shows title", () => {
    const { getByText } = render(
      <ConsistencyWidget consistency={mockConsistency} />,
    );
    expect(getByText("Comparative Consistency")).toBeTruthy();
  });

  it("shows legend items", () => {
    const { getByText } = render(
      <ConsistencyWidget consistency={mockConsistency} />,
    );
    expect(getByText("Protein")).toBeTruthy();
    expect(getByText("Energy")).toBeTruthy();
  });

  it("shows week labels", () => {
    const { getByText } = render(
      <ConsistencyWidget consistency={mockConsistency} />,
    );
    expect(getByText("Week 1")).toBeTruthy();
    expect(getByText("Week 2")).toBeTruthy();
  });

  it("renders grid cells for each day", () => {
    const { getByTestId } = render(
      <ConsistencyWidget consistency={mockConsistency} />,
    );
    expect(getByTestId("consistency-cell-2026-03-03")).toBeTruthy();
    expect(getByTestId("consistency-cell-2026-03-12")).toBeTruthy();
  });

  it("shows compliance score", () => {
    const { getByText } = render(
      <ConsistencyWidget consistency={mockConsistency} />,
    );
    expect(getByText("94.2%")).toBeTruthy();
  });

  it("shows average intake", () => {
    const { getByText } = render(
      <ConsistencyWidget consistency={mockConsistency} />,
    );
    // toLocaleString may vary, check for the numeric part
    expect(getByText(/2,?142 kcal/)).toBeTruthy();
  });
});
