/**
 * Theme color definitions for CountOnMe app
 * 
 * Light Theme: Soft, warm tones with teal accent
 * Dark Theme: Olive green base with yellow-green accents
 */

export const LightTheme = {
  // Core theme colors
  background: '#FFFBDE',
  primary: '#90D1CA',
  secondary: '#129990',
  tertiary: '#096B68',

  // Text colors
  text: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textInverse: '#FFFFFF',

  // UI element colors
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  inputBackground: '#fafafa',
  cardBackground: '#FFFFFF',
  
  // Interactive states
  pressed: '#f9fafb',
  disabled: '#94a3b8',
  
  // Status colors
  success: '#16a34a',
  successLight: '#dcfce7',
  error: '#ef4444',
  errorLight: '#fee2e2',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  info: '#3b82f6',
  infoLight: '#dbeafe',

  // Semantic UI colors
  buttonText: '#FFFFFF',
  iconPrimary: '#2563eb',
  iconSecondary: '#9ca3af',

  // Data visualization colors
  macroProtein: '#0D7A73',
  macroCarb: '#F59E0B',
  macroFat: '#2563EB',
  
  // Specific component colors
  tabBarActive: '#111111',
  tabBarInactive: '#9ca3af',
  
  // Shadows and overlays
  shadow: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

export const DarkTheme = {
  // Core theme colors
  background: '#556B2F',
  primary: '#EFF5D2',
  secondary: '#8FA31E',
  tertiary: '#C6D870',

  // Text colors
  text: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textTertiary: '#9CA3AF',
  textInverse: '#333333',

  // UI element colors
  border: '#4A5A2A',
  borderLight: '#5D7332',
  inputBackground: '#4A5A2A',
  cardBackground: '#4A5A2A',
  
  // Interactive states
  pressed: '#5D7332',
  disabled: '#6B7C3E',
  
  // Status colors
  success: '#22c55e',
  successLight: '#3D5A2F',
  error: '#f87171',
  errorLight: '#5A3939',
  warning: '#fbbf24',
  warningLight: '#5A5239',
  info: '#60a5fa',
  infoLight: '#3D4F5A',

  // Semantic UI colors
  buttonText: '#333333',
  iconPrimary: '#EFF5D2',
  iconSecondary: '#9CA3AF',

  // Data visualization colors
  macroProtein: '#7BE0C3',
  macroCarb: '#FFD166',
  macroFat: '#7EA8F8',
  
  // Specific component colors
  tabBarActive: '#EFF5D2',
  tabBarInactive: '#9CA3AF',
  
  // Shadows and overlays
  shadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.7)',
} as const;

export type Theme = typeof LightTheme | typeof DarkTheme;
export type ThemeColors = keyof Theme;

