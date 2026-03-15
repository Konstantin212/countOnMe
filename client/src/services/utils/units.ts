import type { Unit } from "@models/types";

export type UnitGroup = "mass" | "volume" | "count";

const MASS_TO_G: Record<"mg" | "g" | "kg", number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
};

const VOLUME_TO_ML: Record<"ml" | "l" | "tsp" | "tbsp" | "cup", number> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
};

/**
 * Maps each unit to its group (mass, volume, or count).
 */
export const UNIT_GROUPS: Record<Unit, UnitGroup> = {
  mg: "mass",
  g: "mass",
  kg: "mass",
  ml: "volume",
  l: "volume",
  tsp: "volume",
  tbsp: "volume",
  cup: "volume",
  pcs: "count",
  serving: "count",
};

/**
 * Get the unit group for a given unit.
 */
export const getUnitGroup = (unit: Unit): UnitGroup => {
  return UNIT_GROUPS[unit];
};

/**
 * Get all units that are compatible (inter-convertible) with the given unit.
 * Used to restrict unit selection in edit mode.
 *
 * Count units (pcs, serving) are NOT inter-convertible, so each
 * count unit is only compatible with itself.
 */
export const getCompatibleUnits = (unit: Unit): Unit[] => {
  const group = getUnitGroup(unit);
  if (group === "count") return [unit];
  return (Object.entries(UNIT_GROUPS) as [Unit, UnitGroup][])
    .filter(([_, g]) => g === group)
    .map(([u]) => u);
};

/**
 * Converts a numeric value between compatible units.
 * - Mass: mg <-> g <-> kg (via grams)
 * - Volume: ml <-> l <-> tsp/tbsp/cup (via milliliters)
 * - Count: pcs, serving (no inter-conversion; same-to-same only)
 *
 * Returns null when conversion is not possible (e.g. g -> ml, pcs -> serving).
 */
export const convertUnit = (
  value: number,
  from: Unit,
  to: Unit,
): number | null => {
  if (!Number.isFinite(value)) return null;
  if (from === to) return value;

  const fromGroup = getUnitGroup(from);
  const toGroup = getUnitGroup(to);
  if (fromGroup !== toGroup) return null;

  // Count units (pcs, serving) are not inter-convertible
  if (fromGroup === "count") return null;

  if (fromGroup === "mass") {
    const fromToG = MASS_TO_G[from as keyof typeof MASS_TO_G];
    const toToG = MASS_TO_G[to as keyof typeof MASS_TO_G];
    if (!fromToG || !toToG) return null;
    const grams = value * fromToG;
    return grams / toToG;
  }

  const fromToMl = VOLUME_TO_ML[from as keyof typeof VOLUME_TO_ML];
  const toToMl = VOLUME_TO_ML[to as keyof typeof VOLUME_TO_ML];
  if (!fromToMl || !toToMl) return null;
  const ml = value * fromToMl;
  return ml / toToMl;
};
