---
type: api
status: current
last-updated: 2026-03-15
related-features:
  - food-tracking
  - goal-system
---

# Stats API

Prefix: `/v1/stats` | Auth: Bearer token required

Aggregated nutrition statistics derived from food entries.

## Endpoints

### `GET /v1/stats/day/{day}`

Macro totals for a specific day, broken down by meal type.

**Path params:** `day` (date, YYYY-MM-DD)

**Response** `200 OK` — `DayStatsResponse`

Returns `totals` (MacroTotals for the whole day) and `by_meal_type` (partial record mapping each meal type to its MacroTotals — only meal types with entries are included).

### `GET /v1/stats/daily`

Daily macro totals for a date range.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | `date` | yes | Start day (inclusive) |
| `to` | `date` | yes | End day (inclusive) |

**Response** `200 OK` — `DailyStatsResponse` with `points[]` (one per day in range, including days with zero data)

### `GET /v1/stats/weight`

Weight history for a date range.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | `date` | yes | Start day (inclusive) |
| `to` | `date` | yes | End day (inclusive) |

**Response** `200 OK` — `WeightStatsResponse` with `points[]` (day + weight_kg)

## Schemas

**MacroTotalsResponse**: `calories`, `protein`, `carbs`, `fat` (all Decimal as strings)

**DayStatsResponse**: `day`, `totals` (MacroTotals), `by_meal_type` (dict[MealType, MacroTotals])

**DailyStatsResponse**: `from_day`, `to_day`, `points[]` (day + totals)

**WeightStatsResponse**: `from_day`, `to_day`, `points[]` (day + weight_kg)

## Key Files

- `backend/app/features/stats/router.py` — Router
- `backend/app/features/stats/service.py` — Aggregation queries
- `backend/app/features/stats/calculation.py` — Macro calculation logic
- `backend/app/features/stats/schemas.py` — Pydantic schemas
