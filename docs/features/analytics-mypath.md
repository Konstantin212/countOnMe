---
type: feature
status: current
last-updated: 2026-03-19
related-features:
  - goal-system
  - food-tracking
---

# MyPath Analytics Screen

The **MyPath** tab is a comprehensive analytics dashboard that visualizes progress toward weight and nutrition goals using charts, trend indicators, and consistency metrics.

## Overview

MyPath displays five main insights:
- **Goal Progress Card** — Current vs. target weight with delta and progress percentage
- **Weight Trend** — Line chart of weight entries with target and healthy range bands
- **Calorie Trend** — Bar chart of daily calorie consumption vs. goal
- **Macro Adherence** — Average protein/carbs/fat over the period as percentage of goal
- **Consistency Metrics** — Current streak, longest streak, and total tracked days

All data is scoped to a **period selector** (7d, 30d, 90d). Charts use theme-aware colors and respond to light/dark mode. The screen supports pull-to-refresh to manually reload all data.

## Hooks Used

### useGoal
Returns the current `UserGoal` (null if not set). Used to:
- Detect if a goal exists (show CTA to set up if not)
- Get calorie target, macro breakdown, target weight, healthy weight range
- Derive pace badge (ahead/on_track/behind) via `deriveGoalPace()`

See `docs/features/goal-system.md` for full interface.

### useBodyWeight
Returns array of `BodyWeightEntry[]` sorted chronologically. Used to:
- Populate weight chart data
- Calculate weight delta (lost/remaining/% complete) via `calculateWeightDelta()`
- Derive pace via `deriveGoalPace()`
- Get latest weight for display

### useStatsRange
Returns `DailyStatsPoint[]` for the selected period (7d/30d/90d). Triggered by period selector. Points contain `day`, `calories`, `protein`, `carbs`, `fat`. Used to:
- Populate calorie trend bars
- Calculate macro adherence via `calculateMacroAdherence()`
- Calculate streak via `calculateStreak()`

### useTheme
Used throughout for color tokens: `colors.primary`, `colors.success`, `colors.warning`, `colors.chartLine`, `colors.macroProtein`, etc.

## Period Selector

Three buttons at top of scroll: **7 Days**, **30 Days**, **90 Days**. Active button styled with `colors.primary` background; inactive with border. Pressing a button calls `setPeriod()` on `useStatsRange`, which refetches stats and re-renders all dependent charts.

## Card Components

### GoalProgressCard
**Props**: `goal`, `weightDelta`, `pace`, `latestWeight`, `onSetupGoal`

**Empty state** (no goal): Shows "Set a goal to track your path" message with "Set Up Goal" button. Button navigates to ProfileTab/GoalSetup.

**Manual goal** (calculated goal without weight tracking): Shows only daily calorie target.

**Calculated goal with weight tracking**: Renders:
- Pace badge (top-right) color-coded: ahead (green), on_track (blue), behind (orange), no_data (gray)
- Weight flow: `current kg → target kg`
- Weight delta: Lost/Gained in kg
- Remaining distance: kg to target or "Goal reached!"
- Progress bar: `0–100%` fill based on `percentComplete`

### WeightChart
**Props**: `weights` array, `targetWeight`, `healthyMin`, `healthyMax`

Renders line chart (react-native-gifted-charts) with:
- X-axis: date labels (MM-DD format)
- Y-axis: weight in kg, auto-scaled with 2 kg buffer above/below min/max
- Data points at each weight entry
- Dashed reference line for target weight (green, labeled "Target: X kg")
- Two dashed bands for healthy range (min/max, labeled, gray-ish)
- Grid lines for readability

Empty state: "Log your first weight to see your trend" if no entries.

### CalorieTrendBars
**Props**: `dailyStats` array, `calorieGoal`

Renders bar chart with:
- X-axis: weekday abbreviations (Mon, Tue, etc.)
- Y-axis: calories consumed, auto-scaled
- Bars: green (under goal) or orange (over goal)
- Dashed reference line for calorie goal (labeled)
- Grid lines

Empty state: "Start tracking meals to see your calorie trend" if no entries.

### MacroAdherenceCard
**Props**: `adherence` (MacroAdherence), `goal` (UserGoal)

Renders three rows (one per macro):
- **Protein**: bar from 0–100%+ (consumed/goal in grams), color `colors.macroProtein`
- **Carbs**: bar from 0–100%+ (consumed/goal in grams), color `colors.macroCarb`
- **Fat**: bar from 0–100%+ (consumed/goal in grams), color `colors.macroFat`

