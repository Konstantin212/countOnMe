import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  NavigationContainer,
  DefaultTheme as NavigationDefaultTheme,
  DarkTheme as NavigationDarkTheme,
  Theme as NavigationTheme,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import {
  MD3LightTheme as PaperLightTheme,
  MD3DarkTheme as PaperDarkTheme,
  PaperProvider,
  MD3Theme as PaperTheme,
} from 'react-native-paper';

import { AppNavigator } from '@app/AppNavigator';
import { ThemeProvider } from '@theme/ThemeContext';
import { useTheme } from '@hooks/useTheme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

const ThemedApp = () => {
  const { colors, theme } = useTheme();

  const navigationTheme: NavigationTheme =
    theme === 'dark'
      ? {
          ...NavigationDarkTheme,
          colors: {
            ...NavigationDarkTheme.colors,
            background: colors.background,
            card: colors.background,
            primary: colors.primary,
            text: colors.text,
            border: colors.border,
          },
        }
      : {
          ...NavigationDefaultTheme,
          colors: {
            ...NavigationDefaultTheme.colors,
            background: colors.background,
            card: colors.background,
            primary: colors.primary,
            text: colors.text,
            border: colors.border,
          },
        };

  const paperTheme: PaperTheme =
    theme === 'dark'
      ? {
          ...PaperDarkTheme,
          colors: {
            ...PaperDarkTheme.colors,
            primary: colors.primary,
            secondary: colors.secondary,
            background: colors.background,
            surface: colors.cardBackground,
            surfaceVariant: colors.cardBackground,
            onSurface: colors.text,
            outline: colors.border,
          },
        }
      : {
          ...PaperLightTheme,
          colors: {
            ...PaperLightTheme.colors,
            primary: colors.primary,
            secondary: colors.secondary,
            background: colors.background,
            surface: colors.cardBackground,
            surfaceVariant: colors.cardBackground,
            onSurface: colors.text,
            outline: colors.border,
          },
        };

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <NavigationContainer theme={navigationTheme}>
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
            <AppNavigator />
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
