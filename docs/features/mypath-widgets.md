---
type: feature
status: current
last-updated: 2026-04-05
related-features:
  - goal-system
  - food-tracking
  - water-tracking
  - fasting
  - analytics-mypath
---

# MyPath Widgets Dashboard

The **MyPath** tab is a comprehensive analytics dashboard composed of interactive widgets that visualize progress toward weight and nutrition goals, hydration, and fasting sessions.

## Overview

MyPath displays seven widgets arranged in a responsive grid:
- **WeightMetricWidget** — Current weight, trend direction, period-based line chart (1W/1M/3M)
- **EtaTrajectoryWidget** — Projected goal completion date, progress bar, on-track indicator
- **EfficiencyWidget** — Metabolic rate deviation: this week vs. last week average calories
- **ConsistencyWidget** — 4-week heatmap grid showing daily protein and calorie compliance
- **HydrationWidget** — Today's water intake vs. goal (non-interactive display)
- **FastingWidget** — Active fasting session timer with countdown, clickable to navigate to fasting flow
- **ActiveCalWidget** — Placeholder for future active calories integration

All widgets render null/empty states when data is missing. Pull-to-refresh reloads all data. FAB actions include "Log weight" (opens AddWeightModal) and "Start fast" (navigates to FastingSetup).

## Widget Data Flow

### Pure Calculation Functions

All widget data derives from functions in `client/src/services/utils/insights.ts`. These are deterministic, dependency-free pure functions with no side effects:

**Weight Metrics:**
- `calculateWeightTrend(weights, period)` → `{ direction, changeKg, changePercent, dataPoints }`
  - Direction: `"up"` | `"down"` | `"stable"` (threshold: 0.3 kg)
  - Filters weights by period (7d/30d/90d) and sorts chronologically

**Goal Projection:**
- `calculateETA(weights, goal)` → `{ targetDate, daysRemaining, progressPercent, isOnTrack }`
  - Requires 7+ days of weight data for projection
  - Projects daily weight change rate forward to goal weight
  - Returns null dates if not on track (wrong direction)

**Efficiency Metrics:**
- `calculateEfficiency(dailyStats, goal)` → `{ deviationPercent, direction, avgCaloriesThisWeek, avgCaloriesLastWeek }`
  - Compares last 7 days to prior 7 days
  - Direction: `"on_target"` | `"over"` | `"under"` (threshold: ±5% deviation)

**Consistency Tracking:**
- `calculateConsistency(dailyStats, goal)` → `{ score, weeks, avgIntake7d }`
  - Scores days with BOTH protein (≥80% goal) AND calorie (±15% tolerance) hits
  - Builds 4-week grid (oldest week first) with per-day boolean flags (`proteinHit`, `calorieHit`)
  - Score: `(days with both hits / days with any data) * 100`

### Hook Integration

Screen imports and uses three hooks to feed widgets:
- `useGoal()` → `{ goal, loading, refresh }` — provides nutrition targets, target weight, water goal
- `useBodyWeight()` → `{ weights, loading, refresh, logWeight }` — provides weight entries and weight logging
- `useStatsRange()` → `{ dailyStats, loading, refresh }` — provides daily stats (calories, protein, carbs, fat) for all periods
- `useFasting()` → `{ activeSession, refresh }` — provides active fasting session or null

Data flows: hooks fetch/cache → screen calls calculation functions → screen passes derived data to widgets.

## Widgets

### WeightMetricWidget
Displays weight trend with period selector (1W/1M/3M). Shows trend icon, change magnitude, and line chart. Empty state if fewer than 2 entries.

### EtaTrajectoryWidget
Shows goal completion projection with progress bar, target date, and on-track indicator. Empty state if no goal or insufficient data.

### EfficiencyWidget
Compares last 7 days vs. prior 7 days. Shows deviation percentage with color-coded direction (green: on-target, red/orange: over/under). Empty state if either week has no data.

