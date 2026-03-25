---
type: adr
status: proposed
last-updated: 2026-03-25
related-features:
  - supabase-migration
  - multi-device-support
---

# ADR-005: Data Ownership Model — Device-Scoped to User-Scoped

## Status

Proposed

## Context

CountOnMe currently scopes all private data by `device_id`. Every table that holds user data has a `device_id UUID NOT NULL` column with a foreign key to the `devices` table. This was the correct design for an anonymous, single-device app, but it becomes the central obstacle for multi-device support and Supabase auth.

The migration to Supabase introduces email-based accounts. A single user may log in on multiple devices, and their data must be accessible from any of them. The `device_id` ownership key must be replaced by a `user_id` ownership key that references Supabase's `auth.users` table.

### Current state of device-scoped tables

| Table | PK | Ownership Column | FK Target | TimestampMixin | Soft Delete |
|---|---|---|---|---|---|
| `devices` | `id` (UUID) | self | - | No (manual `created_at`, `last_seen_at`) | No |
| `products` | `id` (UUID) | `device_id` | `devices.id` | Yes (`created_at`, `updated_at`, `deleted_at`) | Yes |
| `product_portions` | `id` (UUID) | `device_id` | `devices.id` | Yes | Yes |
| `food_entries` | `id` (UUID) | `device_id` | `devices.id` | Yes | Yes |
| `user_goals` | `id` (UUID) | `device_id` | `devices.id` | Yes | Yes |
| `body_weights` | `id` (UUID) | `device_id` | `devices.id` | Yes | Yes |

No `water_logs` table exists on the backend yet (water logs are client-only in AsyncStorage as `WaterLog[]`).

Global catalog tables (`catalog_products`, `catalog_portions`) have no `device_id` and are unaffected by this change.

### Client-side storage keys with device-scoped data

From `client/src/storage/storage.ts`, the following AsyncStorage keys hold private data:
- `@countOnMe/products/v2` -- Product[]
- `@countOnMe/meals/v2` -- Meal[]
- `@countOnMe/products-favourites/v1` -- string[]
- `@countOnMe/products-recents/v1` -- string[]
- `@countOnMe/goal/v1` -- UserGoal
- `@countOnMe/body-weights/v1` -- BodyWeightEntry[]
- `@countOnMe/water-logs/v1` -- WaterLog[]
- `@countOnMe/draft-meal/v1` -- StoredDraftMeal

Device identity is stored separately in `client/src/storage/device.ts`:
- `device:id` -- UUID string
- `device:token` -- device token string (format: `{device_id}.{secret}`)

### Auth token flow (to be replaced)

The current auth flow in `backend/app/features/auth/service.py`:
1. Client generates a UUID `device_id` locally, stores in AsyncStorage
2. Client calls `POST /v1/devices/register` with that UUID
3. Backend creates a `Device` row, returns `device_token = "{device_id}.{secret}"`
4. Client stores `device_token` in AsyncStorage (unencrypted)
5. On each API call, client sends `Authorization: Bearer {device_token}`
6. Backend parses token, looks up `devices` row, verifies SHA-256+pepper hash
7. `get_current_device_id()` dependency extracts `device.id` for service-layer scoping

This entire chain is replaced by Supabase JWT auth (see ADR-006).

## Decision

### 1. Introduce a `users` table linked to Supabase auth

