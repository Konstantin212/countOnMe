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

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <AppNavigator />
        </NavigationContainer>
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
