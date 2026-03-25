import React from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      cardBackground: "#FFFFFF",
      overlay: "rgba(0, 0, 0, 0.5)",
      waterFill: "#3B82F6",
      waterFillDeep: "#2563EB",
      waterFillBg: "#DBEAFE",
      error: "#DC2626",
    },
  }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) =>
    React.createElement("ionicons-mock", props),
}));

import { WaterModal } from "../WaterModal";

describe("WaterModal", () => {
  const defaultProps = {
    visible: true,
    currentMl: 500,
    goalMl: 2000,
    onAddWater: vi.fn(),
    onRemoveWater: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders when visible=true", () => {
    const { getByTestId } = render(<WaterModal {...defaultProps} />);

    expect(getByTestId("water-modal")).toBeTruthy();
  });

  it("does not render when visible=false", () => {
    const { queryByTestId } = render(
      <WaterModal {...defaultProps} visible={false} />,
    );

    expect(queryByTestId("water-modal")).toBeNull();
  });

  it("displays current ml and goal ml", () => {
    const { getByText } = render(<WaterModal {...defaultProps} />);

    expect(getByText("500 / 2000 ml")).toBeTruthy();
  });

  it("shows close button that calls onClose", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(
      <WaterModal {...defaultProps} onClose={onClose} />,
    );

    fireEvent.click(getByTestId("water-modal-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onAddWater with accumulated amount when fill area held", () => {
    const onAddWater = vi.fn();
    const { getByTestId } = render(
      <WaterModal {...defaultProps} onAddWater={onAddWater} />,
    );

    const fillArea = getByTestId("water-fill-area");

    act(() => {
      fireEvent.mouseDown(fillArea);
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    act(() => {
      fireEvent.mouseUp(fillArea);
    });

    expect(onAddWater).toHaveBeenCalledTimes(1);
    expect(onAddWater).toHaveBeenCalledWith(150);
  });

  it("calls onRemoveWater with accumulated amount when undo button held", () => {
    const onRemoveWater = vi.fn();
    const { getByTestId } = render(
      <WaterModal
        {...defaultProps}
        currentMl={500}
        onRemoveWater={onRemoveWater}
      />,
    );

    const undoButton = getByTestId("water-remove-button");

    act(() => {
      fireEvent.mouseDown(undoButton);
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      fireEvent.mouseUp(undoButton);
    });

    expect(onRemoveWater).toHaveBeenCalledTimes(1);
    expect(onRemoveWater).toHaveBeenCalledWith(100);
  });

  it("renders SVG wave elements", () => {
    const { container } = render(<WaterModal {...defaultProps} />);

    const svgElement = container.querySelector("svg");
    expect(svgElement).toBeTruthy();

    const html = container.innerHTML;
    expect(html).toContain("path");
  });

  it("shows pending ml counter during hold", () => {
    const { getByTestId, getByText } = render(<WaterModal {...defaultProps} />);

    const fillArea = getByTestId("water-fill-area");

    act(() => {
      fireEvent.mouseDown(fillArea);
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(getByText("+100 ml")).toBeTruthy();

    act(() => {
      fireEvent.mouseUp(fillArea);
    });
  });

  it("resets pending ml after parent updates currentMl", () => {
    const { getByTestId, queryByText, rerender } = render(
      <WaterModal {...defaultProps} />,
    );

    const fillArea = getByTestId("water-fill-area");

    act(() => {
      fireEvent.mouseDown(fillArea);
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      fireEvent.mouseUp(fillArea);
    });

    expect(queryByText("+100 ml")).toBeTruthy();

    act(() => {
      rerender(<WaterModal {...defaultProps} currentMl={600} />);
    });

    expect(queryByText("+100 ml")).toBeNull();
  });

  it("shows percentage text", () => {
    const { getByText } = render(<WaterModal {...defaultProps} />);

    // 500/2000 = 25%
    expect(getByText("25%")).toBeTruthy();
  });
});
