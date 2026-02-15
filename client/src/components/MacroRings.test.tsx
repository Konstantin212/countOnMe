import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MacroRings, darkenHex } from "./MacroRings";

// Mock react-native-svg to map to regular HTML elements with testID → data-testid
// Note: react-native-svg is also aliased in vitest.config.ts to avoid Flow parse errors
vi.mock("react-native-svg", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require("react");
  return {
    __esModule: true,
    default: function MockSvg(props: Record<string, unknown>) {
      const { testID, children, ...rest } = props;
      return R.createElement(
        "svg",
        { ...rest, "data-testid": testID },
        children,
      );
    },
    Circle: function MockCircle(props: Record<string, unknown>) {
      const { testID, ...rest } = props;
      return R.createElement("circle", { ...rest, "data-testid": testID });
    },
  };
});

describe("MacroRings", () => {
  const mockData = [
    { label: "Protein", progress: 0.75, color: "#2563EB" },
    { label: "Carbs", progress: 0.5, color: "#D97706" },
    { label: "Fat", progress: 0.9, color: "#059669" },
  ];

  it("renders 3 rings when given 3 data items", () => {
    const { getByTestId } = render(<MacroRings data={mockData} />);

    // Each ring should have background and main arc
    expect(getByTestId("ring-0-bg")).toBeTruthy();
    expect(getByTestId("ring-0-main")).toBeTruthy();
    expect(getByTestId("ring-1-bg")).toBeTruthy();
    expect(getByTestId("ring-1-main")).toBeTruthy();
    expect(getByTestId("ring-2-bg")).toBeTruthy();
    expect(getByTestId("ring-2-main")).toBeTruthy();
  });

  it("renders background tracks for each ring with opacity 0.2", () => {
    const { getByTestId } = render(<MacroRings data={mockData} />);

    const bg0 = getByTestId("ring-0-bg");
    const bg1 = getByTestId("ring-1-bg");
    const bg2 = getByTestId("ring-2-bg");

    expect(bg0.getAttribute("opacity")).toBe("0.2");
    expect(bg1.getAttribute("opacity")).toBe("0.2");
    expect(bg2.getAttribute("opacity")).toBe("0.2");
  });

  it("does NOT render overflow arcs when all values ≤ 1", () => {
    const dataBelow100 = [
      { label: "Protein", progress: 0.75, color: "#2563EB" },
      { label: "Carbs", progress: 0.5, color: "#D97706" },
      { label: "Fat", progress: 1.0, color: "#059669" },
    ];

    const { queryByTestId } = render(<MacroRings data={dataBelow100} />);

    // No overflow arcs should exist
    expect(queryByTestId("ring-0-overflow")).toBeNull();
    expect(queryByTestId("ring-1-overflow")).toBeNull();
    expect(queryByTestId("ring-2-overflow")).toBeNull();
  });

  it("renders overflow arcs when a value > 1", () => {
    const dataWithOverflow = [
      { label: "Protein", progress: 1.2, color: "#2563EB" },
      { label: "Carbs", progress: 0.5, color: "#D97706" },
      { label: "Fat", progress: 0.9, color: "#059669" },
    ];

    const { getByTestId, queryByTestId } = render(
      <MacroRings data={dataWithOverflow} />,
    );

    // First ring should have overflow arc
    expect(getByTestId("ring-0-overflow")).toBeTruthy();

    // Other rings should NOT have overflow arcs
    expect(queryByTestId("ring-1-overflow")).toBeNull();
    expect(queryByTestId("ring-2-overflow")).toBeNull();
  });

  it("handles edge case: 0 progress", () => {
    const dataZero = [{ label: "Protein", progress: 0, color: "#2563EB" }];

    const { getByTestId } = render(<MacroRings data={dataZero} />);

    // Should still render background + main arc (with 0 progress)
    expect(getByTestId("ring-0-bg")).toBeTruthy();
    expect(getByTestId("ring-0-main")).toBeTruthy();
  });

  it("handles edge case: exactly 1.0", () => {
    const dataExact = [{ label: "Protein", progress: 1.0, color: "#2563EB" }];

    const { getByTestId, queryByTestId } = render(
      <MacroRings data={dataExact} />,
    );

    // Should render background + main arc
    expect(getByTestId("ring-0-bg")).toBeTruthy();
    expect(getByTestId("ring-0-main")).toBeTruthy();

    // No overflow arc when exactly 1.0
    expect(queryByTestId("ring-0-overflow")).toBeNull();
  });

  it("handles edge case: values above 2.0 (capped at 2.0)", () => {
    const dataAbove200 = [
      { label: "Protein", progress: 2.5, color: "#2563EB" },
    ];

    const { getByTestId } = render(<MacroRings data={dataAbove200} />);

    // Should have background + full main arc + overflow arc (capped at 1.0)
    expect(getByTestId("ring-0-bg")).toBeTruthy();
    expect(getByTestId("ring-0-main")).toBeTruthy();
    expect(getByTestId("ring-0-overflow")).toBeTruthy();

    // Overflow should be capped (the visual capping is inside the component)
    // We can't directly test the cap here, but we verify the overflow arc exists
  });

  it("accepts custom size, strokeWidth, baseRadius, and ringGap props", () => {
    const { container } = render(
      <MacroRings
        data={mockData}
        size={300}
        strokeWidth={16}
        baseRadius={60}
        ringGap={25}
      />,
    );

    expect(container).toBeTruthy();
  });
});

describe("darkenHex", () => {
  it("correctly darkens a hex color", () => {
    const lightBlue = "#3B82F6";
    const darkened = darkenHex(lightBlue, 0.25);

    // Should return a valid hex color that's darker
    expect(darkened).toMatch(/^#[0-9A-F]{6}$/i);
    expect(darkened).not.toBe(lightBlue);

    // Parse and verify it's darker (sum of RGB components should be lower)
    const originalSum =
      parseInt(lightBlue.slice(1, 3), 16) +
      parseInt(lightBlue.slice(3, 5), 16) +
      parseInt(lightBlue.slice(5, 7), 16);
    const darkenedSum =
      parseInt(darkened.slice(1, 3), 16) +
      parseInt(darkened.slice(3, 5), 16) +
      parseInt(darkened.slice(5, 7), 16);

    expect(darkenedSum).toBeLessThan(originalSum);
  });

  it("handles amount = 0 (no darkening)", () => {
    const color = "#3B82F6";
    const result = darkenHex(color, 0);

    expect(result).toBe(color.toUpperCase());
  });

  it("handles amount = 1 (maximum darkening)", () => {
    const color = "#3B82F6";
    const result = darkenHex(color, 1);

    // Should return black
    expect(result).toBe("#000000");
  });

  it("handles 3-character hex codes", () => {
    const shortHex = "#FFF";
    const darkened = darkenHex(shortHex, 0.5);

    expect(darkened).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