```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_id UUID NOT NULL UNIQUE,  -- references auth.users(id) in Supabase
    email       TEXT,                   -- denormalized from Supabase for display
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

This is an application-level user record. We do NOT directly foreign-key to `auth.users` because that is a Supabase-managed schema. Instead, `supabase_id` is a unique external reference resolved during JWT validation.

### 2. Introduce a `user_devices` junction table

```sql
CREATE TABLE user_devices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    device_name TEXT,           -- e.g., "iPhone 15 Pro"
    linked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, device_id)
);
```

This preserves backward compatibility: existing `devices` rows survive and can be linked to a user during the transition period when existing device-token users create an account.

### 3. Add `user_id` to all private tables, phase out `device_id` as ownership key

**Migration strategy (3-step for each table):**

1. **Add nullable `user_id`** column with FK to `users(id)`:
   ```sql
   ALTER TABLE products ADD COLUMN user_id UUID REFERENCES users(id);
   ALTER TABLE products ADD COLUMN created_on_device_id UUID;
   ALTER TABLE products ADD COLUMN updated_on_device_id UUID;
   ```

2. **Backfill `user_id`** from `device_id` via `user_devices` junction:
   ```sql
   UPDATE products p
   SET user_id = ud.user_id
   FROM user_devices ud
   WHERE p.device_id = ud.device_id
     AND p.user_id IS NULL;
   ```

3. **Set NOT NULL** on `user_id` (only after all devices are linked to users):
   ```sql
   ALTER TABLE products ALTER COLUMN user_id SET NOT NULL;
   ```

Since there is no guest mode, step 3 can happen once all existing users have been migrated. The `device_id` column is NOT dropped immediately -- it remains as `created_on_device_id` / `updated_on_device_id` metadata for audit and conflict resolution.

### 4. Column changes per table

| Table | Remove | Add | Notes |
|---|---|---|---|
| `products` | `device_id` (FK, ownership) | `user_id` (FK, NOT NULL, ownership), `created_on_device_id` (UUID), `updated_on_device_id` (UUID) | `device_id` column renamed to `created_on_device_id` after backfill |
| `product_portions` | `device_id` (FK, ownership) | `user_id` (FK, NOT NULL, ownership), `created_on_device_id`, `updated_on_device_id` | Same pattern |
| `food_entries` | `device_id` (FK, ownership) | `user_id` (FK, NOT NULL, ownership), `created_on_device_id`, `updated_on_device_id` | Same pattern |
| `user_goals` | `device_id` (FK, ownership) | `user_id` (FK, NOT NULL, ownership), `created_on_device_id`, `updated_on_device_id` | Same pattern |
| `body_weights` | `device_id` (FK, ownership) | `user_id` (FK, NOT NULL, ownership), `created_on_device_id`, `updated_on_device_id` | Same pattern |
| `water_logs` (NEW) | n/a | `user_id` (FK, NOT NULL, ownership), `created_on_device_id` | New table, born with `user_id` |
| `devices` | - | - | Kept as-is; becomes a device registry |
| `users` (NEW) | n/a | `id`, `supabase_id`, `email`, timestamps | New table |
| `user_devices` (NEW) | n/a | `user_id`, `device_id`, `device_name`, timestamps | New junction table |
| `catalog_products` | - | - | Unchanged (global, no ownership) |
| `catalog_portions` | - | - | Unchanged (global, no ownership) |

### 5. Canonical source rule

- **Server is canonical** for all account data once the user is online and authenticated
- **Local SQLite is canonical** for offline UX: the user sees local data instantly, and sync reconciles with the server asynchronously
- On conflict, server wins for data that was synced before the conflict (last-write-wins by `server_updated_at`)
- Client may show optimistic local state while sync is pending

### 6. Service layer changes

Every service function that currently takes `device_id: UUID` as its scoping parameter will be updated to take `user_id: UUID` instead. The FastAPI dependency `get_current_device_id()` becomes `get_current_user_id()`.

Example before:
```python
async def list_products(session: AsyncSession, device_id: UUID) -> list[Product]:
    stmt = select(Product).where(Product.device_id == device_id, Product.deleted_at.is_(None))
```

Example after:
```python
async def list_products(session: AsyncSession, user_id: UUID) -> list[Product]:
    stmt = select(Product).where(Product.user_id == user_id, Product.deleted_at.is_(None))
```

### 7. Index changes

Replace `device_id` indexes with `user_id` indexes on all private tables:

```sql
-- Example for products
DROP INDEX ix_products_device_id;
CREATE INDEX ix_products_user_id ON products(user_id);
CREATE INDEX ix_products_user_id_deleted_at ON products(user_id, deleted_at);
```

The composite index `(user_id, deleted_at)` optimizes the most common query pattern: "all non-deleted rows for this user."

## Consequences

### Positive
- Enables multi-device access: one user, many devices, same data
- Aligns with Supabase auth model (JWT carries user identity, not device identity)
- `created_on_device_id` / `updated_on_device_id` provide full audit trail for conflict resolution
- The `devices` table is preserved, so existing device tokens work during the transition period
- No data loss: existing rows are backfilled, not deleted
- Water logs get a proper backend table from the start with the correct ownership model

### Negative
- Every service function must be updated (device_id -> user_id), touching all 6+ service modules
- The 3-step migration (add nullable, backfill, set NOT NULL) requires careful ordering and cannot be done in a single deployment
- Existing device-only users must create an account before their data is accessible on a new device
- Composite index on `(user_id, deleted_at)` increases write overhead slightly

### Risks
- **Orphaned data**: If a device is never linked to a user (user abandons app before creating account), the data remains scoped to `device_id` only. Mitigation: the app requires account creation on first launch (no guest mode), so this only affects existing pre-migration users.
- **Backfill correctness**: The `UPDATE ... FROM user_devices` backfill assumes every device has been linked. Mitigation: run backfill after the transition period; add monitoring for rows where `user_id IS NULL`.
- **Dual-scoping bugs**: During the transition, some queries might accidentally use `device_id` instead of `user_id`. Mitigation: add a linting rule or code review gate to flag `device_id` in service-layer WHERE clauses.

## Alternatives Considered

### A. Drop device_id entirely, UUID-only user_id
Rejected because: losing device provenance makes conflict resolution impossible. We need to know which device last modified a row for last-write-wins sync.

### B. Keep device_id as primary ownership, add user_id as secondary
Rejected because: this inverts the correct hierarchy. A user owns data, not a device. Making device_id primary creates an N:1 fan-out problem when querying "all products for this user" across multiple devices.

### C. Use Supabase RLS instead of application-level scoping
Rejected because: the FastAPI backend connects to Supabase Postgres as a service role. RLS policies apply to client-direct connections, not service-role connections. We enforce scoping in the service layer, which is already the established pattern. RLS could be added as defense-in-depth later but is not the primary mechanism.
