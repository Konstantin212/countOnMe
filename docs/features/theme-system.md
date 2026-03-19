---
type: feature
status: current
last-updated: 2026-03-19
related-features: []
---

# Theme System

## Overview

CountOnMe supports light, dark, and system-dependent themes. Users can choose their preferred mode in the Profile screen. The theme preference is persisted via AsyncStorage and restored on app restart. When "System Default" is selected, the app listens to the device's native theme preference via React Native's `Appearance` API and adapts dynamically.

## Architecture

The theme system follows a **React Context + Hook** pattern:

```
ThemeProvider (wraps navigation root)
  ↓
ThemeContext (holds current theme, colors, mode)
  ↓
useTheme hook (consumed by screens/components)
```

All theme consumption flows through `useTheme()`, which provides the current colors, theme name, mode, and a setter function to change modes.

## Theme Modes

| Mode | Behavior | Notes |
|------|----------|-------|
| `light` | Always use light theme colors | User explicitly chose light |
| `dark` | Always use dark theme colors | User explicitly chose dark |
| `system` | Follow device appearance settings | Default mode; respects native theme API |

When `themeMode === 'system'`, the provider listens to device-level theme changes (e.g., user toggles dark mode in Android settings) and updates the rendered theme in real-time.

## Color Tokens

Both `LightTheme` and `DarkTheme` export the same token keys (enforced by TypeScript). Colors are organized by purpose:

### Core Theme
- `background` — main app background
- `primary` — primary action, emphasis
- `primaryBg` — subtle positive surface
- `secondary` — secondary accent (protein/info)
- `tertiary` — tertiary accent (fat/health)
- `tertiaryBg` — muted surface

### Text
- `text` — primary readable text
- `textSecondary` — secondary, less prominent text
- `textTertiary` — tertiary, disabled-like text
- `textInverse` — text on primary backgrounds

### UI Elements
- `border` — standard dividers and borders
- `borderLight` — lighter, subtle borders
- `inputBackground` — input field background
- `cardBackground` — card/surface background
- `cardBackgroundLight` — lighter card variant

### Interactive States
- `pressed` — button/item pressed state
- `disabled` — disabled element color

### Status Colors
- `success`, `successLight` — positive actions, saved states
- `error`, `errorLight` — destructive, validation errors
- `warning`, `warningLight` — caution, carb-focused
- `info`, `infoLight` — information, protein-focused

### Semantic UI
- `buttonText` — text on primary buttons
- `iconPrimary` — primary icons
- `iconSecondary` — secondary, muted icons

### Data Visualization
- `macroProtein` — protein data (blue)
- `macroCarb` — carbohydrate data (amber/orange)
- `macroFat` — fat data (green)

### Charts
- `chartLine` — weight/trend line
- `chartTarget` — target weight dashed line
- `chartBand` — healthy range fill
- `chartBarOver` — calorie overage indicator

### Component Specifics
- `tabBarActive` — active navigation tab
- `tabBarInactive` — inactive navigation tab

### Shadows & Overlays
- `shadow` — drop shadows
- `overlay` — modal/backdrop overlays

## Persistence

Theme preference is saved and loaded via AsyncStorage:

```typescript
export const loadThemePreference = async (): Promise<ThemeMode | null>
export const saveThemePreference = async (mode: ThemeMode): Promise<void>
```

The `ThemeProvider` loads the saved preference on mount and prevents rendering children until the preference is loaded (avoids visual flashing). When the user changes the theme in ProfileScreen, `setThemeMode()` both updates context state and saves to AsyncStorage.

Storage key: `@countOnMe/theme/v1`

## Consumer Pattern

All screens and components consume the theme via the `useTheme` hook:

```typescript
const { colors, theme, themeMode, setThemeMode } = useTheme();
```

Returns:
- `colors: Theme` — Current token object (LightTheme or DarkTheme)
- `theme: 'light' | 'dark'` — Resolved theme (after system resolution)
- `themeMode: ThemeMode` — User's selected mode ('light' | 'dark' | 'system')
- `setThemeMode: (mode: ThemeMode) => void` — Change theme and persist

Use case: Apply theme colors to styles:

```typescript
const { colors } = useTheme();
const styles = StyleSheet.create({
  container: { backgroundColor: colors.background },
  text: { color: colors.text },
});
```

## ProfileScreen Integration

ProfileScreen provides a theme selector UI under the **Theme** section. Three options are presented:

1. **Light** — sunny icon, "Always use light theme"
2. **Dark** — moon icon, "Always use dark theme"
3. **System Default** — phone icon, "Follow device settings"

Selected option is highlighted with a primary-colored border and active icon. A checkmark icon appears next to the active option.

The screen also displays debug text: "Currently using: [Light|Dark] theme" to show the resolved theme. A warning appears when `themeMode === 'system'` and `theme === 'light'` on Android, noting that some devices may not report system theme correctly.

When a theme option is tapped, `setThemeMode()` is called, updating both context and AsyncStorage immediately.

## Adding New Tokens

To add a new color token:

1. **Update both themes** in `client/src/theme/colors.ts`:
   ```typescript
   export const LightTheme = {
     // ... existing tokens
     myNewToken: "#XXXXXX",
   };

   export const DarkTheme = {
     // ... existing tokens
     myNewToken: "#YYYYYY",
   };
   ```

2. **TypeScript enforces parity** — If you add a token to only one theme, the `Theme` type (union of both) will cause compilation errors in consumers. Both themes must have the same keys.

3. **Use in components** — Pull the color from `useTheme()`:
   ```typescript
   const { colors } = useTheme();
   // colors.myNewToken is now available
   ```

## Key Files

- `client/src/theme/colors.ts` — Theme definitions and color tokens
- `client/src/theme/ThemeContext.tsx` — ThemeProvider, ThemeContext, ThemeMode type
- `client/src/hooks/useTheme.ts` — useTheme hook
- `client/src/storage/storage.ts` — loadThemePreference, saveThemePreference
- `client/src/screens/ProfileScreen.tsx` — Theme selector UI
