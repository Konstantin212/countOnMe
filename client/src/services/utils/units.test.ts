import { describe, it, expect } from "vitest";
import type { Unit } from "@models/types";
import {
  UNIT_GROUPS,
  getUnitGroup,
  getCompatibleUnits,
  convertUnit,
} from "./units";

describe("units utilities", () => {
  describe("UNIT_GROUPS", () => {
    it("maps all mass units to mass group", () => {
      expect(UNIT_GROUPS.mg).toBe("mass");
      expect(UNIT_GROUPS.g).toBe("mass");
      expect(UNIT_GROUPS.kg).toBe("mass");
    });

    it("maps all volume units to volume group", () => {
      expect(UNIT_GROUPS.ml).toBe("volume");
      expect(UNIT_GROUPS.l).toBe("volume");
      expect(UNIT_GROUPS.tsp).toBe("volume");
      expect(UNIT_GROUPS.tbsp).toBe("volume");
      expect(UNIT_GROUPS.cup).toBe("volume");
    });

    it("contains all 8 unit types", () => {
      const keys = Object.keys(UNIT_GROUPS);
      expect(keys).toHaveLength(8);
      expect(keys).toEqual(["mg", "g", "kg", "ml", "l", "tsp", "tbsp", "cup"]);
    });
  });

  describe("getUnitGroup", () => {
    it("returns mass for mass units", () => {
      expect(getUnitGroup("mg")).toBe("mass");
      expect(getUnitGroup("g")).toBe("mass");
      expect(getUnitGroup("kg")).toBe("mass");
    });

    it("returns volume for volume units", () => {
      expect(getUnitGroup("ml")).toBe("volume");
      expect(getUnitGroup("l")).toBe("volume");
      expect(getUnitGroup("tsp")).toBe("volume");
      expect(getUnitGroup("tbsp")).toBe("volume");
      expect(getUnitGroup("cup")).toBe("volume");
    });
  });

  describe("getCompatibleUnits", () => {
    it("returns all mass units for mg", () => {
      const compatible = getCompatibleUnits("mg");
      expect(compatible).toHaveLength(3);
      expect(compatible).toEqual(expect.arrayContaining(["mg", "g", "kg"]));
    });

    it("returns all mass units for g", () => {
      const compatible = getCompatibleUnits("g");
      expect(compatible).toHaveLength(3);
      expect(compatible).toEqual(expect.arrayContaining(["mg", "g", "kg"]));
    });

    it("returns all mass units for kg", () => {
      const compatible = getCompatibleUnits("kg");
      expect(compatible).toHaveLength(3);
      expect(compatible).toEqual(expect.arrayContaining(["mg", "g", "kg"]));
    });

    it("returns all volume units for ml", () => {
      const compatible = getCompatibleUnits("ml");
      expect(compatible).toHaveLength(5);
      expect(compatible).toEqual(
        expect.arrayContaining(["ml", "l", "tsp", "tbsp", "cup"]),
      );
    });

    it("returns all volume units for l", () => {
      const compatible = getCompatibleUnits("l");
      expect(compatible).toHaveLength(5);
      expect(compatible).toEqual(
        expect.arrayContaining(["ml", "l", "tsp", "tbsp", "cup"]),
      );
    });

    it("returns all volume units for tsp", () => {
      const compatible = getCompatibleUnits("tsp");
      expect(compatible).toHaveLength(5);
      expect(compatible).toEqual(
        expect.arrayContaining(["ml", "l", "tsp", "tbsp", "cup"]),
      );
    });

    it("returns all volume units for tbsp", () => {
      const compatible = getCompatibleUnits("tbsp");
      expect(compatible).toHaveLength(5);
      expect(compatible).toEqual(
        expect.arrayContaining(["ml", "l", "tsp", "tbsp", "cup"]),
      );
    });

    it("returns all volume units for cup", () => {
      const compatible = getCompatibleUnits("cup");
      expect(compatible).toHaveLength(5);
      expect(compatible).toEqual(
        expect.arrayContaining(["ml", "l", "tsp", "tbsp", "cup"]),
      );
    });
  });

  describe("convertUnit - mass conversions", () => {
    it("returns same value when converting to same unit", () => {
      expect(convertUnit(100, "g", "g")).toBe(100);
      expect(convertUnit(50, "mg", "mg")).toBe(50);
      expect(convertUnit(2.5, "kg", "kg")).toBe(2.5);
    });

    it("converts mg to g", () => {
      expect(convertUnit(1000, "mg", "g")).toBe(1);
      expect(convertUnit(500, "mg", "g")).toBe(0.5);
    });

    it("converts g to mg", () => {
      expect(convertUnit(1, "g", "mg")).toBe(1000);
      expect(convertUnit(2.5, "g", "mg")).toBe(2500);
    });

    it("converts kg to g", () => {
      expect(convertUnit(1, "kg", "g")).toBe(1000);
      expect(convertUnit(2.5, "kg", "g")).toBe(2500);
    });

    it("converts g to kg", () => {
      expect(convertUnit(1000, "g", "kg")).toBe(1);
      expect(convertUnit(500, "g", "kg")).toBe(0.5);
    });

    it("converts mg to kg", () => {
      expect(convertUnit(1000000, "mg", "kg")).toBe(1);
      expect(convertUnit(500000, "mg", "kg")).toBe(0.5);
    });

    it("converts kg to mg", () => {
      expect(convertUnit(1, "kg", "mg")).toBe(1000000);
      expect(convertUnit(0.001, "kg", "mg")).toBe(1000);
    });
  });

  describe("convertUnit - volume conversions", () => {
    it("converts ml to l", () => {
      expect(convertUnit(1000, "ml", "l")).toBe(1);
      expect(convertUnit(500, "ml", "l")).toBe(0.5);
    });

    it("converts l to ml", () => {
      expect(convertUnit(1, "l", "ml")).toBe(1000);
      expect(convertUnit(2.5, "l", "ml")).toBe(2500);
    });

    it("converts tsp to ml", () => {
      expect(convertUnit(1, "tsp", "ml")).toBe(5);
      expect(convertUnit(2, "tsp", "ml")).toBe(10);
    });

    it("converts ml to tsp", () => {
      expect(convertUnit(5, "ml", "tsp")).toBe(1);
      expect(convertUnit(10, "ml", "tsp")).toBe(2);
    });

    it("converts tbsp to ml", () => {
      expect(convertUnit(1, "tbsp", "ml")).toBe(15);
      expect(convertUnit(2, "tbsp", "ml")).toBe(30);
    });

    it("converts ml to tbsp", () => {
      expect(convertUnit(15, "ml", "tbsp")).toBe(1);
      expect(convertUnit(30, "ml", "tbsp")).toBe(2);
    });

    it("converts cup to ml", () => {
      expect(convertUnit(1, "cup", "ml")).toBe(240);
      expect(convertUnit(2, "cup", "ml")).toBe(480);
    });

    it("converts ml to cup", () => {
      expect(convertUnit(240, "ml", "cup")).toBe(1);
      expect(convertUnit(480, "ml", "cup")).toBe(2);
    });

    it("converts tsp to tbsp", () => {
      // 1 tsp = 5ml, 1 tbsp = 15ml => 1 tsp = 1/3 tbsp
      expect(convertUnit(3, "tsp", "tbsp")).toBe(1);
      expect(convertUnit(6, "tsp", "tbsp")).toBe(2);
    });

    it("converts tbsp to tsp", () => {
      // 1 tbsp = 15ml, 1 tsp = 5ml => 1 tbsp = 3 tsp
      expect(convertUnit(1, "tbsp", "tsp")).toBe(3);
      expect(convertUnit(2, "tbsp", "tsp")).toBe(6);
    });

    it("converts cup to l", () => {
      // 1 cup = 240ml = 0.24l
      expect(convertUnit(1, "cup", "l")).toBe(0.24);
      expect(convertUnit(5, "cup", "l")).toBeCloseTo(1.2, 10);
    });

    it("converts tsp to cup", () => {
      // 1 tsp = 5ml, 1 cup = 240ml => 1 tsp = 5/240 = 1/48 cup
      expect(convertUnit(48, "tsp", "cup")).toBe(1);
    });
  });

  describe("convertUnit - cross-group returns null", () => {
    it("returns null when converting mass to volume", () => {
      expect(convertUnit(100, "g", "ml")).toBeNull();
      expect(convertUnit(1, "kg", "l")).toBeNull();
      expect(convertUnit(500, "mg", "cup")).toBeNull();
    });

    it("returns null when converting volume to mass", () => {
      expect(convertUnit(100, "ml", "g")).toBeNull();
      expect(convertUnit(1, "l", "kg")).toBeNull();
      expect(convertUnit(5, "tsp", "mg")).toBeNull();
    });
  });

  describe("convertUnit - edge cases", () => {
    it("handles zero value", () => {
      expect(convertUnit(0, "g", "kg")).toBe(0);
      expect(convertUnit(0, "ml", "l")).toBe(0);
    });

    it("handles negative values", () => {
      expect(convertUnit(-100, "g", "kg")).toBe(-0.1);
      expect(convertUnit(-500, "ml", "l")).toBe(-0.5);
    });

    it("returns null for non-finite values", () => {
      expect(convertUnit(Infinity, "g", "kg")).toBeNull();
      expect(convertUnit(-Infinity, "ml", "l")).toBeNull();
      expect(convertUnit(NaN, "g", "kg")).toBeNull();
    });

    it("handles decimal values", () => {
      expect(convertUnit(123.45, "g", "kg")).toBeCloseTo(0.12345, 10);
      expect(convertUnit(67.89, "ml", "l")).toBeCloseTo(0.06789, 10);
    });

    it("handles very small values", () => {
      expect(convertUnit(0.001, "g", "mg")).toBe(1);
      expect(convertUnit(0.001, "l", "ml")).toBe(1);
    });

    it("handles very large values", () => {
      expect(convertUnit(1000000, "mg", "kg")).toBe(1);
      expect(convertUnit(1000000, "ml", "l")).toBe(1000);
    });
  });

  describe("convertUnit - round-trip conversions", () => {
    it("preserves value through g -> kg -> g", () => {
      const original = 2500;
      const kg = convertUnit(original, "g", "kg");
      const backToG = convertUnit(kg!, "kg", "g");
      expect(backToG).toBe(original);
    });

    it("preserves value through ml -> l -> ml", () => {
      const original = 1500;
      const l = convertUnit(original, "ml", "l");
      const backToMl = convertUnit(l!, "l", "ml");
      expect(backToMl).toBe(original);
    });

    it("preserves value through tsp -> ml -> tsp", () => {
      const original = 10;
      const ml = convertUnit(original, "tsp", "ml");
      const backToTsp = convertUnit(ml!, "ml", "tsp");
      expect(backToTsp).toBe(original);
    });

    it("preserves value through cup -> ml -> cup", () => {
      const original = 3;
      const ml = convertUnit(original, "cup", "ml");
      const backToCup = convertUnit(ml!, "ml", "cup");
      expect(backToCup).toBe(original);
    });
  });
});
