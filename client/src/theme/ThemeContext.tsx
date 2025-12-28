import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { LightTheme, DarkTheme, Theme } from './colors';
import { loadThemePreference, saveThemePreference } from '@storage/storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextValue {
  theme: 'light' | 'dark';
  themeMode: ThemeMode;
  colors: Theme;
  setThemeMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Listen for system theme changes
  useEffect(() => {
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      console.log('System color scheme changed to:', colorScheme);
      setSystemColorScheme(colorScheme);
    });

    return () => listener.remove();
  }, []);

  // Determine the actual theme to use based on themeMode and system preference
  const theme: 'light' | 'dark' =
    themeMode === 'system'
      ? systemColorScheme === 'dark'
        ? 'dark'
        : 'light'
      : themeMode;

  const colors = theme === 'dark' ? DarkTheme : LightTheme;

  // Debug logging
  console.log('Theme Debug:', {
    systemColorScheme,
    themeMode,
    resolvedTheme: theme,
  });

  // Load saved theme preference on mount
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const savedMode = await loadThemePreference();
        if (savedMode) {
          setThemeModeState(savedMode);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreference();
  }, []);

  // Save theme preference when it changes
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await saveThemePreference(mode);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  // Don't render children until we've loaded the saved preference
  if (isLoading) {
    return null;
  }

  const value: ThemeContextValue = {
    theme,
    themeMode,
    colors,
    setThemeMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

