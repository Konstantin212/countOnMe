import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logEvent } from "./analytics";

describe("logEvent", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("logs event name in __DEV__ mode", () => {
    logEvent("scanner_opened");

    expect(consoleSpy).toHaveBeenCalledWith("[Analytics] scanner_opened", "");
  });

  it("logs event with params in __DEV__ mode", () => {
    logEvent("barcode_scanned", { barcode: "1234567890123" });

    expect(consoleSpy).toHaveBeenCalledWith("[Analytics] barcode_scanned", {
      barcode: "1234567890123",
    });
  });

  it("does not throw when called with any valid event", () => {
    expect(() => logEvent("permission_denied")).not.toThrow();
    expect(() => logEvent("lookup_succeeded", { source: "off" })).not.toThrow();
    expect(() => logEvent("lookup_not_found")).not.toThrow();
    expect(() => logEvent("lookup_failed")).not.toThrow();
    expect(() =>
      logEvent("user_continued_via_manual_fallback"),
    ).not.toThrow();
  });
});
