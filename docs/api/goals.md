---
type: api
status: current
last-updated: 2026-03-14
related-features:
  - goal-system
---

# Goals API

Prefix: `/v1/goals` | Auth: Bearer token required

A device can have at most one active goal. Creating a new goal soft-deletes existing ones.

## Endpoints

### `POST /v1/goals/calculate`

Preview BMR/TDEE/target calculations without saving.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `gender` | `Gender` | yes | For BMR formula |
| `birth_date` | `date` | yes | Age 13-120 |
| `height_cm` | `Decimal` | yes | 0 < x <= 300 |
| `current_weight_kg` | `Decimal` | yes | 0 < x <= 500 |
| `activity_level` | `ActivityLevel` | yes | |
| `weight_goal_type` | `WeightGoalType` | yes | |
| `target_weight_kg` | `Decimal` | no | Required for lose/gain |
| `weight_change_pace` | `WeightChangePace` | no | Required for lose/gain |

**Response** `200 OK` — `GoalCalculateResponse` (bmr_kcal, tdee_kcal, daily_calories_kcal, macro percents/grams, water_ml, BMI data)

### `GET /v1/goals/current`

Get active goal. Returns `null` if none. **Response** `200 OK`

### `GET /v1/goals/{goal_id}`

Get goal by ID. **Errors:** `404`

### `POST /v1/goals/calculated`

Create goal from body metrics. Inherits calculate fields plus optional `id`, macro percent overrides, `water_ml` override. If all three macro percents provided, must sum to 100.

**Response** `201 Created` — `GoalResponse`

### `POST /v1/goals/manual`

Create manual goal with direct targets.

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `daily_calories_kcal` | `int` | yes | 1-10000 |
| `protein_percent` | `int` | yes | 0-100 |
| `carbs_percent` | `int` | yes | 0-100 |
| `fat_percent` | `int` | yes | 0-100 |
| `water_ml` | `int` | yes | 0-10000 |

Macro percents must sum to 100. **Response** `201 Created`

### `PATCH /v1/goals/{goal_id}`

Update goal targets. Optional: `daily_calories_kcal`, macro percents, `water_ml`.

### `DELETE /v1/goals/{goal_id}`

Soft-delete. **Response** `204 No Content`

## Schemas

**GoalResponse**: `id`, `goal_type`, body metrics (nullable for manual), calculated values (nullable for manual), `daily_calories_kcal`, macro percents/grams, `water_ml`, BMI data, timestamps

**GoalCalculateResponse**: `bmr_kcal`, `tdee_kcal`, `daily_calories_kcal`, macro percents/grams, `water_ml`, `healthy_weight_min/max_kg`, `current_bmi`, `bmi_category`

## Key Files

- `backend/app/features/goals/router.py` — Router
- `backend/app/features/goals/service.py` — Service (CRUD)
- `backend/app/features/goals/calculation.py` — BMR, TDEE, macro computation
- `backend/app/features/goals/models.py` — ORM model
- `backend/app/features/goals/schemas.py` — Pydantic schemas
