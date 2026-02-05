import type { Unit } from '@models/types';

export type UnitGroup = 'mass' | 'volume';

const MASS_TO_G: Record<Exclude<Unit, 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup'>, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
};

const VOLUME_TO_ML: Record<Exclude<Unit, 'mg' | 'g' | 'kg'>, number> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
};

/**
 * Maps each unit to its group (mass or volume).
 */
export const UNIT_GROUPS: Record<Unit, UnitGroup> = {
  mg: 'mass',
  g: 'mass',
  kg: 'mass',
  ml: 'volume',
  l: 'volume',
  tsp: 'volume',
  tbsp: 'volume',
  cup: 'volume',
};

/**
 * Get the unit group for a given unit.
 */
export const getUnitGroup = (unit: Unit): UnitGroup => {
  return UNIT_GROUPS[unit];
};

/**
 * Get all units that are compatible (same group) with the given unit.
 * Used to restrict unit selection in edit mode.
 */
export const getCompatibleUnits = (unit: Unit): Unit[] => {
  const group = getUnitGroup(unit);
  return (Object.entries(UNIT_GROUPS) as [Unit, UnitGroup][])
    .filter(([_, g]) => g === group)
    .map(([u]) => u);
};

/**
 * Converts a numeric value between compatible units.
 * - Mass: mg <-> g <-> kg (via grams)
 * - Volume: ml <-> l <-> tsp/tbsp/cup (via milliliters)
 *
 * Returns null when conversion is not possible (e.g. g -> ml).
 */
export const convertUnit = (value: number, from: Unit, to: Unit): number | null => {
  if (!Number.isFinite(value)) return null;
  if (from === to) return value;

  const fromGroup = getUnitGroup(from);
  const toGroup = getUnitGroup(to);
  if (fromGroup !== toGroup) return null;

  if (fromGroup === 'mass') {
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

