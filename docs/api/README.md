# CountOnMe API Reference

Base URL: `http://<host>:<port>`

All endpoints under `/v1` require Bearer token authentication unless noted otherwise.
The API uses snake_case for all request and response field names.

## Authentication

Token format: `{device_id}.{secret}` — sent as `Authorization: Bearer {device_id}.{secret}`

Verification: parse device_id → look up device → compare SHA-256(secret + pepper) against stored hash → update last_seen_at.

| Status | Meaning |
|--------|---------|
| `401` | Missing, malformed, or invalid token |
| `403` | Device revoked |
| `404` | Resource not found or belongs to a different device |

## Common Conventions

- **IDs**: UUIDs (v4)
- **Timestamps**: ISO 8601 with timezone
- **Decimals**: Serialized as strings in JSON
- **Dates**: `YYYY-MM-DD` format
- **Soft deletes**: DELETE sets `deleted_at`, filtered from queries
- **Device scoping**: All data scoped to authenticated device; cross-device = 404
- **Validation errors**: `422 Unprocessable Entity` with Pydantic details

## Enumerations

**Unit**: `mg`, `g`, `kg`, `ml`, `l`, `tsp`, `tbsp`, `cup`

**MealType**: `breakfast`, `lunch`, `dinner`, `snacks`, `water`

**GoalType**: `calculated`, `manual`

**Gender**: `male`, `female`

**ActivityLevel**: `sedentary` (1.2), `light` (1.375), `moderate` (1.55), `active` (1.725), `very_active` (1.9)

**WeightGoalType**: `lose`, `maintain`, `gain`

**WeightChangePace**: `slow` (~0.25 kg/wk), `moderate` (~0.5 kg/wk), `aggressive` (~0.75 kg/wk)

## Endpoints by Domain

- [Devices](devices.md) — Device registration
- [Products](products.md) — Product CRUD
- [Portions](portions.md) — Product portion CRUD
- [Food Entries](food-entries.md) — Daily food entry CRUD
- [Goals](goals.md) — Nutrition goal CRUD + calculation
- [Stats](stats.md) — Day stats, daily trends, weight trends
- [Body Weights](body-weights.md) — Body weight CRUD
- [Sync](sync.md) — Cursor-based incremental sync
- [Catalog](catalog.md) — Global product catalog search

## Health Check

`GET /health` — No auth required. Returns `{"ok": true}`.
