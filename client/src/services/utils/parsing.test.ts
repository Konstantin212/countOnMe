import { describe, it, expect } from "vitest";
import { parseNumeric } from "./parsing";

describe("parseNumeric", () => {
  describe("when value is a valid number", () => {
    it("should return the number as-is", () => {
      expect(parseNumeric(75.5)).toBe(75.5);
      expect(parseNumeric(0)).toBe(0);
      expect(parseNumeric(-10.25)).toBe(-10.25);
      expect(parseNumeric(100)).toBe(100);
    });
  });

  describe("when value is a valid numeric string", () => {
    it("should parse string to number", () => {
      expect(parseNumeric("75.50")).toBe(75.5);
      expect(parseNumeric("180.5")).toBe(180.5);
      expect(parseNumeric("0")).toBe(0);
      expect(parseNumeric("-10.25")).toBe(-10.25);
      expect(parseNumeric("100")).toBe(100);
    });

    it("should parse scientific notation", () => {
      expect(parseNumeric("1e3")).toBe(1000);
      expect(parseNumeric("1.5e2")).toBe(150);
    });

    it("should parse strings with leading/trailing whitespace", () => {
      expect(parseNumeric("  75.5  ")).toBe(75.5);
      expect(parseNumeric("\t100\n")).toBe(100);
    });
  });

  describe("when value is invalid", () => {
    it("should return undefined for null", () => {
      expect(parseNumeric(null)).toBeUndefined();
    });

    it("should return undefined for undefined", () => {
      expect(parseNumeric(undefined)).toBeUndefined();
    });

    it("should return undefined for invalid strings", () => {
      expect(parseNumeric("invalid")).toBeUndefined();
      expect(parseNumeric("abc123")).toBeUndefined();
      expect(parseNumeric("not a number")).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
      expect(parseNumeric("")).toBeUndefined();
      expect(parseNumeric("   ")).toBeUndefined();
    });

    it("should return undefined for NaN-producing strings", () => {
      expect(parseNumeric("NaN")).toBeUndefined();
      expect(parseNumeric("Infinity")).toBe(Infinity); // parseFloat("Infinity") is valid
      expect(parseNumeric("-Infinity")).toBe(-Infinity);
    });
  });

  describe("edge cases", () => {
    it("should handle zero correctly (not treat as falsy)", () => {
      expect(parseNumeric(0)).toBe(0);
      expect(parseNumeric("0")).toBe(0);
      expect(parseNumeric("0.0")).toBe(0);
    });

    it("should handle very small decimals", () => {
      expect(parseNumeric("0.0001")).toBe(0.0001);
      expect(parseNumeric(0.0001)).toBe(0.0001);
    });

    it("should handle very large numbers", () => {
      expect(parseNumeric("999999.99")).toBe(999999.99);
      expect(parseNumeric(999999.99)).toBe(999999.99);
    });

    it("should handle partial numeric strings", () => {
      // parseFloat stops at first non-numeric character
      expect(parseNumeric("123abc")).toBe(123);
      expect(parseNumeric("45.6xyz")).toBe(45.6);
    });
  });
});
