---
type: feature
status: current
last-updated: 2026-03-14
related-features:
  - food-tracking
  - sync-system
  - device-auth
---

# Goal System

## Overview

The goal system lets users set daily nutrition targets -- either by calculating them from body metrics (BMR/TDEE) or by entering values manually. Goals drive the progress indicators on the daily tracking screen, showing how much of each macro target has been consumed.

## Goal Types

### Calculated Goal

A calculated goal derives calorie and macro targets from the user's physical profile using established nutritional science formulas. The user provides:
- Gender (male/female)
- Birth date
- Height (cm)
- Current weight (kg)
- Activity level
- Weight goal (lose/maintain/gain)
- Weight change pace (for lose/gain goals)

The system then computes BMR, TDEE, target calories, macro distribution, water intake, BMI, and healthy weight range.

### Manual Goal

A manual goal lets users directly specify:
- Daily calories (kcal)
- Macro percentages (protein %, carbs %, fat %)
- Water intake (ml)

Macro grams are calculated from the percentages and calorie target.

## User Flows

### Calculated Goal Flow

1. **GoalSetupScreen** -- Choose between "Calculated" and "Manual" goal types
2. **GoalCalculatedScreen** -- Enter body metrics:
   - Gender selection
   - Birth date picker
   - Height (cm)
   - Weight (kg)
   - Activity level (5 options)
   - Weight goal (lose/maintain/gain)
   - Weight change pace (slow/moderate/aggressive, shown for lose/gain only)
3. **GoalCalculatedResultScreen** -- Preview the calculated results:
   - BMR and TDEE values
   - Daily calorie target
   - Macro distribution (protein/carbs/fat percentages and grams)
   - Water intake recommendation
   - BMI value with visual scale (BmiScale component)
   - Healthy weight range
4. On "Save", the goal is created via `POST /v1/goals/calculated`, stored locally, and enqueued for sync

### Manual Goal Flow

1. **GoalSetupScreen** -- Choose "Manual"
2. **GoalManualScreen** -- Enter targets directly:
   - Daily calories (kcal)
   - Protein, carbs, fat percentages (must sum to 100%)
   - Water intake (ml)
3. On "Save", the goal is created via `POST /v1/goals/manual`, stored locally, and enqueued for sync

## Calculation Engine

The backend calculation service lives in `backend/app/features/goals/calculation.py`. All formulas are pure functions with no database access.

### BMR (Basal Metabolic Rate)

Uses the **Mifflin-St Jeor** equation:
- Male: `BMR = (10 x weight_kg) + (6.25 x height_cm) - (5 x age) + 5`
- Female: `BMR = (10 x weight_kg) + (6.25 x height_cm) - (5 x age) - 161`

### TDEE (Total Daily Energy Expenditure)

`TDEE = BMR x Activity Multiplier`

| Activity Level | Multiplier | Description |
|----------------|------------|-------------|
| sedentary      | 1.2        | Little or no exercise |
| light          | 1.375      | Light exercise 1-3 days/week |
| moderate       | 1.55       | Moderate exercise 3-5 days/week |
| active         | 1.725      | Hard exercise 6-7 days/week |
| very_active    | 1.9        | Very intense exercise + physical job |

### Target Calories

Based on weight goal type:
- **Maintain:** Target = TDEE (no adjustment)
- **Lose:** Target = TDEE - deficit (based on pace)
- **Gain:** Target = TDEE + surplus (based on pace)

Deficit/surplus by pace:

| Pace       | Adjustment | Approximate Rate |
|------------|------------|------------------|
| slow       | 250 kcal   | ~0.25 kg/week   |
| moderate   | 500 kcal   | ~0.5 kg/week    |
| aggressive | 750 kcal   | ~0.75 kg/week   |

A minimum safe intake of 1200 kcal is enforced for weight loss goals.

### Macro Distribution

Default macro percentages vary by goal type:

| Goal     | Protein | Carbs | Fat |
|----------|---------|-------|-----|
| Lose     | 30%     | 35%   | 35% |
| Maintain | 25%     | 45%   | 30% |
| Gain     | 30%     | 45%   | 25% |

Gram conversion:
- Protein: `(calories x protein_%) / 400` (4 kcal/g)
- Carbs: `(calories x carbs_%) / 400` (4 kcal/g)
- Fat: `(calories x fat_%) / 900` (9 kcal/g)

### Water Intake

