// Scale types for product measurements
export const SCALE_TYPES = ['Liquid', 'Solid', 'Dry'] as const;
export type ScaleType = (typeof SCALE_TYPES)[number];

// Available units for each scale type
export const SCALE_UNITS: Record<ScaleType, string[]> = {
  Liquid: ['l', 'ml'],
  Solid: ['kg', 'g', 'mg'],
  Dry: ['tbsp', 'tsp', 'cup'],
};

