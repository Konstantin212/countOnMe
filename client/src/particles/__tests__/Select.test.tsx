import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { Select } from "../Select";

vi.mock("@hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "light",
    themeMode: "system",
    setThemeMode: vi.fn(),
    colors: {
      background: "#F8FAFC",
      text: "#1E293B",
      textSecondary: "#475569",
      textTertiary: "#94A3B8",
      textInverse: "#F8FAFC",
      primary: "#16A34A",
      primaryBg: "#DCFCE7",
      border: "#E2E8F0",
      inputBackground: "#F1F5F9",
      cardBackground: "#FFFFFF",
      error: "#DC2626",
      overlay: "rgba(0, 0, 0, 0.5)",
      iconSecondary: "#94A3B8",
    },
  }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) =>
    React.createElement("ionicons-mock", props),
}));

const OPTIONS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
] as const;

type MealType = (typeof OPTIONS)[number]["value"];

describe("Select", () => {
  let onValueChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onValueChange = vi.fn();
  });

  it("renders with selected value label displayed", () => {
    render(
      <Select<MealType>
        value="lunch"
        onValueChange={onValueChange}
        options={[...OPTIONS]}
      />,
    );

    expect(screen.getByText("Lunch")).toBeTruthy();
  });

  it("opens modal on press", () => {
    render(
      <Select<MealType>
        value="breakfast"
        onValueChange={onValueChange}
        options={[...OPTIONS]}
        testID="meal-select"
      />,
    );

    // Before press, modal is not visible — option list items should not be rendered
    // The trigger itself shows "Breakfast", but the option rows are inside the modal
    fireEvent.click(screen.getByTestId("meal-select"));

    // After press, all option labels should appear in the modal
    // "Breakfast" appears both on the trigger and in the option list
    expect(screen.getAllByText("Breakfast")).toHaveLength(2);
    expect(screen.getByText("Lunch")).toBeTruthy();
    expect(screen.getByText("Dinner")).toBeTruthy();
  });

  it("calls onValueChange when option tapped", () => {
    render(
      <Select<MealType>
        value="breakfast"
        onValueChange={onValueChange}
        options={[...OPTIONS]}
        testID="meal-select"
      />,
    );

    // Open modal
    fireEvent.click(screen.getByTestId("meal-select"));

    // Tap "Dinner" option
    fireEvent.click(screen.getByTestId("meal-select-option-dinner"));

    expect(onValueChange).toHaveBeenCalledWith("dinner");
  });

  it("closes modal on overlay tap without calling onValueChange", () => {
    render(
      <Select<MealType>
        value="breakfast"
        onValueChange={onValueChange}
        options={[...OPTIONS]}
        testID="meal-select"
      />,
    );

    // Open modal
    fireEvent.click(screen.getByTestId("meal-select"));

    // Tap overlay to dismiss
    fireEvent.click(screen.getByTestId("meal-select-overlay"));

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("renders placeholder when no matching value", () => {
    render(
      <Select<MealType>
        value={"unknown" as MealType}
        onValueChange={onValueChange}
        options={[...OPTIONS]}
        placeholder="Choose meal type"
      />,
    );

    expect(screen.getByText("Choose meal type")).toBeTruthy();
  });

  it("renders label when provided", () => {
    render(
      <Select<MealType>
        value="lunch"
        onValueChange={onValueChange}
        options={[...OPTIONS]}
        label="Meal Type"
      />,
    );

    expect(screen.getByText("Meal Type")).toBeTruthy();
  });

  it("renders error when provided", () => {
    render(
      <Select<MealType>
        value="lunch"
        onValueChange={onValueChange}
        options={[...OPTIONS]}
        error="Required field"
      />,
    );

    expect(screen.getByText("Required field")).toBeTruthy();
  });
});