### ConsistencyWidget
Shows 4-week compliance heatmap (rows=weeks, cols=days). Each cell colored by protein+calorie hit status: green (both), yellow (one), red (none), gray (no data). Displays score (0–100%) and 7-day average.

### HydrationWidget
Non-clickable donut chart showing today's water intake vs. goal (mL). Water logging via FAB action.

### FastingWidget
Displays active fasting session with timestamp-based countdown timer (HH:MM:SS, survives backgrounding). Tap to navigate to FastingScreen or FastingSetup. Shows session technique, elapsed/remaining time, completion status.

### ActiveCalWidget
Placeholder for future device activity integration. Static "Coming soon" display.

## Layout

**Order** (top to bottom): Header, WeightMetricWidget (full), ETA+Efficiency (row), ConsistencyWidget (full), Hydration+Fasting (row), ActiveCal (full). Gap: 12 pts, padding: 16 pts.

## FAB Actions

Quick-access menu: Add meal, Add product, Add water, Scan food, Log weight, Start fast. Closes on blur, focus, or backdrop tap.

## Theme Integration

**Color Tokens Used:**
- `colors.background` — Card backgrounds
- `colors.primary` — Active buttons, on-track indicators
- `colors.text` — Primary labels and titles
- `colors.success` — Weight down trend, consistency hits
- `colors.error` — Weight up trend, efficiency over, off-track
- `colors.waterFill` / `colors.waterFillBg` — Hydration meter
- `colors.fastingAccent` / `colors.fastingBg` — Fasting session display
- `colors.heatmapHit` / `colors.heatmapPartial` / `colors.heatmapMiss` / `colors.heatmapEmpty` — Consistency grid cells
- `colors.efficiencyPositive` / `colors.efficiencyNegative` — Efficiency directional colors

All widgets respond to light/dark theme mode automatically via `useTheme()`.

## Loading & Refresh

**Initial Load**: Displays spinner while hooks load. **Pull-to-Refresh**: Reloads all hook data via `Promise.all([refreshGoal(), refreshWeights(), refreshStats(), refreshFasting()])`. No auto-refresh on focus.

## Key Files

- `client/src/screens/MyPath/MyPathScreen.tsx` — Main screen, hooks, FAB, widget layout
- `client/src/screens/MyPath/components/WeightMetricWidget.tsx` — Weight trend display with period selector
- `client/src/screens/MyPath/components/EtaTrajectoryWidget.tsx` — Goal ETA projection
- `client/src/screens/MyPath/components/EfficiencyWidget.tsx` — Metabolic efficiency vs. last week
- `client/src/screens/MyPath/components/ConsistencyWidget.tsx` — 4-week compliance heatmap
- `client/src/screens/MyPath/components/HydrationWidget.tsx` — Water intake progress
- `client/src/screens/MyPath/components/FastingWidget.tsx` — Active fasting session timer
- `client/src/screens/MyPath/components/ActiveCalWidget.tsx` — Placeholder for active calories
- `client/src/screens/MyPath/components/AddWeightModal.tsx` — Modal for logging weight entries
- `client/src/services/utils/insights.ts` — Pure calculation functions (calculateWeightTrend, calculateETA, calculateEfficiency, calculateConsistency)
- `client/src/models/types.ts` — Type definitions (WeightTrend, EtaProjection, EfficiencyResult, ConsistencyResult, etc.)
- `client/src/theme/colors.ts` — Theme color tokens (heatmap, fasting, efficiency, water colors)
- `client/src/hooks/useGoal.ts` — Goal data fetching and caching
- `client/src/hooks/useBodyWeight.ts` — Weight entry management and logging
- `client/src/hooks/useStatsRange.ts` — Daily stats with period selection
- `client/src/hooks/useFasting.ts` — Fasting session management
- `client/src/hooks/useWaterTracking.ts` — Water intake tracking
