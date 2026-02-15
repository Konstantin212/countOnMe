/**
 * Theme color definitions for CountOnMe app
 *
 * Updated palette (2026-01):
 * - Dark: Deep slate background with neon accents
 * - Light: Soft white background with consistent accents
 */

export const LightTheme = {
  // Core theme colors
  background: "#F8FAFC", // Main Background (Alice Blue)
  primary: "#16A34A", // Primary Action (Forest Green)
  primaryBg: "#DCFCE7", // subtle positive surface
  secondary: "#2563EB", // Protein / Info (Blue Ribbon)
  tertiary: "#059669", // Fat accent (Jade Green)
  tertiaryBg: "#F1F5F9", // muted surface

  // Text colors
  text: "#1E293B", // Primary Text (Slate Gray)
  textSecondary: "#475569",
  textTertiary: "#94A3B8",
  textInverse: "#F8FAFC",

  // UI element colors
  border: "#E2E8F0",
  borderLight: "#CBD5E1",
  inputBackground: "#F1F5F9",
  cardBackground: "#FFFFFF", // Card / Surface (Pure White)
  cardBackgroundLight: "#F1F5F9",

  // Interactive states
  pressed: "#F1F5F9",
  disabled: "#94a3b8",

  // Status colors
  success: "#16A34A",
  successLight: "#DCFCE7",
  error: "#DC2626",
  errorLight: "#FEE2E2",
  warning: "#D97706", // aligns with Carbs (Ochre)
  warningLight: "#FFEDD5",
  info: "#2563EB", // aligns with Protein (Blue Ribbon)
  infoLight: "#DBEAFE",

  // Semantic UI colors
  buttonText: "#F8FAFC",
  iconPrimary: "#2563EB",
  iconSecondary: "#94A3B8",

  // Data visualization colors
  macroProtein: "#2563EB", // Protein (Blue Ribbon)
  macroCarb: "#D97706", // Carbs (Ochre)
  macroFat: "#059669", // Fat (Jade Green)

  // Chart colors
  chartLine: "#2563EB", // Weight line (Blue Ribbon — matches protein/info)
  chartTarget: "#DC2626", // Target weight dashed line (Red — distinct from data)
  chartBand: "#16A34A", // Healthy range band fill (Green — positive zone)
  chartBarOver: "#DC2626", // Bar color when over calorie goal (Red — warning)

  // Specific component colors
  tabBarActive: "#1E293B",
  tabBarInactive: "#94A3B8",

  // Shadows and overlays
  shadow: "rgba(0, 0, 0, 0.1)",
  overlay: "rgba(0, 0, 0, 0.5)",
} as const;

export const DarkTheme = {
  // Core theme colors
  background: "#0F172A", // Main Background (Deep Slate)
  primary: "#22C55E", // Primary Action (Emerald Green)
  primaryBg: "#052E16", // subtle positive surface
  secondary: "#3B82F6", // Protein (Royal Blue)
  tertiary: "#10B981", // Fat (Emerald Teal)
  tertiaryBg: "#1E293B", // Card / Surface

  // Text colors
  text: "#F8FAFC", // Primary Text (Ghost White)
  textSecondary: "#CBD5E1",
  textTertiary: "#94A3B8",
  textInverse: "#0F172A",

  // UI element colors
  border: "#334155",
  borderLight: "#475569",
  inputBackground: "#0B1220",
  cardBackground: "#1E293B", // Card / Surface (Dark Slate Gray)
  cardBackgroundLight: "#334155",

  // Interactive states
  pressed: "#334155",
  disabled: "#475569",

  // Status colors
  success: "#22C55E",
  successLight: "#052E16",
  error: "#EF4444",
  errorLight: "#3F1D1D",
  warning: "#F59E0B", // Amber
  warningLight: "#3A2A05",
  info: "#3B82F6", // Royal Blue
  infoLight: "#0B1F3A",

  // Semantic UI colors
  buttonText: "#0F172A",
  iconPrimary: "#F8FAFC",
  iconSecondary: "#94A3B8",

  // Data visualization colors
  macroProtein: "#3B82F6", // Protein (Royal Blue)
  macroCarb: "#F59E0B", // Carbs (Amber)
  macroFat: "#10B981", // Fat (Emerald Teal)

  // Chart colors
  chartLine: "#3B82F6", // Weight line (Royal Blue)
  chartTarget: "#EF4444", // Target weight dashed line (Red)
  chartBand: "#22C55E", // Healthy range band fill (Emerald)
  chartBarOver: "#EF4444", // Bar color when over calorie goal (Red)

  // Specific component colors
  tabBarActive: "#F8FAFC",
  tabBarInactive: "#94A3B8",

  // Shadows and overlays
  shadow: "rgba(0, 0, 0, 0.3)",
  overlay: "rgba(0, 0, 0, 0.7)",
} as const;

export type Theme = typeof LightTheme | typeof DarkTheme;
export type ThemeColors = keyof Theme;
