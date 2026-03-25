---
type: feature
status: current
last-updated: 2026-03-25
related-features:
  - food-tracking
  - goal-system
  - theme-system
---

# Water Tracking

Water intake tracking is a dedicated feature separate from meal tracking, allowing users to log water consumption throughout the day with an intuitive animated modal interface.

## Overview

Users can quickly add or remove water intake via a press-and-hold interaction on an animated wave modal. Progress is displayed on the MyDay screen as a card with visual indicator, and the water goal comes from the user's `UserGoal.waterMl` setting (default 2000ml). All water logs are persisted locally in AsyncStorage with no backend dependency.

## User Flows

### Add Water
1. User taps "Water" card on MyDay or FAB on MyPath
2. WaterModal opens with animated dual-layer wave background
3. User holds down on the center fill area to increment water (50ml per interval)
4. Wave amplitude increases during hold to provide visual feedback
5. Release triggers save; pending amount is cleared when parent state updates
6. User can tap Undo button to remove water (disabled if currentMl = 0)

### Remove Water
1. User opens WaterModal
2. User holds Undo button at the bottom to decrement water
3. Negative amount is logged; total is clamped to never go below 0
4. Release commits removal to storage

### View Progress
1. MyDay screen displays WaterProgressCard showing current/goal with progress bar
2. Card shows percentage and current ml / goal ml
3. Tapping card opens WaterModal for quick adjustment

## Data Model

### WaterLog
```
{
  id: string (UUID)
  day: string (YYYY-MM-DD, client-local)
  amountMl: number (can be negative for removals)
  createdAt: string (ISO timestamp)
}
```

All logs for a day are summed; negative entries function as "undo" logs rather than deletes. The hook clamps `todayTotal` to 0 (never displays negative).

### Storage
- **Key**: `@countOnMe/water-logs/v1`
- **Format**: JSON array of WaterLog objects
- **Persistence**: AsyncStorage (local device only)

## Key Components

### useWaterTracking Hook
Location: `client/src/hooks/useWaterTracking.ts`

Manages water state and persistence. Returns:
- `todayTotal` — Current day's total in ml (clamped to 0+)
- `todayLogs` — Array of WaterLog for today
- `waterGoal` — Daily goal in ml (default 2000)
- `loading` — Initial async load state
- `addWater(amountMl)` — Logs positive entry
- `removeWater(amountMl)` — Logs negative entry
- `deleteWaterLog(id)` — Removes a specific log
- `refresh()` — Reload from storage

Uses optimistic updates: state changes immediately, storage save is fire-and-forget with error suppression.

### WaterModal Component
Location: `client/src/components/WaterModal.tsx`

Animated press-and-hold modal with:
- **Dual-layer wave animation**: Back wave (slow, broad) + front wave (fast, sharp) for depth
- **Lerp-based fill transitions**: Smooth interpolation of water level using `FILL_LERP_SPEED = 4`
- **Hold-to-fill**: Press center fill area, increment every 100ms (+50ml per tick)
- **Hold-to-drain**: Press Undo button, decrement every 100ms (-50ml per tick)
- **Amplitude modulation**: Wave amplitude increases 2.2x during hold for visual feedback
- **Pending preview**: Shows +/- amount before commit
- **Undo button**: Disabled when currentMl = 0 or no pending removal

Wave paths use composite sine layers (3 back + 4 front) sampled every 6 pixels for smooth rendering.

### WaterProgressCard Component
Location: `client/src/components/WaterProgressCard.tsx`

MyDay screen card displaying:
- Water icon (Ionicons "water")
- Current / goal in ml
- Percentage completion
- Progress bar (progress-native ProgressBar)
- Theme-aware colors

## Theme Integration

Water tracking uses three dedicated color tokens in `client/src/theme/colors.ts`:
- `waterFill` — Primary wave/icon color (#3B82F6 light, #60A5FA dark)
- `waterFillDeep` — Back wave layer, darker blue (#2563EB light, #3B82F6 dark)
- `waterFillBg` — Wave background fill (#DBEAFE light, #1E3A5F dark)

## Meal Type Separation

Water is a distinct `MealTypeKey` but excluded from food entries. `client/src/services/constants/mealTypes.ts` provides:
- `FoodMealTypeKey` — Union type excluding "water"
- `FOOD_MEAL_TYPE_KEYS` — Array for UI selectors (breakfast, lunch, dinner, snacks)
- `MEAL_TYPE_KEYS` — All types including water (for type narrowing)

This prevents water logs from appearing in AddMeal flows and meal analytics.

## Integration

### MyDay Screen
- `WaterProgressCard` renders water goal progress
- Pressing card opens `WaterModal` via modal state
- Hook passed with user's goal from stored `UserGoal.waterMl`

### MyPath Screen
- FAB (Floating Action Button) opens `WaterModal`
- Users can adjust water intake from analytics view

### Screen Files
- `client/src/screens/MyDayScreen.tsx` — Card + modal wiring
- `client/src/screens/MyPath/MyPathScreen.tsx` — FAB integration

## Key Files

| File | Purpose |
|------|---------|
| `client/src/hooks/useWaterTracking.ts` | Hook: state management, persistence, calculations |
| `client/src/hooks/useWaterTracking.test.tsx` | 13 tests covering add, remove, delete, refresh, clamping |
| `client/src/components/WaterModal.tsx` | Animated modal with dual-layer wave, press-and-hold |
| `client/src/components/__tests__/WaterModal.test.tsx` | 10 tests for hold interactions, animation, undo |
| `client/src/components/WaterProgressCard.tsx` | Progress card for MyDay display |
| `client/src/components/__tests__/WaterProgressCard.test.tsx` | 6 tests for rendering and press |
| `client/src/models/types.ts` | `WaterLog` type definition |
| `client/src/services/constants/mealTypes.ts` | `FoodMealTypeKey`, `FOOD_MEAL_TYPE_KEYS` |
| `client/src/storage/storage.ts` | `loadWaterLogs`, `saveWaterLogs` helpers |
| `client/src/theme/colors.ts` | `waterFill`, `waterFillDeep`, `waterFillBg` tokens |

## Technical Notes

- **Optimistic updates**: Hook updates state immediately, persists asynchronously
- **No backend sync**: Water logs are local-only (no `/v1/water` endpoints)
- **Daily scoping**: Uses client-local `YYYY-MM-DD` from `new Date().toISOString()`
- **Negative amounts**: Support removals without deletion (audit trail preserved)
- **Total clamping**: `todayTotal` is `Math.max(0, sum)` (prevents display of negative totals)
- **Animation smoothing**: Lerp interpolation with 4x speed factor for natural fill transitions
- **Wave rendering**: 50-point SVG path sampled from composite sine waves (no rasterization)
