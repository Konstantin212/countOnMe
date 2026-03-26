---
type: plan
status: draft
last-updated: 2026-03-26
---

# Implementation Plan: Phase 3 — Rewrite Backend Auth (device_id to user_id)

## Overview

Switch all 8 data routers from `device_id = Depends(get_current_device_id)` to `user_id = Depends(get_current_user_id)` so that data ownership is based on the authenticated Supabase user, not the legacy device token. Device ID becomes optional metadata (sent via `X-Device-Id` header) for `created_on_device_id`/`updated_on_device_id` tracking. All existing tests (17 test files, 221 occurrences of auth fixtures) must be migrated from device-token fixtures to JWT-based fixtures.

## Success Criteria

- [ ] All 8 data routers use `user_id = Depends(get_current_user_id)` instead of `device_id = Depends(get_current_device_id)`
- [ ] Service functions accept `user_id: uuid.UUID` as required (no `None` default)
- [ ] `device_id` in service functions demoted to optional metadata parameter
- [ ] `get_owner_filter` simplified: `user_id` required, `device_id` removed
- [ ] `get_optional_device_id()` dependency reads `X-Device-Id` header
- [ ] Write operations set `created_on_device_id`/`updated_on_device_id` from header
- [ ] `ALLOW_DEVICE_AUTH` setting added (default `False`); `get_current_device`/`get_current_device_id` marked deprecated
- [ ] Client `apiFetch()` sends `X-Device-Id` header
- [ ] All tests pass using JWT-based auth fixtures
- [ ] `ruff check` and type checking pass

## Assumptions

- All 5 data tables already have `user_id`, `created_on_device_id`, `updated_on_device_id` columns (validated: Product, ProductPortion, FoodEntry, UserGoal, BodyWeight)
- `get_current_user()` and `get_current_user_id()` already exist and work in `app/core/deps.py` (validated)
- All 8 service files already accept `user_id: uuid.UUID | None = None` (validated)
- Client already sends Supabase JWT via `apiFetch()` (validated: `http.ts` calls `getAccessToken()`)
- The `claim_device_data` feature already stamps `user_id` on existing data during device linking (validated in auth service)
- Device registration endpoint (`/v1/devices/register`) stays untouched — legacy clients still need it
- Auth router (`/v1/auth/*`) already uses `get_current_user` — not affected

## Architecture Changes

- **Primary auth dependency**: `get_current_device_id` replaced by `get_current_user_id` across all data routers
- **Ownership model**: Data scoped by `user_id` (required), not `device_id` (legacy)
- **Device as metadata**: `X-Device-Id` header provides optional device tracking for writes
- **`get_owner_filter`**: Simplified to require `user_id`, no fallback to `device_id`

## Files Affected

### New Files
- None

### Modified Files

**Backend core (3 files):**
- `backend/app/core/deps.py` — Add `get_optional_device_id()`, deprecate `get_current_device`/`get_current_device_id`
- `backend/app/core/ownership.py` — Simplify `get_owner_filter` to `user_id`-only
- `backend/app/settings.py` — Add `ALLOW_DEVICE_AUTH` setting

**Backend routers (8 files):**
- `backend/app/features/products/router.py` — Switch to `user_id`, pass optional `device_id` metadata
- `backend/app/features/portions/router.py` — Same
- `backend/app/features/meals/router.py` — Same
- `backend/app/features/goals/router.py` — Same
- `backend/app/features/weights/router.py` — Same
- `backend/app/features/stats/router.py` — Same
- `backend/app/features/sync/router.py` — Same
- `backend/app/features/data/router.py` — Same
- `backend/app/features/catalog/router.py` — Switch auth-only guard to `get_current_user_id`

**Backend services (8 files):**
- `backend/app/features/products/service.py` — Make `user_id` required, `device_id` optional metadata
- `backend/app/features/portions/service.py` — Same
- `backend/app/features/meals/service.py` — Same
- `backend/app/features/goals/service.py` — Same
- `backend/app/features/weights/service.py` — Same
- `backend/app/features/stats/service.py` — Same
- `backend/app/features/sync/router.py` — Sync has inline queries; switch filter
- `backend/app/features/data/service.py` — Same

