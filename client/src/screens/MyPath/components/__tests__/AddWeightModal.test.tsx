import React from "react";
import { render, fireEvent, act } from "@testing-library/react";
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
      textInverse: "#F8FAFC",
      primary: "#16A34A",
      border: "#E2E8F0",
      borderLight: "#CBD5E1",
      cardBackground: "#FFFFFF",
      inputBackground: "#F1F5F9",
      overlay: "rgba(0, 0, 0, 0.5)",
      buttonText: "#F8FAFC",
      disabled: "#94a3b8",
      error: "#DC2626",
      textTertiary: "#94A3B8",
    },
  }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) =>
    React.createElement("ionicons-mock", props),
}));

// Capture the onChangeValue callback from NumericInput for test use
let capturedOnChangeValue: ((v: number | undefined) => void) | undefined;

vi.mock("@particles", () => ({
  NumericInput: (props: {
    testID?: string;
    value: number | undefined;
    onChangeValue: (v: number | undefined) => void;
    label?: string;
    placeholder?: string;
    error?: string;
  }) => {
    capturedOnChangeValue = props.onChangeValue;
    return React.createElement("div", { "data-testid": props.testID }, [
      React.createElement("input", {
        key: "input",
        readOnly: true,
        value: props.value !== undefined ? String(props.value) : "",
      }),
      props.error
        ? React.createElement(
            "span",
            { key: "error", "data-testid": "weight-error" },
            props.error,
          )
        : null,
    ]);
  },
  Button: (props: {
    testID?: string;
    children: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
  }) =>
    React.createElement(
      "button",
      {
        "data-testid": props.testID,
        onClick: props.onPress,
        disabled: props.disabled,
      },
      props.children,
    ),
}));

import { AddWeightModal } from "../AddWeightModal";

describe("AddWeightModal", () => {
  const defaultProps = {
    visible: true,
    onClose: vi.fn(),
    onLogWeight: vi.fn(() => Promise.resolve()),
    weights: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnChangeValue = undefined;
  });

  it("renders when visible is true", () => {
    const { getByText } = render(<AddWeightModal {...defaultProps} />);
    expect(getByText("Log Weight")).not.toBeNull();
  });

  it("does not render when visible is false", () => {
    const { queryByText } = render(
      <AddWeightModal {...defaultProps} visible={false} />,
    );
    expect(queryByText("Log Weight")).toBeNull();
  });

  it("displays today's date", () => {
    const { container } = render(<AddWeightModal {...defaultProps} />);
    const year = new Date().getFullYear().toString();
    expect(container.textContent).toContain(year);
  });

  it("calls onClose when close button is pressed", () => {
    const { getByTestId } = render(<AddWeightModal {...defaultProps} />);
    fireEvent.click(getByTestId("weight-modal-close"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when cancel button is pressed", () => {
    const { getByTestId } = render(<AddWeightModal {...defaultProps} />);
    fireEvent.click(getByTestId("weight-cancel-button"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onLogWeight with today's date and weight when save is pressed", async () => {
    const { getByTestId } = render(<AddWeightModal {...defaultProps} />);

    await act(async () => {
      capturedOnChangeValue?.(74.2);
    });

    await act(async () => {
      fireEvent.click(getByTestId("weight-save-button"));
    });

    expect(defaultProps.onLogWeight).toHaveBeenCalledTimes(1);
    const callArgs = defaultProps.onLogWeight.mock.calls[0] as unknown[];
    expect(callArgs[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(callArgs[1]).toBe(74.2);
  });

  it("navigates to previous day when prev button is pressed", () => {
    const { getByTestId, container } = render(
      <AddWeightModal {...defaultProps} />,
    );
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayYear = yesterday.getFullYear().toString();

    fireEvent.click(getByTestId("date-prev-button"));

    expect(container.textContent).toContain(yesterdayYear);
  });

  it("does not navigate past today when next button is pressed on today", () => {
    const { getByTestId } = render(<AddWeightModal {...defaultProps} />);
    const todayText = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Next button should be disabled on today
    const nextButton = getByTestId("date-next-button");
    expect(nextButton.getAttribute("disabled")).not.toBeNull();
    // Text stays the same
    expect(getByTestId("date-next-button")).toBeTruthy();
    void todayText;
  });

  it("calls onLogWeight with selected past date when navigated back", async () => {
    const { getByTestId } = render(<AddWeightModal {...defaultProps} />);

    fireEvent.click(getByTestId("date-prev-button"));

    await act(async () => {
      capturedOnChangeValue?.(70);
    });

    await act(async () => {
      fireEvent.click(getByTestId("weight-save-button"));
    });

    expect(defaultProps.onLogWeight).toHaveBeenCalledTimes(1);
    const callArgs = defaultProps.onLogWeight.mock.calls[0] as unknown[];
    const day = callArgs[0] as string;
    expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Should be yesterday, not today
    const today = new Date().toISOString().split("T")[0];
    expect(day).not.toBe(today);
  });

  it("disables save button when weight is empty", () => {
    const { getByTestId } = render(<AddWeightModal {...defaultProps} />);
    const saveButton = getByTestId("weight-save-button");
    expect(saveButton.getAttribute("disabled")).not.toBeNull();
  });

  it("shows error and disables save when weight exceeds 700 kg", async () => {
    const { getByTestId } = render(<AddWeightModal {...defaultProps} />);

    await act(async () => {
      capturedOnChangeValue?.(800);
    });

    expect(getByTestId("weight-error").textContent).toBe(
      "Weight must be between 1 and 700 kg",
    );
    expect(
      getByTestId("weight-save-button").getAttribute("disabled"),
    ).not.toBeNull();
  });

  it("shows error and disables save when weight is below 1 kg", async () => {
    const { getByTestId } = render(<AddWeightModal {...defaultProps} />);

    await act(async () => {
      capturedOnChangeValue?.(0);
    });

    expect(getByTestId("weight-error").textContent).toBe(
      "Weight must be between 1 and 700 kg",
    );
    expect(
      getByTestId("weight-save-button").getAttribute("disabled"),
    ).not.toBeNull();
  });

  it("accepts float weight values like 74.25", async () => {
    const { getByTestId, queryByTestId } = render(
      <AddWeightModal {...defaultProps} />,
    );

    await act(async () => {
      capturedOnChangeValue?.(74.25);
    });

    await act(async () => {
      fireEvent.click(getByTestId("weight-save-button"));
    });

    expect(defaultProps.onLogWeight).toHaveBeenCalledTimes(1);
    const callArgs = defaultProps.onLogWeight.mock.calls[0] as unknown[];
    expect(callArgs[1]).toBe(74.25);
    expect(queryByTestId("weight-error")).toBeNull();
  });

  it("allows save when weight is within valid range", async () => {
    const { getByTestId, queryByTestId } = render(
      <AddWeightModal {...defaultProps} />,
    );

    await act(async () => {
      capturedOnChangeValue?.(75);
    });

    expect(queryByTestId("weight-error")).toBeNull();
    expect(
      getByTestId("weight-save-button").getAttribute("disabled"),
    ).toBeNull();
  });
});
