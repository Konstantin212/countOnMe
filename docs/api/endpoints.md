# CountOnMe API Reference

Base URL: `http://<host>:<port>`

All endpoints under `/v1` require Bearer token authentication unless noted otherwise.
The API uses snake_case for all request and response field names.

---

## Table of Contents

- [Authentication](#authentication)
- [Common Conventions](#common-conventions)
- [Enumerations](#enumerations)
- [Health](#health)
- [Devices](#devices)
- [Products](#products)
- [Portions](#portions)
- [Food Entries](#food-entries)
- [Goals](#goals)
- [Stats](#stats)
- [Body Weights](#body-weights)
- [Sync](#sync)

---

## Authentication

All endpoints except `GET /health` and `POST /v1/devices/register` require a Bearer token.

**Token format:** `{device_id}.{secret}`

Send as: `Authorization: Bearer {device_id}.{secret}`

**Verification flow:**
1. Parse `device_id` from the token (before the `.`)
2. Look up the device row by `device_id`
3. Compare `SHA-256(secret + pepper)` against the stored `token_hash`
4. Update `devices.last_seen_at` on success

**Error responses:**

| Status | Meaning |
|--------|---------|
| `401` | Missing, malformed, or invalid token |
| `403` | Device revoked |
| `404` | Resource not found **or** belongs to a different device (cross-device access) |

---

## Common Conventions

- **IDs**: All entity IDs are UUIDs (v4).
- **Timestamps**: ISO 8601 format with timezone (e.g., `2025-06-15T12:30:00Z`).
- **Decimals**: Serialized as strings in JSON responses to preserve precision.
- **Dates**: `YYYY-MM-DD` format (e.g., `2025-06-15`).
- **Soft deletes**: DELETE endpoints set a `deleted_at` timestamp rather than removing the row. Deleted records are filtered out of all list/get queries.
- **Device scoping**: All data is scoped to the authenticated device. Attempting to access another device's data returns `404`.
- **Validation errors**: `422 Unprocessable Entity` with Pydantic error details.

---

## Enumerations

### Unit

| Value | Description |
|-------|-------------|
| `mg` | Milligrams |
| `g` | Grams |
| `kg` | Kilograms |
| `ml` | Milliliters |
| `l` | Liters |
| `tsp` | Teaspoons |
| `tbsp` | Tablespoons |
| `cup` | Cups |

### MealType

| Value |
|-------|
| `breakfast` |
| `lunch` |
| `dinner` |
| `snacks` |
| `water` |

### GoalType

| Value | Description |
|-------|-------------|
| `calculated` | Derived from body metrics (BMR/TDEE) |
| `manual` | Directly entered by user |

### Gender

| Value |
|-------|
| `male` |
| `female` |

### ActivityLevel

| Value | TDEE Multiplier |
|-------|-----------------|
| `sedentary` | 1.2 |
| `light` | 1.375 |
| `moderate` | 1.55 |
| `active` | 1.725 |
| `very_active` | 1.9 |

### WeightGoalType

| Value |
|-------|
| `lose` |
| `maintain` |
| `gain` |

### WeightChangePace

| Value | Approximate Rate |
|-------|------------------|
| `slow` | ~0.25 kg/week (-250 kcal/day) |
| `moderate` | ~0.5 kg/week (-500 kcal/day) |
| `aggressive` | ~0.75 kg/week (-750 kcal/day) |

---

## Health

### `GET /health`

Health check. No authentication required.

**Response** `200 OK`

```json
{
  "ok": true
}
```

---

## Devices

Tag: `devices` | Prefix: `/v1/devices`

### `POST /v1/devices/register`

Register or re-register a device. Always issues a fresh token. No authentication required.

Rate limited: 10 requests per minute per client IP (sliding window).

Uses `SELECT ... FOR UPDATE` internally to prevent race conditions on concurrent registrations for the same `device_id`.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_id` | `UUID` | yes | Client-generated device identifier |

```json
{
  "device_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response** `200 OK`

| Field | Type | Description |
|-------|------|-------------|
| `device_id` | `UUID` | The registered device ID |
| `device_token` | `string` | Bearer token for subsequent requests (`{device_id}.{secret}`) |

```json
{
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_token": "550e8400-e29b-41d4-a716-446655440000.abc123secretxyz"
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| `409` | Registration conflict (concurrent race that could not be resolved) |
| `422` | Invalid `device_id` format |
| `429` | Rate limit exceeded |

---

## Products

Tag: `products` | Prefix: `/v1/products` | Auth: Bearer token required

### `GET /v1/products`

List all products for the authenticated device. Soft-deleted products are excluded.

**Response** `200 OK` -- `ProductResponse[]`

```json
[
  {
    "id": "...",
    "name": "Chicken breast",
    "created_at": "2025-06-15T12:00:00Z",
    "updated_at": "2025-06-15T12:00:00Z"
  }
]
```

### `POST /v1/products`

Create a new product.

**Request body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | `UUID` | no | | Client-generated ID (server generates one if omitted) |
| `name` | `string` | yes | 1-200 chars | Product name |

```json
{
  "name": "Chicken breast"
}
```

**Response** `201 Created` -- `ProductResponse`

### `GET /v1/products/{product_id}`

Get a single product by ID.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `product_id` | `UUID` | Product ID |

**Response** `200 OK` -- `ProductResponse`

**Errors:** `404` if not found or belongs to another device.

### `PATCH /v1/products/{product_id}`

Update a product.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `product_id` | `UUID` | Product ID |

**Request body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `name` | `string` | no | 1-200 chars | New product name |

**Response** `200 OK` -- `ProductResponse`

**Errors:** `404` if not found or belongs to another device.

### `DELETE /v1/products/{product_id}`

Soft-delete a product (sets `deleted_at`).

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `product_id` | `UUID` | Product ID |

**Response** `204 No Content`

**Errors:** `404` if not found or belongs to another device.

### ProductResponse

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID` | Product ID |
| `name` | `string` | Product name |
| `created_at` | `datetime` | Creation timestamp (ISO 8601) |
| `updated_at` | `datetime` | Last update timestamp (ISO 8601) |

---

## Portions

Tag: `portions` | Auth: Bearer token required

Portions are nested under products for creation and listing, but accessed directly by `portion_id` for get/update/delete.

### `GET /v1/products/{product_id}/portions`

List all portions for a product. Soft-deleted portions are excluded.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `product_id` | `UUID` | Parent product ID |

**Response** `200 OK` -- `PortionResponse[]`

### `POST /v1/products/{product_id}/portions`

Create a new portion for a product.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `product_id` | `UUID` | Parent product ID |

**Request body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `label` | `string` | yes | 1-200 chars | Portion label (e.g., "100g", "1 cup") |
| `base_amount` | `Decimal` | yes | > 0 | Base serving amount |
| `base_unit` | `Unit` | yes | | Unit of measurement |
| `calories` | `Decimal` | yes | >= 0 | Calories per base amount |
| `protein` | `Decimal` | no | >= 0 | Protein grams per base amount |
| `carbs` | `Decimal` | no | >= 0 | Carbs grams per base amount |
| `fat` | `Decimal` | no | >= 0 | Fat grams per base amount |
| `is_default` | `bool` | no | default: `false` | Mark as default portion for product |

```json
{
  "label": "100g",
  "base_amount": "100",
  "base_unit": "g",
  "calories": "165",
  "protein": "31",
  "carbs": "0",
  "fat": "3.6",
  "is_default": true
}
```

**Response** `201 Created` -- `PortionResponse`

**Errors:** `404` if parent product not found or belongs to another device.

### `GET /v1/portions/{portion_id}`

Get a single portion by ID.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `portion_id` | `UUID` | Portion ID |

**Response** `200 OK` -- `PortionResponse`

**Errors:** `404` if not found or belongs to another device.

### `PATCH /v1/portions/{portion_id}`

Update a portion. All fields are optional; only provided fields are updated.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `portion_id` | `UUID` | Portion ID |

**Request body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `label` | `string` | no | 1-200 chars | Portion label |
| `base_amount` | `Decimal` | no | > 0 | Base serving amount |
| `base_unit` | `Unit` | no | | Unit of measurement |
| `calories` | `Decimal` | no | >= 0 | Calories per base amount |
| `protein` | `Decimal` | no | >= 0 | Protein grams |
| `carbs` | `Decimal` | no | >= 0 | Carbs grams |
| `fat` | `Decimal` | no | >= 0 | Fat grams |
| `is_default` | `bool` | no | | Mark as default portion |

**Response** `200 OK` -- `PortionResponse`

**Errors:** `404` if not found. `409` on conflict (e.g., business rule violation).

### `DELETE /v1/portions/{portion_id}`

Soft-delete a portion.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `portion_id` | `UUID` | Portion ID |

**Response** `204 No Content`

**Errors:** `404` if not found. `409` on conflict (e.g., portion is referenced by food entries).

### PortionResponse

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID` | Portion ID |
| `product_id` | `UUID` | Parent product ID |
| `label` | `string` | Portion label |
| `base_amount` | `Decimal` | Base serving amount (string in JSON) |
| `base_unit` | `Unit` | Unit of measurement |
| `calories` | `Decimal` | Calories per base amount (string in JSON) |
| `protein` | `Decimal?` | Protein grams (nullable) |
| `carbs` | `Decimal?` | Carbs grams (nullable) |
| `fat` | `Decimal?` | Fat grams (nullable) |
| `is_default` | `bool` | Whether this is the default portion |
| `created_at` | `datetime` | Creation timestamp |
| `updated_at` | `datetime` | Last update timestamp |

---

## Food Entries

Tag: `food-entries` | Prefix: `/v1/food-entries` | Auth: Bearer token required

### `GET /v1/food-entries`

List food entries for the authenticated device with optional date filters.

**Query parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `day` | `date` | no | Filter by exact day (`YYYY-MM-DD`) |
| `from` | `date` | no | Filter entries from this day (inclusive) |
| `to` | `date` | no | Filter entries up to this day (inclusive) |

All filters are optional and can be combined. If none are provided, all entries are returned.

**Response** `200 OK` -- `FoodEntryResponse[]`

### `POST /v1/food-entries`

Create a new food entry.

**Request body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `product_id` | `UUID` | yes | | Product this entry refers to |
| `portion_id` | `UUID` | yes | | Portion to use for nutrient calculation |
| `day` | `date` | yes | `YYYY-MM-DD` | Client-local calendar day |
| `meal_type` | `MealType` | yes | | Meal category |
| `amount` | `Decimal` | yes | > 0 | Quantity consumed |
| `unit` | `Unit` | yes | | Unit of the amount |

```json
{
  "product_id": "...",
  "portion_id": "...",
  "day": "2025-06-15",
  "meal_type": "lunch",
  "amount": "150",
  "unit": "g"
}
```

**Response** `201 Created` -- `FoodEntryResponse`

**Errors:** `404` if product or portion not found / belongs to another device.

### `GET /v1/food-entries/{entry_id}`

Get a single food entry by ID.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `entry_id` | `UUID` | Food entry ID |

**Response** `200 OK` -- `FoodEntryResponse`

**Errors:** `404` if not found or belongs to another device.

### `PATCH /v1/food-entries/{entry_id}`

Update a food entry. Only provided fields are updated.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `entry_id` | `UUID` | Food entry ID |

**Request body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `portion_id` | `UUID` | no | | New portion ID |
| `meal_type` | `MealType` | no | | New meal category |
| `amount` | `Decimal` | no | > 0 | New amount |
| `unit` | `Unit` | no | | New unit |

**Response** `200 OK` -- `FoodEntryResponse`

**Errors:** `404` if not found or belongs to another device.

### `DELETE /v1/food-entries/{entry_id}`

Soft-delete a food entry.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `entry_id` | `UUID` | Food entry ID |

**Response** `204 No Content`

**Errors:** `404` if not found or belongs to another device.

### FoodEntryResponse

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID` | Entry ID |
| `product_id` | `UUID` | Associated product |
| `portion_id` | `UUID` | Associated portion |
| `day` | `date` | Calendar day (`YYYY-MM-DD`) |
| `meal_type` | `MealType` | Meal category |
| `amount` | `Decimal` | Quantity (string in JSON) |
| `unit` | `Unit` | Unit of measurement |
| `created_at` | `datetime` | Creation timestamp |
| `updated_at` | `datetime` | Last update timestamp |

---

## Goals

Tag: `goals` | Prefix: `/v1/goals` | Auth: Bearer token required

Goals represent daily nutrition targets. A device can have at most one active goal at a time. Creating a new goal soft-deletes any existing goals.

### `POST /v1/goals/calculate`

Preview BMR/TDEE/target calculations without saving. Use this to show the user computed values before they confirm.

**Request body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `gender` | `Gender` | yes | | Biological gender for BMR formula |
| `birth_date` | `date` | yes | Age 13-120 | Date of birth |
| `height_cm` | `Decimal` | yes | 0 < x <= 300 | Height in centimeters |
| `current_weight_kg` | `Decimal` | yes | 0 < x <= 500 | Current weight in kilograms |
| `activity_level` | `ActivityLevel` | yes | | Physical activity level |
| `weight_goal_type` | `WeightGoalType` | yes | | lose / maintain / gain |
| `target_weight_kg` | `Decimal` | no | 0 < x <= 500 | Target weight (required for lose/gain) |
| `weight_change_pace` | `WeightChangePace` | no | | Pace of change (required for lose/gain) |

**Validation rules:**
- `target_weight_kg` and `weight_change_pace` are required when `weight_goal_type` is `lose` or `gain`.
- `birth_date` must indicate age between 13 and 120 years.

```json
{
  "gender": "male",
  "birth_date": "1990-05-20",
  "height_cm": "180",
  "current_weight_kg": "85",
  "activity_level": "moderate",
  "weight_goal_type": "lose",
  "target_weight_kg": "78",
  "weight_change_pace": "moderate"
}
```

**Response** `200 OK` -- `GoalCalculateResponse`

| Field | Type | Description |
|-------|------|-------------|
| `bmr_kcal` | `int` | Basal Metabolic Rate |
| `tdee_kcal` | `int` | Total Daily Energy Expenditure |
| `daily_calories_kcal` | `int` | Recommended daily calorie target |
| `protein_percent` | `int` | Protein % of total calories |
| `carbs_percent` | `int` | Carbs % of total calories |
| `fat_percent` | `int` | Fat % of total calories |
| `protein_grams` | `int` | Daily protein in grams |
| `carbs_grams` | `int` | Daily carbs in grams |
| `fat_grams` | `int` | Daily fat in grams |
| `water_ml` | `int` | Daily water intake in ml |
| `healthy_weight_min_kg` | `float` | Lower bound of healthy BMI weight range |
| `healthy_weight_max_kg` | `float` | Upper bound of healthy BMI weight range |
| `current_bmi` | `float` | Current Body Mass Index |
| `bmi_category` | `string` | BMI category label |

### `GET /v1/goals/current`

Get the current active goal for this device.

**Response** `200 OK` -- `GoalResponse | null`

Returns `null` (JSON `null`) if no active goal exists.

### `GET /v1/goals/{goal_id}`

Get a specific goal by ID.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `goal_id` | `UUID` | Goal ID |

**Response** `200 OK` -- `GoalResponse`

**Errors:** `404` if not found or belongs to another device.

### `POST /v1/goals/calculated`

Create a goal from body metrics (calculated). Soft-deletes any existing goals for this device.

**Request body:**

Inherits all fields from the calculate request, plus:

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | `UUID` | no | | Client-generated goal ID |
| `gender` | `Gender` | yes | | Biological gender |
| `birth_date` | `date` | yes | Age 13-120 | Date of birth |
| `height_cm` | `Decimal` | yes | 0 < x <= 300 | Height in cm |
| `current_weight_kg` | `Decimal` | yes | 0 < x <= 500 | Current weight in kg |
| `activity_level` | `ActivityLevel` | yes | | Activity level |
| `weight_goal_type` | `WeightGoalType` | yes | | Goal direction |
| `target_weight_kg` | `Decimal` | no | 0 < x <= 500 | Target weight (required for lose/gain) |
| `weight_change_pace` | `WeightChangePace` | no | | Pace (required for lose/gain) |
| `protein_percent` | `int` | no | 0-100 | Override calculated protein % |
| `carbs_percent` | `int` | no | 0-100 | Override calculated carbs % |
| `fat_percent` | `int` | no | 0-100 | Override calculated fat % |
| `water_ml` | `int` | no | 0-10000 | Override calculated water ml |

**Validation rules:**
- If all three macro percentages are provided, they must sum to 100.
- Same `target_weight_kg` / `weight_change_pace` rules as the calculate endpoint.

**Response** `201 Created` -- `GoalResponse`

### `POST /v1/goals/manual`

Create a manual goal with direct calorie/macro input. Soft-deletes any existing goals for this device.

**Request body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `id` | `UUID` | no | | Client-generated goal ID |
| `daily_calories_kcal` | `int` | yes | 1-10000 | Daily calorie target |
| `protein_percent` | `int` | yes | 0-100 | Protein % of calories |
| `carbs_percent` | `int` | yes | 0-100 | Carbs % of calories |
| `fat_percent` | `int` | yes | 0-100 | Fat % of calories |
| `water_ml` | `int` | yes | 0-10000 | Daily water target in ml |

**Validation rules:**
- `protein_percent + carbs_percent + fat_percent` must equal 100.

```json
{
  "daily_calories_kcal": 2000,
  "protein_percent": 30,
  "carbs_percent": 45,
  "fat_percent": 25,
  "water_ml": 2500
}
```

**Response** `201 Created` -- `GoalResponse`

### `PATCH /v1/goals/{goal_id}`

Update goal targets. Only provided fields are updated.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `goal_id` | `UUID` | Goal ID |

**Request body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `daily_calories_kcal` | `int` | no | 1-10000 | Daily calorie target |
| `protein_percent` | `int` | no | 0-100 | Protein % |
| `carbs_percent` | `int` | no | 0-100 | Carbs % |
| `fat_percent` | `int` | no | 0-100 | Fat % |
| `water_ml` | `int` | no | 0-10000 | Water target in ml |

**Response** `200 OK` -- `GoalResponse`

**Errors:** `404` if not found or belongs to another device.

### `DELETE /v1/goals/{goal_id}`

Soft-delete a goal.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `goal_id` | `UUID` | Goal ID |

**Response** `204 No Content`

**Errors:** `404` if not found or belongs to another device.

### GoalResponse

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID` | Goal ID |
| `goal_type` | `GoalType` | `calculated` or `manual` |
| `gender` | `Gender?` | Null for manual goals |
| `birth_date` | `date?` | Null for manual goals |
| `height_cm` | `Decimal?` | Null for manual goals |
| `current_weight_kg` | `Decimal?` | Null for manual goals |
| `activity_level` | `ActivityLevel?` | Null for manual goals |
| `weight_goal_type` | `WeightGoalType?` | Null for manual goals |
| `target_weight_kg` | `Decimal?` | Null for manual/maintain goals |
| `weight_change_pace` | `WeightChangePace?` | Null for manual/maintain goals |
| `bmr_kcal` | `int?` | Null for manual goals |
| `tdee_kcal` | `int?` | Null for manual goals |
| `daily_calories_kcal` | `int` | Daily calorie target |
| `protein_percent` | `int` | Protein % of total calories |
| `carbs_percent` | `int` | Carbs % |
| `fat_percent` | `int` | Fat % |
| `protein_grams` | `int` | Protein in grams |
| `carbs_grams` | `int` | Carbs in grams |
| `fat_grams` | `int` | Fat in grams |
| `water_ml` | `int` | Water target in ml |
| `healthy_weight_min_kg` | `float?` | Null for manual goals |
| `healthy_weight_max_kg` | `float?` | Null for manual goals |
| `current_bmi` | `float?` | Null for manual goals |
| `bmi_category` | `string?` | Null for manual goals |
| `created_at` | `datetime` | Creation timestamp |
| `updated_at` | `datetime` | Last update timestamp |

---

## Stats

Tag: `stats` | Prefix: `/v1/stats` | Auth: Bearer token required

Aggregated nutrition statistics derived from food entries.

### `GET /v1/stats/day/{day}`

Get macro totals for a specific day, broken down by meal type.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `day` | `date` | Calendar day (`YYYY-MM-DD`) |

**Response** `200 OK` -- `DayStatsResponse`

```json
{
  "day": "2025-06-15",
  "totals": {
    "calories": "1850.5",
    "protein": "120.3",
    "carbs": "200.0",
    "fat": "55.2"
  },
  "by_meal_type": {
    "breakfast": {
      "calories": "450.0",
      "protein": "30.0",
      "carbs": "60.0",
      "fat": "12.0"
    },
    "lunch": {
      "calories": "700.5",
      "protein": "50.3",
      "carbs": "80.0",
      "fat": "25.2"
    }
  }
}
```

### `GET /v1/stats/daily`

Get daily macro totals for a date range.

**Query parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | `date` | yes | Start day (inclusive) |
| `to` | `date` | yes | End day (inclusive) |

**Response** `200 OK` -- `DailyStatsResponse`

```json
{
  "from_day": "2025-06-01",
  "to_day": "2025-06-07",
  "points": [
    {
      "day": "2025-06-01",
      "totals": {
        "calories": "2100.0",
        "protein": "140.0",
        "carbs": "230.0",
        "fat": "65.0"
      }
    }
  ]
}
```

### `GET /v1/stats/weight`

Get weight history for a date range.

**Query parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | `date` | yes | Start day (inclusive) |
| `to` | `date` | yes | End day (inclusive) |

**Response** `200 OK` -- `WeightStatsResponse`

```json
{
  "from_day": "2025-06-01",
  "to_day": "2025-06-07",
  "points": [
    {
      "day": "2025-06-01",
      "weight_kg": "84.5"
    },
    {
      "day": "2025-06-03",
      "weight_kg": "84.2"
    }
  ]
}
```

### Stats Response Schemas

**MacroTotalsResponse**

| Field | Type | Description |
|-------|------|-------------|
| `calories` | `Decimal` | Total calories (string in JSON) |
| `protein` | `Decimal` | Total protein grams |
| `carbs` | `Decimal` | Total carbs grams |
| `fat` | `Decimal` | Total fat grams |

**DayStatsResponse**

| Field | Type | Description |
|-------|------|-------------|
| `day` | `date` | Calendar day |
| `totals` | `MacroTotalsResponse` | Aggregate totals for the day |
| `by_meal_type` | `dict[MealType, MacroTotalsResponse]` | Breakdown by meal type (only meal types with entries) |

**DailyStatsResponse**

| Field | Type | Description |
|-------|------|-------------|
| `from_day` | `date` | Start of range |
| `to_day` | `date` | End of range |
| `points` | `DailyStatsPoint[]` | One entry per day with data |

**DailyStatsPoint**

| Field | Type | Description |
|-------|------|-------------|
| `day` | `date` | Calendar day |
| `totals` | `MacroTotalsResponse` | Macro totals for that day |

**WeightStatsResponse**

| Field | Type | Description |
|-------|------|-------------|
| `from_day` | `date` | Start of range |
| `to_day` | `date` | End of range |
| `points` | `WeightPoint[]` | One entry per recorded weight |

**WeightPoint**

| Field | Type | Description |
|-------|------|-------------|
| `day` | `date` | Calendar day |
| `weight_kg` | `Decimal` | Weight in kilograms (string in JSON) |

---

## Body Weights

Tag: `body-weights` | Prefix: `/v1/body-weights` | Auth: Bearer token required

### `GET /v1/body-weights`

List body weight entries with optional date range filter.

**Query parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | `date` | no | Start day (inclusive) |
| `to` | `date` | no | End day (inclusive) |

**Response** `200 OK` -- `BodyWeightResponse[]`

### `POST /v1/body-weights`

Create a body weight entry.

**Request body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `day` | `date` | yes | `YYYY-MM-DD` | Calendar day |
| `weight_kg` | `Decimal` | yes | > 0 | Weight in kilograms |

```json
{
  "day": "2025-06-15",
  "weight_kg": "84.5"
}
```

**Response** `201 Created` -- `BodyWeightResponse`

**Errors:** `409` if a weight entry already exists for that day and device.

### `GET /v1/body-weights/{weight_id}`

Get a single body weight entry.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `weight_id` | `UUID` | Weight entry ID |

**Response** `200 OK` -- `BodyWeightResponse`

**Errors:** `404` if not found or belongs to another device.

### `PATCH /v1/body-weights/{weight_id}`

Update a body weight entry.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `weight_id` | `UUID` | Weight entry ID |

**Request body:**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `weight_kg` | `Decimal` | yes | > 0 | New weight in kilograms |

**Response** `200 OK` -- `BodyWeightResponse`

**Errors:** `404` if not found or belongs to another device.

### `DELETE /v1/body-weights/{weight_id}`

Soft-delete a body weight entry.

**Path parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `weight_id` | `UUID` | Weight entry ID |

**Response** `204 No Content`

**Errors:** `404` if not found or belongs to another device.

### BodyWeightResponse

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID` | Weight entry ID |
| `day` | `date` | Calendar day |
| `weight_kg` | `Decimal` | Weight in kilograms (string in JSON) |
| `created_at` | `datetime` | Creation timestamp |
| `updated_at` | `datetime` | Last update timestamp |

---

## Sync

Tag: `sync` | Prefix: `/v1/sync` | Auth: Bearer token required

Cursor-based synchronization endpoint. Returns all records (including soft-deleted ones) that have been updated since the provided cursor. Useful for incremental client-side sync.

### `GET /v1/sync/since`

Fetch records updated since a cursor position.

**Query parameters:**

| Param | Type | Required | Default | Constraints | Description |
|-------|------|----------|---------|-------------|-------------|
| `cursor` | `string` | no | `null` | `ISO_timestamp\|UUID` | Cursor from previous sync response. Omit for initial full sync. |
| `limit` | `int` | no | `200` | 1-500 | Max records per entity type |

**Cursor format:** `{ISO_8601_timestamp}|{UUID}` -- e.g., `2025-06-15T12:00:00Z|550e8400-e29b-41d4-a716-446655440000`

The cursor encodes the `(updated_at, id)` pair of the last record seen. Records are ordered by `(updated_at ASC, id ASC)` to ensure stable pagination.

**Response** `200 OK` -- `SyncSinceResponse`

```json
{
  "cursor": "2025-06-15T14:30:00Z|a1b2c3d4-...",
  "products": [
    {
      "id": "...",
      "name": "Chicken breast",
      "updated_at": "2025-06-15T12:00:00Z",
      "deleted_at": null
    }
  ],
  "portions": [
    {
      "id": "...",
      "product_id": "...",
      "label": "100g",
      "base_amount": "100",
      "base_unit": "g",
      "calories": "165",
      "protein": "31",
      "carbs": "0",
      "fat": "3.6",
      "is_default": true,
      "updated_at": "2025-06-15T12:00:00Z",
      "deleted_at": null
    }
  ],
  "food_entries": [
    {
      "id": "...",
      "product_id": "...",
      "portion_id": "...",
      "day": "2025-06-15",
      "meal_type": "lunch",
      "amount": "150",
      "unit": "g",
      "updated_at": "2025-06-15T13:00:00Z",
      "deleted_at": null
    }
  ]
}
```

**Sync usage pattern:**
1. **Initial sync:** Call with no cursor to get all records.
2. **Incremental sync:** Pass the `cursor` from the previous response to get only new/updated records.
3. **Deleted records:** Records with non-null `deleted_at` indicate soft-deleted items that should be removed from the client store.
4. **Pagination:** If any entity array has `limit` items, there may be more. Call again with the returned cursor.

### Sync Response Schemas

**SyncSinceResponse**

| Field | Type | Description |
|-------|------|-------------|
| `cursor` | `string?` | Cursor for the next sync call (null if no records) |
| `products` | `SyncProduct[]` | Updated/deleted products |
| `portions` | `SyncPortion[]` | Updated/deleted portions |
| `food_entries` | `SyncFoodEntry[]` | Updated/deleted food entries |

**SyncProduct**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID` | Product ID |
| `name` | `string` | Product name |
| `updated_at` | `datetime` | Last update timestamp |
| `deleted_at` | `datetime?` | Soft-delete timestamp (null if active) |

**SyncPortion**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID` | Portion ID |
| `product_id` | `UUID` | Parent product ID |
| `label` | `string` | Portion label |
| `base_amount` | `Decimal` | Base serving amount |
| `base_unit` | `Unit` | Unit of measurement |
| `calories` | `Decimal` | Calories per base amount |
| `protein` | `Decimal?` | Protein grams (nullable) |
| `carbs` | `Decimal?` | Carbs grams (nullable) |
| `fat` | `Decimal?` | Fat grams (nullable) |
| `is_default` | `bool` | Whether default portion |
| `updated_at` | `datetime` | Last update timestamp |
| `deleted_at` | `datetime?` | Soft-delete timestamp (null if active) |

**SyncFoodEntry**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID` | Entry ID |
| `product_id` | `UUID` | Associated product |
| `portion_id` | `UUID` | Associated portion |
| `day` | `date` | Calendar day |
| `meal_type` | `MealType` | Meal category |
| `amount` | `Decimal` | Quantity |
| `unit` | `Unit` | Unit of measurement |
| `updated_at` | `datetime` | Last update timestamp |
| `deleted_at` | `datetime?` | Soft-delete timestamp (null if active) |