**Backend tests (12+ files):**
- `backend/tests/conftest.py` — Add JWT-based `authenticated_client` fixture, keep legacy fixture under separate name
- `backend/tests/factories.py` — Add `create_user()` factory, update `create_product`/etc to accept optional `user_id`
- `backend/tests/api/test_products_api.py` — Migrate to JWT auth
- `backend/tests/api/test_portions_api.py` — Same
- `backend/tests/api/test_data_api.py` — Same
- `backend/tests/api/test_catalog.py` — Same
- `backend/tests/api/test_catalog_barcode.py` — Same
- `backend/tests/api/test_product_barcode_dedup.py` — Same
- `backend/tests/api/test_auth_deps.py` — Update/split: JWT auth tests + legacy fallback tests
- `backend/tests/services/test_products_db.py` — Migrate to user_id-based calls
- `backend/tests/services/test_portions_db.py` — Same
- `backend/tests/services/test_food_entries_db.py` — Same
- `backend/tests/services/test_goals_db.py` — Same
- `backend/tests/services/test_weights_db.py` — Same
- `backend/tests/services/test_stats_db.py` — Same
- `backend/tests/services/test_product_barcode_dedup.py` — Same

**Client (1 file):**
- `client/src/services/api/http.ts` — Add `X-Device-Id` header to `doFetch()`

## Implementation Steps

### Phase 1: Foundation — New Dependencies & Settings (3 files)
Estimate: 3 files modified

The goal is to add the new auth primitives without breaking anything existing. All old code keeps working.

1. **Add `ALLOW_DEVICE_AUTH` setting** (`backend/app/settings.py`)
   - Action: Add `allow_device_auth: bool = False` to the `Settings` class. This is a feature flag; when `False`, legacy device-token auth is logically deprecated (but the code path still exists for backward compat during migration)
   - Why: Allows controlled rollout; can be flipped in prod to disable legacy auth
   - Dependencies: None
   - Risk: Low
   - Test: Settings instantiates without error

2. **Add `get_optional_device_id()` dependency** (`backend/app/core/deps.py`)
   - Action: Add a new async dependency function that reads `X-Device-Id` header from the request. Returns `uuid.UUID | None`. If the header is present, parse it to UUID; if missing or invalid, return `None`. Use `fastapi.Header` with `alias="X-Device-Id"`. Do NOT modify existing functions yet.
   - Signature: `async def get_optional_device_id(x_device_id: str | None = Header(default=None, alias="X-Device-Id")) -> uuid.UUID | None`
   - Why: Routers need a way to pass device metadata to services for write operations
   - Dependencies: None
   - Risk: Low
   - Test: Unit test — call with/without header, verify UUID parse

3. **Simplify `get_owner_filter`** (`backend/app/core/ownership.py`)
   - Action: Change signature to `get_owner_filter(model, *, user_id: uuid.UUID)` — make `user_id` required, remove `device_id` parameter entirely. The function body becomes simply `return model.user_id == user_id`.
   - Why: Once all callers pass `user_id`, the dual-mode fallback is unnecessary. Simpler = fewer bugs.
   - Dependencies: None (callers will be updated in Phase 2-3)
   - Risk: **Medium** — This is a breaking change for all current callers. However, this is safe IF we update all callers in Phase 2 before running tests.
   - Test: Verified when Phase 2 tests pass

**IMPORTANT**: After Phase 1, the codebase will NOT pass tests because `get_owner_filter` callers still pass `device_id`. This is intentional — Phase 2 immediately follows.

Verification: `cd backend && ruff check app/core/deps.py app/core/ownership.py app/settings.py` (lint only, no tests)

### Phase 2: Rewrite Services (8 files)
Estimate: 8 files modified

Update all service functions: `user_id` becomes required, `device_id` becomes optional metadata for writes.

**Pattern for each service file:**
- Change `device_id: uuid.UUID` (required) to `device_id: uuid.UUID | None = None` (optional metadata)
- Change `user_id: uuid.UUID | None = None` (optional) to `user_id: uuid.UUID` (required)
- Update `get_owner_filter` calls: pass only `user_id=user_id` (no more `device_id`)
- For create operations: keep setting `model.device_id = device_id` (when provided) for tracking. If `device_id` is `None`, use the existing `device_id` FK or leave it — **Decision needed below**.