Each row shows: `Protein | X / Y g (Z%)`

Adherence = average daily macro / daily goal macro. Over 100% if user exceeded goal.

Empty state (no goal): "Set a goal to track macros"

### StreaksCard
**Props**: `streak` (StreakInfo)

Three metrics side-by-side in large text:
- **Current Streak**: days in a row with logged meals
- **Longest Streak**: longest consecutive streak ever
- **Total Tracked**: total days with any logged meals

## Derived Data

All derived metrics come from `/client/src/services/utils/insights.ts`:

### calculateStreak(trackedDays, today?)
```
(trackedDays: string[], today?: string) -> StreakInfo
```
Returns `{ currentStreak, longestStreak, totalTrackedDays }`. Handles gaps in data; current streak ends if today or yesterday not tracked. Sorted and deduplicated input.

### calculateMacroAdherence(points, goal)
```
(points: DailyStatsPoint[], goal: UserGoal) -> MacroAdherence
```
Returns `{ protein, carbs, fat }` as ratios (0.0–2.0+). Divides average daily macro by goal macro. Returns 0 for all if goal macros are 0.

### deriveGoalPace(weights, goal)
```
(weights: BodyWeightEntry[], goal: UserGoal) -> GoalPace
```
Returns one of: `"ahead"`, `"on_track"`, `"behind"`, `"no_data"`. Compares actual weekly rate of weight change to expected rate (based on goal pace: slow 0.25 kg/wk, moderate 0.5 kg/wk, aggressive 1.0 kg/wk). For loss goals, checks if losing; for gain goals, checks if gaining. For maintain, allows 1 kg deviation.

### calculateWeightDelta(weights, goal)
```
(weights: BodyWeightEntry[], goal: UserGoal) ->
  { lost, remaining, percentComplete } | null
```
Returns null if no weights or no target weight. `lost` = first weight minus last weight (positive = lost). `remaining` = distance to target (positive = still to go). `percentComplete` = (progress / total journey) * 100.

### getDateRange(period, today?)
```
(period: StatsPeriod) -> { from, to }
```
Helper. Returns YYYY-MM-DD strings spanning last 7/30/90 days inclusive.

## Loading & Refresh

**Initial load**: All three hooks (`useGoal`, `useBodyWeight`, `useStatsRange`) set `loading=true`. Screen shows centered `ActivityIndicator` while any is loading. Once all resolve, scroll view renders.

**Pull-to-refresh**: `RefreshControl` at top of scroll view. Pressing triggers `handleRefresh()`, which calls `Promise.all([refreshGoal(), refreshWeights(), refreshStats()])`. All three hooks fetch from API (or local storage on offline).

**Auto-refresh on focus**: Not implemented; period change triggers auto-fetch via `useStatsRange` effect.

## Navigation

### Cross-Tab Actions

**"Set Up Goal"** button (GoalProgressCard, when no goal):
- Navigates to ProfileTab/GoalSetup
- Uses `navigation.getParent<BottomTabNavigationProp>().navigate()`

**FAB Quick Actions**:
- **Add Meal** → MyDayTab/AddMeal
- **Add Product** → (stub, not implemented)
- **Add Water** → (stub, not implemented)
- **Scan Food** → (stub, not implemented)

FAB closes on blur/focus or tab press.

## Key Files

- `client/src/screens/MyPath/MyPathScreen.tsx` — Main screen layout, period selector, FAB
- `client/src/screens/MyPath/components/GoalProgressCard.tsx` — Progress display, pace badge, weight delta
- `client/src/screens/MyPath/components/WeightChart.tsx` — Line chart with target/healthy bands
- `client/src/screens/MyPath/components/CalorieTrendBars.tsx` — Bar chart with goal reference line
- `client/src/screens/MyPath/components/MacroAdherenceCard.tsx` — Macro progress bars
- `client/src/screens/MyPath/components/StreaksCard.tsx` — Consistency metrics
- `client/src/hooks/useStatsRange.ts` — Period-based daily stats fetching
- `client/src/hooks/useBodyWeight.ts` — Weight entry management
- `client/src/hooks/useGoal.ts` — Goal data + CRUD
- `client/src/services/utils/insights.ts` — Derived metrics (streak, pace, macro adherence, weight delta)
- `client/src/models/types.ts` — Type definitions (StreakInfo, MacroAdherence, GoalPace, DailyStatsPoint, BodyWeightEntry, UserGoal, StatsPeriod)