Recommended daily water: `weight_kg x 33 ml` (using 33 ml/kg as the middle of the 30-35 ml/kg range).

### BMI Calculation

`BMI = weight_kg / (height_m)^2`

| Category    | BMI Range   |
|-------------|-------------|
| underweight | < 18.5      |
| normal      | 18.5 - 24.9 |
| overweight  | 25.0 - 29.9 |
| obese       | >= 30.0     |

### Healthy Weight Range

Derived from BMI boundaries and the user's height:
- Minimum: `18.5 x (height_m)^2`
- Maximum: `24.9 x (height_m)^2`

## BMI Visualization

The **BmiScale** component renders a horizontal colored bar showing the four BMI categories (underweight, normal, overweight, obese) with the user's current BMI position indicated by a marker. The color scheme ranges from yellow (underweight) through green (normal) to orange (overweight) and red (obese).

## Hook: useGoal

Located in `client/src/hooks/useGoal.ts`. Provides offline-first goal management.

**State:** `goal` (UserGoal | null), `loading`, `error`

**Actions:**
- `refresh()` -- Loads from local storage first, then attempts to fetch from `GET /v1/goals/current`. If remote data is available, it overwrites local. If the backend is unreachable, the local goal is used.
- `calculateGoal(request)` -- Calls `POST /v1/goals/calculate` for a preview without saving
- `saveCalculatedGoal(request)` -- Calls `POST /v1/goals/calculated`, saves locally, enqueues sync
- `saveManualGoal(request)` -- Calls `POST /v1/goals/manual`, saves locally, enqueues sync
- `updateGoal(patch)` -- Calls `PATCH /v1/goals/{id}` to update targets (calories, macro percentages, water), saves locally, enqueues sync
- `deleteGoal()` -- Calls `DELETE /v1/goals/{id}`, clears local storage, enqueues sync

## Backend Endpoints

All endpoints require device authentication. See `docs/api/goals.md` for full schemas.

- `POST /v1/goals/calculate` -- Preview calculation (BMR, TDEE, macros, water, BMI, healthy range)
- `GET /v1/goals/current` -- Fetch active goal (returns `null` if none)
- `GET /v1/goals/{goal_id}` -- Get goal by ID
- `POST /v1/goals/calculated` -- Create calculated goal (soft-deletes existing)
- `POST /v1/goals/manual` -- Create manual goal (soft-deletes existing)
- `PATCH /v1/goals/{goal_id}` -- Update targets (calories, macro %, water)
- `DELETE /v1/goals/{goal_id}` -- Soft-delete goal

## Backend Data Model

The `user_goals` table stores identity (`id`, `device_id`), type (`goal_type`: "calculated" or "manual"), body metrics for calculated goals (`gender`, `birth_date`, `height_cm`, `current_weight_kg`, `activity_level`), targets shared by both types (`daily_calories_kcal`, protein/carbs/fat percent and grams, `water_ml`), and timestamps (`created_at`, `updated_at`, `deleted_at`). Only one active goal per device; creating a new goal soft-deletes existing ones.

## Local Storage

The goal is stored in AsyncStorage under `@countOnMe/goal/v1` as a JSON-serialized `UserGoal` object. The `loadGoal()`/`saveGoal()`/`clearGoal()` functions in the storage layer handle persistence.

## Key Files

- `client/src/screens/GoalFlow/GoalSetupScreen.tsx` -- Goal type selection (calculated vs. manual)
- `client/src/screens/GoalFlow/GoalCalculatedScreen.tsx` -- Body metrics input form
- `client/src/screens/GoalFlow/GoalCalculatedResultScreen.tsx` -- Preview and save calculated results
- `client/src/screens/GoalFlow/GoalManualScreen.tsx` -- Manual target entry form
- `client/src/screens/GoalFlow/components/BmiScale.tsx` -- BMI visualization component
- `client/src/hooks/useGoal.ts` -- Goal state management and sync
- `backend/app/features/goals/router.py` -- Goal API endpoints
- `backend/app/features/goals/service.py` -- Goal business logic and CRUD
- `backend/app/features/goals/calculation.py` -- Calculation engine (pure formulas)

## Related Features

- [Food Tracking](./food-tracking.md) -- Daily macro progress driven by active goal
- [Sync System](./sync-system.md) -- Goal mutations enqueued for remote sync
- [Device Auth](./device-auth.md) -- All goals scoped to authenticated device
