import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastingSession } from "@models/types";

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
      fastingAccent: "#8B5CF6",
      fastingBg: "#F5F3FF",
    },
  }),
}));

vi.mock("@expo/vector-icons", () => ({
  Ionicons: (props: Record<string, unknown>) =>
    React.createElement("ionicons-mock", props),
}));

import { FastingWidget } from "../FastingWidget";

describe("FastingWidget", () => {
  const defaultOnPress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing when no active session", () => {
    const { getByTestId } = render(
      <FastingWidget activeSession={null} onPress={defaultOnPress} />,
    );
    expect(getByTestId("fasting-widget")).toBeTruthy();
  });

  it("shows default 16:8 text when no active session", () => {
    const { getByText } = render(
      <FastingWidget activeSession={null} onPress={defaultOnPress} />,
    );
    expect(getByText("16:8")).toBeTruthy();
  });

  it("shows Fasting label", () => {
    const { getByText } = render(
      <FastingWidget activeSession={null} onPress={defaultOnPress} />,
    );
    expect(getByText("Fasting")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <FastingWidget activeSession={null} onPress={onPress} />,
    );
    fireEvent.click(getByTestId("fasting-widget"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows technique and countdown when session is active", () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString(); // +1hr
    const session: FastingSession = {
      id: "test-1",
      technique: "18:6",
      fastingHours: 18,
      startedAt: new Date().toISOString(),
      targetEndAt: futureDate,
      endedAt: null,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { getByText, getByTestId } = render(
      <FastingWidget activeSession={session} onPress={defaultOnPress} />,
    );
    expect(getByText("18:6")).toBeTruthy();
    expect(getByTestId("fasting-countdown")).toBeTruthy();
  });
});