1. **`backend/app/features/products/service.py`**
   - Action: All 7 functions (`create_product`, `list_products`, `get_product`, `update_product`, `check_product_name_available`, `search_products`, `soft_delete_product`, `get_product_by_barcode`):
     - `user_id: uuid.UUID` — required, first keyword arg
     - `device_id: uuid.UUID | None = None` — optional, for metadata only
   - `create_product`: Set `product.user_id = user_id`. Set `product.created_on_device_id = device_id` if provided. Keep `product.device_id = device_id` if provided (FK can be nullable — **NO, FK is NOT NULL currently**). See Open Questions.
   - All `get_owner_filter` calls: `get_owner_filter(Product, user_id=user_id)`
   - Risk: Medium — `device_id` FK is NOT NULL on all models, so create operations must still receive a device_id or we need a migration. See Open Questions.

2. **`backend/app/features/portions/service.py`**
   - Action: Same pattern for `list_portions`, `get_portion`, `create_portion`, `update_portion`, `soft_delete_portion`
   - Note: `create_portion` line 95 has a hardcoded `ProductPortion.device_id == device_id` filter in the `update` statement for clearing is_default. This must change to use `user_id`-based ownership instead (or the portion's `product_id` scope which is already correct)
   - Risk: Medium — the `update()` WHERE clauses for default-clearing need careful attention

3. **`backend/app/features/meals/service.py`**
   - Action: Same pattern for `create_food_entry`, `list_food_entries`, `get_food_entry`, `update_food_entry`, `soft_delete_food_entry`, `_get_portion`
   - Risk: Low

4. **`backend/app/features/goals/service.py`**
   - Action: Same pattern for `get_current_goal`, `get_goal`, `create_calculated_goal`, `create_manual_goal`, `update_goal`, `soft_delete_goal`, `_soft_delete_existing_goals`
   - Risk: Low

5. **`backend/app/features/weights/service.py`**
   - Action: Same pattern for `create_body_weight`, `list_body_weights`, `get_body_weight`, `get_body_weight_by_day`, `update_body_weight`, `soft_delete_body_weight`
   - Risk: Low

6. **`backend/app/features/stats/service.py`**
   - Action: Same pattern for `get_day_stats`, `get_daily_stats`
   - Risk: Low

7. **`backend/app/features/data/service.py`**
   - Action: Same pattern for `delete_all_food_entries`
   - Risk: Low

8. **`backend/app/features/sync/router.py`** (inline queries)
   - Action: The sync router has inline SQLAlchemy queries (not a service). Update `get_owner_filter` calls to pass `user_id` only. Change `device_id` parameter to `user_id` from the new dependency.
   - Risk: Low

Verification: `cd backend && ruff check app/` (lint only — tests will fail until Phase 3 updates routers)

### Phase 3: Rewrite Routers (9 files)
Estimate: 9 files modified

Switch all router endpoint signatures from `device_id = Depends(get_current_device_id)` to `user_id = Depends(get_current_user_id)`, and add optional `device_id = Depends(get_optional_device_id)` for write endpoints.

**Pattern for each router file:**
- Replace import: `from app.core.deps import get_current_device_id` with `from app.core.deps import get_current_user_id, get_optional_device_id`
- Read endpoints (GET): Only need `user_id`
- Write endpoints (POST, PATCH, DELETE): Need `user_id` + optional `device_id` for metadata
- Pass `user_id=user_id` to all service calls
- Pass `device_id=device_id` to create/update service calls (for `created_on_device_id`/`updated_on_device_id`)

1. **`backend/app/features/products/router.py`** (7 endpoints)
   - Action: Replace `device_id: uuid.UUID = Depends(get_current_device_id)` with `user_id: uuid.UUID = Depends(get_current_user_id)` on all 7 endpoints. Add `device_id: uuid.UUID | None = Depends(get_optional_device_id)` on POST/PATCH/DELETE. Update all service calls.
   - Risk: Low

2. **`backend/app/features/portions/router.py`** (5 endpoints)
   - Action: Same pattern
   - Risk: Low

3. **`backend/app/features/meals/router.py`** (5 endpoints)
   - Action: Same pattern
   - Risk: Low

4. **`backend/app/features/goals/router.py`** (7 endpoints)
   - Action: Same pattern. Note: `goals_calculate` endpoint doesn't use device_id for anything — just replace with `user_id` for auth guard.
   - Risk: Low

5. **`backend/app/features/weights/router.py`** (5 endpoints)
   - Action: Same pattern
   - Risk: Low

6. **`backend/app/features/stats/router.py`** (3 endpoints)
   - Action: Same pattern. Stats are read-only, so only `user_id` needed.
   - Risk: Low

7. **`backend/app/features/sync/router.py`** (1 endpoint, inline queries)
   - Action: Replace `device_id = Depends(get_current_device_id)` with `user_id = Depends(get_current_user_id)`. Update inline `get_owner_filter` calls to pass `user_id=user_id`.
   - Risk: Low

8. **`backend/app/features/data/router.py`** (1 endpoint)
   - Action: Same pattern
   - Risk: Low

9. **`backend/app/features/catalog/router.py`** (3 endpoints)
   - Action: Replace `_device_id: uuid.UUID = Depends(get_current_device_id)` with `_user_id: uuid.UUID = Depends(get_current_user_id)` — these are auth guards only (catalog is global, not user-scoped)
   - Risk: Low

Verification: `cd backend && ruff check app/` (full lint pass). Tests still fail until Phase 4.

### Phase 4: Rewrite Test Infrastructure (2 files)
Estimate: 2 files modified

This is the highest-risk phase. Create JWT-based test fixtures to replace device-token fixtures.

1. **Add JWT test helpers to `backend/tests/conftest.py`**
   - Action:
     a. Add EC key generation and `_make_test_jwt()` helper (copy pattern from `test_auth_endpoints.py`)
     b. Add autouse fixture `_patch_jwks_for_tests` that patches `app.features.auth.service._get_jwks_client` for the entire test session
     c. Rewrite `authenticated_client` fixture to:
        - Create a User (supabase_id=uuid4, email="test@test.com")
        - Create a Device (linked to user via UserDevice)
        - Generate a JWT with sub=str(user.supabase_id)
        - Set `Authorization: Bearer {jwt}` header
        - Set `X-Device-Id: {device_id}` header
        - Return `tuple[AsyncClient, uuid.UUID]` where the UUID is now `user_id` (not `device_id`)
     d. **BREAKING**: The second element of the tuple changes from `device_id` to `user_id`. Most tests destructure as `client, _` so this is safe. Tests that use `device_id` (like `test_data_api.py`) need updating.
     e. Optionally keep a `legacy_authenticated_client` fixture for the few tests that specifically test device-token auth.
   - Why: All API tests depend on this fixture
   - Risk: **High** — Every API test depends on this. If the fixture is wrong, all tests fail.
   - Test: Run a single simple test (e.g., `test_list_products_empty`) to verify fixture works

2. **Update `backend/tests/factories.py`**
   - Action:
     a. Add `create_user(session, **overrides) -> User` factory
     b. Add `create_user_device(session, user_id, device_id) -> UserDevice` factory
     c. Update `create_product`, `create_portion`, `create_food_entry`, `create_goal`, `create_body_weight` to accept optional `user_id` parameter and set it on the model
   - Why: Service-level tests create entities directly and need user_id set for ownership queries to work
   - Risk: Medium — many tests use these factories

Verification: `cd backend && pytest tests/api/test_products_api.py -x` (quick smoke test)

### Phase 5: Migrate API Tests (10 files)
Estimate: 10 files modified

Update each API test file to work with the new JWT-based `authenticated_client` fixture.

1. **`backend/tests/api/test_products_api.py`**
   - Action: Most tests use `client, _ = authenticated_client` — these work as-is. Fix `test_device_scoping_prevents_cross_device_access` — rename to `test_user_scoping_prevents_cross_user_access`, use two JWT tokens with different user subs instead of two device tokens.
   - Risk: Medium

2. **`backend/tests/api/test_portions_api.py`**
   - Action: All use `client, _ = authenticated_client` — should work as-is after fixture change
   - Risk: Low

3. **`backend/tests/api/test_data_api.py`**
   - Action: `test_reset_deletes_food_entries` uses `device_id` from fixture to create test data via factories — change to use `user_id`. `test_reset_device_scoped` creates two separate devices — rewrite as user-scoped test with two users.
   - Risk: Medium

4. **`backend/tests/api/test_catalog.py`**
   - Action: All use `client, _ = authenticated_client` — should work as-is
   - Risk: Low

5. **`backend/tests/api/test_catalog_barcode.py`**
   - Action: Same as catalog — should work as-is
   - Risk: Low

6. **`backend/tests/api/test_product_barcode_dedup.py`**
   - Action: All use `client, _ = authenticated_client` — should work as-is
   - Risk: Low

7. **`backend/tests/api/test_auth_deps.py`**
   - Action: These tests specifically test auth mechanisms. Split into:
     - JWT auth tests (missing token, expired token, valid token)
     - Legacy device-token tests (keep if `ALLOW_DEVICE_AUTH` is supported)
     - `test_auth_updates_last_seen` — rewrite to check user last_seen or remove
   - Risk: High — these are auth-specific tests

8. **`backend/tests/api/test_devices_api.py`**
   - Action: No changes needed — device registration endpoint is unaffected
   - Risk: None

9. **`backend/tests/api/test_auth_endpoints.py`**
   - Action: No changes needed — already uses JWT
   - Risk: None

10. **`backend/tests/api/test_claim_endpoint.py`**
    - Action: No changes needed — already uses JWT
    - Risk: None

Verification: `cd backend && pytest tests/api/ -x`

### Phase 6: Migrate Service Tests (7 files)
Estimate: 7 files modified

Service tests call service functions directly (no HTTP). They need to pass `user_id` as required.

**Pattern for each file:**
- Where tests call `create_device(db_session)` to get a device, also call `create_user(db_session)` to get a user
- Link user to device via `create_user_device(db_session, user_id, device_id)`
- Update factory calls to pass `user_id=user.id`
- Update service function calls: `device_id=device.id` becomes `user_id=user.id`
- Scoping tests (e.g., "device A can't see device B") become "user A can't see user B"

1. **`backend/tests/services/test_products_db.py`** (36 occurrences)
   - Risk: Medium — most occurrences, repetitive pattern
2. **`backend/tests/services/test_portions_db.py`** (23 occurrences)
   - Risk: Medium
3. **`backend/tests/services/test_food_entries_db.py`** (22 occurrences)
   - Risk: Medium
4. **`backend/tests/services/test_goals_db.py`** (12 occurrences)
   - Risk: Low
5. **`backend/tests/services/test_weights_db.py`** (16 occurrences)
   - Risk: Low
6. **`backend/tests/services/test_stats_db.py`** (8 occurrences)
   - Risk: Low
7. **`backend/tests/services/test_product_barcode_dedup.py`** (12 occurrences)
   - Risk: Low

Verification: `cd backend && pytest tests/services/ -x`

### Phase 7: Client — Add X-Device-Id Header (1 file)
Estimate: 1 file modified

1. **`client/src/services/api/http.ts`**
   - Action: In the `doFetch` function, add `X-Device-Id` header by calling `getOrCreateDeviceId()` from `@storage/device`. Import `getOrCreateDeviceId` at the top. Since `getOrCreateDeviceId` is async, call it alongside `getAccessToken()` at the start of `apiFetch`. Add the header to the `headers` object in `doFetch`.
   - Code change: In `apiFetch`, add `const deviceId = await getOrCreateDeviceId();` after the `getAccessToken()` call. In `doFetch`, add `"X-Device-Id": deviceId` to the headers object.
   - Why: Backend needs device_id metadata for write tracking
   - Dependencies: `getOrCreateDeviceId` from `client/src/storage/device.ts` already exists
   - Risk: Low
   - Test: Verify existing `http.test.ts` tests still pass, add one test for the new header

Verification: `cd client && npx tsc --noEmit && pnpm test`

### Phase 8: Deprecation Cleanup (1 file)
Estimate: 1 file modified

1. **Mark legacy deps as deprecated** (`backend/app/core/deps.py`)
   - Action: Add `warnings.warn("get_current_device is deprecated, use get_current_user", DeprecationWarning, stacklevel=2)` to `get_current_device()` and `get_current_device_id()`. Keep the functions working — they are still used by the device registration flow and may be used by legacy clients.
   - Why: Signals to developers not to use these, without breaking backward compat
   - Risk: Low

Verification: `cd backend && pytest --cov=app --cov-report=term-missing`

## Testing Strategy

- **Unit tests**: New `get_optional_device_id()` dependency — test UUID parse, None for missing header, None for invalid UUID
- **Integration tests (API)**: All existing API tests migrated to JWT auth. Cross-user scoping tests (user A can't see user B's data)
- **Integration tests (Service)**: All existing service tests migrated to pass `user_id`. Device-scoping tests become user-scoping tests.
- **Manual verification**: Hit a few endpoints with curl using a real Supabase JWT to verify end-to-end

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `device_id` FK is NOT NULL on all 5 models | High | See Open Question #1. Must decide approach before implementing. |
| `authenticated_client` fixture change breaks all 17 test files at once | High | Implement fixture first, run single test to verify, then batch-migrate |
| Portion default-clearing uses hardcoded `device_id` in WHERE clause | Medium | Update `update()` WHERE clauses in portion service to scope by `product_id` (already correct) instead of `device_id` |
| Sync router has inline queries (not in service) | Low | Update inline `get_owner_filter` calls directly in router |
| `goals_calculate` endpoint doesn't actually need auth beyond identity | Low | Keep `user_id` param for consistency — it's an auth guard |
| JWKS patching in conftest may conflict with existing `test_auth_endpoints.py` autouse fixture | Medium | Make conftest JWKS fixture session-scoped, ensure same key pair is used |

## Open Questions

### 1. `device_id` FK is NOT NULL — How to Handle Create Operations?

**Problem**: All 5 data models have `device_id` as a NOT NULL FK to `devices.id`. When a user creates data via JWT auth, there may not be a device_id available (e.g., if the `X-Device-Id` header is missing, or the device doesn't exist in the `devices` table).

**Options**:

A. **Make `device_id` nullable** (Alembic migration) — Add a migration to make `device_id` nullable on all 5 tables. Create operations set `device_id` only if the `X-Device-Id` header provides a valid device UUID that exists in the `devices` table.
   - Pro: Clean separation, no dummy data
   - Con: Requires migration, existing data has device_id set

B. **Require X-Device-Id header on all write operations** — Return 400 if missing on POST/PATCH.
   - Pro: No migration, device tracking always works
   - Con: Breaking change for clients not sending the header yet; overhead

C. **Create a "virtual device" per user** — When a user authenticates and has no linked device, auto-create one (the `get_current_device` function already does this). Use that device_id.
   - Pro: No migration, backward compat
   - Con: Creates phantom devices, adds complexity

D. **Keep NOT NULL, use linked device_id from user_devices** — During JWT auth, look up the user's linked device and use that device_id. The `get_current_device` dep already does this.
   - Pro: No migration, leverages existing link-device flow
   - Con: User must have linked a device first; breaks if no linked device

**Recommendation**: Option A (make nullable). It's the cleanest long-term. The `device_id` column on data tables is becoming metadata, not an ownership key. A simple migration (`ALTER COLUMN device_id DROP NOT NULL`) is low-risk.

**User input needed before proceeding.**

### 2. Should `authenticated_client` return `user_id` or keep returning `device_id`?

The current fixture returns `tuple[AsyncClient, uuid.UUID]` where UUID is `device_id`. Changing it to `user_id` is correct but breaks test code that uses the second element.

**Recommendation**: Return `user_id` and also expose `device_id` if needed. Change return type to a NamedTuple or just return `user_id` since most tests destructure as `client, _`.

**User input needed if the return semantics should change or if a new fixture name is preferred.**

### 3. Should `test_auth_deps.py` be rewritten or deleted?

Current tests verify device-token auth flows. If device auth is being deprecated:
- Keep tests that verify JWT auth works (missing token, expired, valid)
- Remove/skip tests specific to device-token mechanics
- Or keep device-token tests behind a `ALLOW_DEVICE_AUTH` flag check

**Recommendation**: Rewrite to test JWT auth; add `@pytest.mark.skipif(not settings.allow_device_auth)` for legacy tests.
