import { useContext } from 'react';
import { ThemeContext, ThemeContextValue } from '@theme/ThemeContext';

/**
 * Custom hook to access theme context
 * 
 * @returns ThemeContextValue containing current theme, colors, and setThemeMode function
 * @throws Error if used outside of ThemeProvider
 * 
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const { colors, theme, setThemeMode } = useTheme();
 *   
 *   return (
 *     <View style={{ backgroundColor: colors.background }}>
 *       <Text style={{ color: colors.text }}>Hello</Text>
 *     </View>
 *   );
 * };
 * ```
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};

