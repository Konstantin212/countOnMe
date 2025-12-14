# Theme Guidelines for CountOnMe

## Overview
CountOnMe uses a comprehensive theme system supporting both light and dark modes. The theme follows system preferences by default and allows manual override.

---

## Color Palettes

### Light Theme
Main colors inspired by soft, warm tones with teal accents:
- **Background**: `#FFFBDE` - Soft cream yellow
- **Primary**: `#90D1CA` - Teal blue-green
- **Secondary**: `#129990` - Dark teal
- **Tertiary**: `#096B68` - Deep teal

### Dark Theme
Olive green base with yellow-green accents:
- **Background**: `#556B2F` - Dark olive green
- **Primary**: `#EFF5D2` - Light yellow-green
- **Secondary**: `#8FA31E` - Yellow-olive
- **Tertiary**: `#C6D870` - Light lime green

---

## Rules for Using Themes

### 1. NEVER Hardcode Colors
❌ **Wrong:**
```typescript
const styles = StyleSheet.create({
  container: { backgroundColor: '#fff' },
  text: { color: '#333' },
});
```

✅ **Correct:**
```typescript
const { colors } = useTheme();

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background },
  text: { color: colors.text },
});
```

### 2. Always Import useTheme Hook
```typescript
import { useTheme } from '../hooks/useTheme';
// or '../hooks/useTheme' depending on your location
```

### 3. Move Styles Inside Components
Theme colors are dynamic, so styles must be created inside the component:

```typescript
const MyComponent = () => {
  const { colors } = useTheme();
  
  // Create styles INSIDE component to access colors
  const styles = StyleSheet.create({
    container: { backgroundColor: colors.background },
  });
  
  return <View style={styles.container}>...</View>;
};
```

### 4. Use Semantic Color Names
The theme provides semantic color names for common use cases:

**Text:**
- `colors.text` - Primary text color
- `colors.textSecondary` - Secondary/muted text
- `colors.textTertiary` - Tertiary/very muted text
- `colors.textInverse` - Inverse text (for buttons, etc.)

**UI Elements:**
- `colors.background` - Main background
- `colors.cardBackground` - Card/item backgrounds
- `colors.inputBackground` - Input field backgrounds
- `colors.border` - Border colors
- `colors.borderLight` - Light borders

**Interactive:**
- `colors.primary` - Primary action color
- `colors.secondary` - Secondary actions
- `colors.tertiary` - Tertiary elements
- `colors.pressed` - Pressed state background
- `colors.disabled` - Disabled state

**Status:**
- `colors.success` / `colors.successLight` - Success states
- `colors.error` / `colors.errorLight` - Error states  
- `colors.warning` / `colors.warningLight` - Warning states
- `colors.info` / `colors.infoLight` - Info states

**Icons & Buttons:**
- `colors.buttonText` - Button text color
- `colors.iconPrimary` - Primary icon color
- `colors.iconSecondary` - Secondary icon color

---

## Accessing Theme Mode

You can access the current theme mode and change it:

```typescript
const { theme, themeMode, setThemeMode, colors } = useTheme();

// theme: 'light' | 'dark' - the actual theme being used
// themeMode: 'light' | 'dark' | 'system' - user's preference
// setThemeMode: (mode) => void - change theme preference
// colors: Theme object - all color values
```

---

## Theme Switching

Users can switch themes in the Profile screen:
- **Light**: Always use light theme
- **Dark**: Always use dark theme  
- **System Default**: Follow device settings

Theme preference is persisted in AsyncStorage.

---

## Testing Themes

When developing, test both light and dark themes:
1. Change device theme settings
2. Use Profile screen theme toggle
3. Verify all screens look good in both modes
4. Check text contrast and readability

---

## Adding New Colors

If you need a new semantic color:
1. Add it to both `LightTheme` and `DarkTheme` in `src/theme/colors.ts`
2. Document it in this file
3. Use descriptive semantic names (e.g., `buttonSecondary`, not `color7`)

---

## Common Patterns

### Buttons
```typescript
const styles = StyleSheet.create({
  primaryButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: colors.buttonText,
  },
});
```

### Cards
```typescript
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderColor: colors.border,
    borderWidth: 1,
  },
});
```

### Input Fields
```typescript
const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
});
```

### Status Indicators
```typescript
const styles = StyleSheet.create({
  successBadge: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  successText: {
    color: colors.success,
  },
});
```

---

## Migration Checklist

When updating an existing component to use themes:
- [ ] Import `useTheme` hook
- [ ] Call `const { colors } = useTheme()` in component
- [ ] Move `StyleSheet.create()` inside component (after hooks)
- [ ] Replace all hardcoded color values with `colors.*`
- [ ] Test in both light and dark modes
- [ ] Verify text is readable in both themes

---

## Troubleshooting

**Issue**: "useTheme must be used within a ThemeProvider"
- **Fix**: Ensure `App.tsx` wraps the app with `<ThemeProvider>`

**Issue**: Styles not updating when theme changes
- **Fix**: Make sure `StyleSheet.create()` is inside the component, not at file level

**Issue**: Colors look wrong in one theme
- **Fix**: Check `src/theme/colors.ts` - ensure both themes have appropriate values

---

This theme system ensures consistent, accessible, and maintainable styling throughout the app.

