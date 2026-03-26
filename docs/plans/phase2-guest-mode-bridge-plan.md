---
type: plan
status: draft
last-updated: 2026-03-26
---

# Implementation Plan: Phase 2 -- Guest Mode Bridge (Claim Local Data Into User Account)

## Overview

Add `user_id` ownership columns to all 5 data tables (products, product_portions, food_entries, user_goals, body_weights), create a claim endpoint that atomically transfers device-scoped data to a user account, update all service queries to support dual-mode filtering (user_id when available, device_id for legacy), and build client screens that detect unclaimed local data and guide the user through claiming it.

## Success Criteria

- [ ] Migration 0013 adds nullable `user_id`, `created_on_device_id`, `updated_on_device_id` columns to 5 tables with indexes
- [ ] `POST /v1/auth/claim-device-data` claims all unclaimed rows for a device, is idempotent, returns counts
- [ ] All 5 service files support dual-mode filtering via `get_owner_filter()` helper
- [ ] Existing device-token-authed endpoints continue to work exactly as before (backward compat)
- [ ] Client `useLocalDataSummary` hook counts local AsyncStorage data
- [ ] `DataClaimScreen` shows summary and triggers claim API call
- [ ] Navigation routes to `DataClaimScreen` after first login when local data exists
- [ ] `AccountScreen` shows "Claim device data" action when unclaimed data detected
- [ ] All new code has test coverage (backend pytest, client vitest)
- [ ] `ruff check`, `tsc --noEmit`, and all tests pass after each phase

## Assumptions

- Phase 1 (Supabase Auth) is complete: `users`, `user_devices` tables exist, `get_current_user()` dependency works -- **validated by reading migration 0012 and `deps.py`**
- All 9 routers currently use `get_current_device_id` (legacy device token auth) -- **validated by reading all router files**
- Backend connects to Supabase-managed Postgres, so Alembic migrations run against the same DB -- **stated in issue**
- `user_id` FK references `users.id` (our local users table), not Supabase's `auth.users.id` -- **validated by examining `User` model in `auth/models.py`**
- The claim endpoint uses Supabase JWT auth (`get_current_user` dependency), not legacy device token -- **matches issue spec**
- Device-to-user mapping is stored in `user_devices` table -- **validated by reading model**
- No existing rows have `user_id` set (column doesn't exist yet) -- **validated: column absent from all 5 models**
- Client AsyncStorage has data keys for products, meals, goal, bodyWeights, waterLogs -- **validated by reading `storage.ts` STORAGE_KEYS**

## Architecture Changes

1. **5 ORM models** gain 3 new nullable columns: `user_id` (FK to users.id), `created_on_device_id` (UUID, no FK), `updated_on_device_id` (UUID, no FK)
2. **New migration 0013**: Adds columns + composite indexes `(user_id, deleted_at)` on each table
3. **New `app/core/ownership.py`**: Shared `get_owner_filter()` helper that returns a SQLAlchemy filter clause
4. **New claim service**: `app/features/auth/claim.py` with `claim_device_data()` function
5. **New claim schema**: Added to `app/features/auth/schemas.py`
6. **New claim endpoint**: Added to `app/features/auth/router.py`
7. **5 service files** updated: Replace `Model.device_id == device_id` with `get_owner_filter()` calls
8. **Client**: New `useLocalDataSummary` hook, new `DataClaimScreen`, updated `AuthContext`, updated `AppNavigator`, updated `AccountScreen`

## Files Affected

### New Files

- `backend/alembic/versions/0013_add_user_ownership_columns.py` -- Migration adding user_id, created_on_device_id, updated_on_device_id to 5 tables
- `backend/app/core/ownership.py` -- Shared `get_owner_filter()` helper
- `backend/app/features/auth/claim.py` -- Claim service (business logic for claiming device data)
- `backend/tests/services/test_claim.py` -- Unit tests for claim service
- `backend/tests/api/test_claim_endpoint.py` -- Integration tests for claim endpoint
- `client/src/hooks/useLocalDataSummary.ts` -- Hook to count local AsyncStorage data
- `client/src/hooks/useLocalDataSummary.test.ts` -- Tests for the hook
- `client/src/hooks/useClaimData.ts` -- Hook wrapping the claim API call
- `client/src/hooks/useClaimData.test.ts` -- Tests for the claim hook
- `client/src/screens/AuthFlow/DataClaimScreen.tsx` -- Screen showing local data summary + claim button (flow-specific component in AuthFlow)
- `client/src/services/auth/claimApi.ts` -- API call for claim-device-data endpoint

### Modified Files

- `backend/app/features/products/models.py` -- Add user_id, created_on_device_id, updated_on_device_id columns
- `backend/app/features/portions/models.py` -- Add user_id, created_on_device_id, updated_on_device_id columns
- `backend/app/features/meals/models.py` -- Add user_id, created_on_device_id, updated_on_device_id columns
- `backend/app/features/goals/models.py` -- Add user_id, created_on_device_id, updated_on_device_id columns
- `backend/app/features/weights/models.py` -- Add user_id, created_on_device_id, updated_on_device_id columns
- `backend/app/features/auth/router.py` -- Add claim-device-data endpoint
- `backend/app/features/auth/schemas.py` -- Add ClaimDeviceDataRequest/Response schemas
- `backend/app/features/products/service.py` -- Use `get_owner_filter()` in queries
- `backend/app/features/portions/service.py` -- Use `get_owner_filter()` in queries
- `backend/app/features/meals/service.py` -- Use `get_owner_filter()` in queries
- `backend/app/features/goals/service.py` -- Use `get_owner_filter()` in queries
- `backend/app/features/weights/service.py` -- Use `get_owner_filter()` in queries
- `backend/app/features/stats/service.py` -- Use `get_owner_filter()` in queries
- `backend/app/features/sync/router.py` -- Use `get_owner_filter()` in queries
- `backend/tests/factories.py` -- Add `create_user` and `create_user_device` factory helpers
- `backend/tests/conftest.py` -- Add `authenticated_supabase_client` fixture that uses JWT auth
- `client/src/app/navigationTypes.ts` -- Add DataClaim to AuthStackParamList
- `client/src/app/AppNavigator.tsx` -- Add DataClaimScreen route, post-login data check flow
- `client/src/services/auth/AuthContext.tsx` -- Add `hasLocalData` state, `claimDeviceData` action
- `client/src/screens/ProfileFlow/AccountScreen.tsx` -- Add "Claim device data" section
- `client/src/storage/storage.ts` -- Add `getLocalDataCounts()` utility function

## Implementation Steps

### Phase 1: Backend Schema & Migration (backend-developer)
Estimate: 7 files

1. **Add ownership columns to ORM models** (`backend/app/features/products/models.py`, `portions/models.py`, `meals/models.py`, `goals/models.py`, `weights/models.py`)
   - Action: Add three columns to each of the 5 models:
     ```
     user_id: Mapped[uuid.UUID | None] = mapped_column(
         UUID(as_uuid=True),
         ForeignKey("users.id", ondelete="SET NULL"),
         nullable=True,
         index=True,
     )
     created_on_device_id: Mapped[uuid.UUID | None] = mapped_column(
         UUID(as_uuid=True), nullable=True,
     )
     updated_on_device_id: Mapped[uuid.UUID | None] = mapped_column(
         UUID(as_uuid=True), nullable=True,
     )
     ```
   - Why: These columns enable user-scoped data ownership and track which device created/last-updated each row
   - Dependencies: None
   - Risk: Low -- adding nullable columns is safe on existing data
   - Note: `created_on_device_id` and `updated_on_device_id` are plain UUIDs (no FK) because they are informational/audit columns; we do not want CASCADE deletes on device removal to null out audit trails
   - Import: Add `ForeignKey` to existing imports if not present; import from `app.features.auth.models` is NOT needed (just string FK reference `"users.id"`)

2. **Create migration 0013** (`backend/alembic/versions/0013_add_user_ownership_columns.py`)
   - Action: Hand-write migration (do NOT autogenerate -- we need precise control over index names):
     - For each of 5 tables (`products`, `product_portions`, `food_entries`, `user_goals`, `body_weights`):
       - `op.add_column(table, sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))`
       - `op.add_column(table, sa.Column("created_on_device_id", postgresql.UUID(as_uuid=True), nullable=True))`
       - `op.add_column(table, sa.Column("updated_on_device_id", postgresql.UUID(as_uuid=True), nullable=True))`
       - `op.create_foreign_key(f"fk_{table}_user_id", table, "users", ["user_id"], ["id"], ondelete="SET NULL")`
       - `op.create_index(f"ix_{table}_user_id", table, ["user_id"])`
       - `op.create_index(f"ix_{table}_user_id_deleted_at", table, ["user_id", "deleted_at"])`
     - Downgrade: drop indexes, drop FK constraints, drop columns (reverse order)
   - Why: Nullable FK + indexes needed before any service changes; composite index `(user_id, deleted_at)` optimizes the most common query pattern
   - Dependencies: ORM models from step 1 must be updated first (for consistency, though migration is independent)
   - Risk: Low -- nullable columns, no data loss
   - Revision chain: `down_revision = "0012_users_and_user_devices"`

Verification:
- `cd backend && ruff check app/`
- `cd backend && pytest --cov=app --cov-report=term-missing` (existing tests should still pass with nullable new columns)

### Phase 2: Ownership Helper & Claim Service (backend-developer)
Estimate: 7 files

1. **Create ownership helper** (`backend/app/core/ownership.py`)
   - Action: Create a module with a `get_owner_filter()` function:
     ```python
     def get_owner_filter(
         model,
         *,
         device_id: uuid.UUID,
         user_id: uuid.UUID | None = None,
     ):
         """Return a SQLAlchemy filter clause for data ownership.

         If user_id is provided, filter by user_id (user-scoped).
         Otherwise, filter by device_id (legacy device-scoped).
         """
         if user_id is not None:
             return model.user_id == user_id
         return model.device_id == device_id
     ```
   - Why: Centralizes the dual-mode logic so all services use the same pattern. When routers eventually switch from `get_current_device_id` to `get_current_user_id`, services just pass `user_id` and the filter changes automatically
   - Dependencies: None
   - Risk: Low
   - Test: Tested indirectly through service tests; could add unit test for the function itself

2. **Add test factory helpers** (`backend/tests/factories.py`)
   - Action: Add `create_user()` and `create_user_device()` factory functions:
     - `create_user(session, *, supabase_id=None, email=None)` -- creates a `User` row
     - `create_user_device(session, *, user_id, device_id)` -- creates a `UserDevice` row
   - Why: Needed by claim tests and future tests that need user-scoped data
   - Dependencies: None
   - Risk: Low

3. **Add authenticated_supabase_client fixture** (`backend/tests/conftest.py`)
   - Action: Add a new fixture `supabase_client` that:
     - Creates a `User` + `Device` + `UserDevice`
     - Generates a valid Supabase-style JWT (using `_make_jwt` pattern from test_auth_endpoints.py)
     - Returns `(client, user_id, device_id)`
   - Why: Claim endpoint requires Supabase JWT auth, not legacy device token
   - Dependencies: Factory helpers from step 2
   - Risk: Low

4. **Create claim service** (`backend/app/features/auth/claim.py`)
   - Action: Create `claim_device_data()` function:
     ```python
     async def claim_device_data(
         session: AsyncSession,
         *,
         user: User,
         device_id: uuid.UUID,
     ) -> dict[str, int]:
     ```
     - Validate `device_id` is linked to the user via `user_devices` table; raise `ValueError` if not
     - For each of the 5 tables, run a bulk UPDATE:
       ```sql
       UPDATE products
       SET user_id = :user_id,
           created_on_device_id = COALESCE(created_on_device_id, device_id),
           updated_on_device_id = device_id
       WHERE device_id = :device_id AND user_id IS NULL
       ```
     - Use `session.execute(update(...).where(...).values(...))` with `returning(func.count())` or use `.rowcount` from result
     - Return dict: `{"products": N, "portions": N, "food_entries": N, "goals": N, "body_weights": N}`
     - All updates in a single transaction (caller commits)
   - Why: Separates business logic from router; makes it testable; idempotent via `WHERE user_id IS NULL`
   - Dependencies: Phase 1 (columns must exist)
   - Risk: Medium -- bulk UPDATE must be correct and performant. Mitigate by testing with multiple rows and verifying idempotency
   - Test: `backend/tests/services/test_claim.py`

5. **Add claim schemas** (`backend/app/features/auth/schemas.py`)
   - Action: Add two schemas:
     ```python
     class ClaimDeviceDataRequest(APIModel):
         device_id: UUID

     class ClaimDeviceDataResponse(APIModel):
         claimed_counts: dict[str, int]
     ```
   - Why: Pydantic request/response validation for the claim endpoint
   - Dependencies: None
   - Risk: Low

6. **Add claim endpoint** (`backend/app/features/auth/router.py`)
   - Action: Add to `auth_router`:
     ```python
     @auth_router.post("/claim-device-data", response_model=ClaimDeviceDataResponse)
     async def claim_device_data_endpoint(
         body: ClaimDeviceDataRequest,
         user: User = Depends(get_current_user),
         session: AsyncSession = Depends(get_session),
     ) -> ClaimDeviceDataResponse:
     ```
     - Call `claim_device_data(session, user=user, device_id=body.device_id)`
     - Catch `ValueError` -> 403 "Device not linked to your account"
     - Commit transaction
     - Return response
   - Why: Thin router pattern -- just wiring
   - Dependencies: Claim service from step 4, schemas from step 5
   - Risk: Low

7. **Write claim tests** (`backend/tests/services/test_claim.py`, `backend/tests/api/test_claim_endpoint.py`)
   - Action: Service tests:
     - `test_claim_sets_user_id_on_all_tables` -- create data for device, claim, verify user_id set
     - `test_claim_is_idempotent` -- claim twice, second returns 0 counts
     - `test_claim_only_affects_unclaimed_rows` -- some rows already claimed by another user, those stay unchanged
     - `test_claim_rejects_unlinked_device` -- device not in user_devices -> ValueError
     - `test_claim_sets_device_tracking_columns` -- verify created_on_device_id and updated_on_device_id
   - Action: API tests:
     - `test_claim_endpoint_success` -- full integration via HTTP
     - `test_claim_endpoint_unlinked_device_returns_403`
     - `test_claim_endpoint_no_auth_returns_401`
     - `test_claim_endpoint_idempotent`
   - Why: TDD -- tests first, then implementation
   - Dependencies: Fixture from step 3
   - Risk: Low

Verification:
- `cd backend && ruff check app/`
- `cd backend && pytest --cov=app --cov-report=term-missing`

### Phase 3: Dual-Mode Query Support (backend-developer)
Estimate: 8 files

This phase updates all service files to use `get_owner_filter()`. Since routers currently only pass `device_id`, behavior is unchanged. This is pure preparation for future router migration.

1. **Update products service** (`backend/app/features/products/service.py`)
   - Action: Add `user_id: uuid.UUID | None = None` parameter to all functions that filter by device_id. Replace `Product.device_id == device_id` with `get_owner_filter(Product, device_id=device_id, user_id=user_id)`. Specifically update:
     - `get_product_by_barcode`
     - `create_product` (keep device_id for INSERT, use filter for barcode dedup check)
     - `list_products`
     - `get_product`
     - `update_product`
     - `check_product_name_available`
     - `search_products` (user products query only)
     - `soft_delete_product`
   - For CREATE operations: always set `device_id` on the new row (required FK), and also set `user_id`, `created_on_device_id`, `updated_on_device_id` when user_id is provided
   - Why: Enables future switch from device to user scoping without changing service logic again
   - Dependencies: Ownership helper from Phase 2
   - Risk: Medium -- many functions touched. Mitigate with existing tests that still pass (backward compat)

2. **Update portions service** (`backend/app/features/portions/service.py`)
   - Action: Same pattern as products -- add `user_id` param, use `get_owner_filter(ProductPortion, ...)` for queries. Also update create_portion to set ownership columns on INSERT.
   - Dependencies: Phase 2 step 1
   - Risk: Medium

3. **Update meals service** (`backend/app/features/meals/service.py`)
   - Action: Same pattern for FoodEntry queries. Also update `_get_portion` internal helper.
   - Dependencies: Phase 2 step 1
   - Risk: Medium

4. **Update goals service** (`backend/app/features/goals/service.py`)
   - Action: Same pattern for UserGoal queries. Update `get_current_goal`, `get_goal`, `create_calculated_goal`, `create_manual_goal`, `update_goal`, `soft_delete_goal`, `_soft_delete_existing_goals`.
   - Dependencies: Phase 2 step 1
   - Risk: Medium

5. **Update weights service** (`backend/app/features/weights/service.py`)
   - Action: Same pattern for BodyWeight queries.
   - Dependencies: Phase 2 step 1
   - Risk: Medium

6. **Update stats service** (`backend/app/features/stats/service.py`)
   - Action: Add `user_id: uuid.UUID | None = None` to `get_day_stats` and `get_daily_stats`. Use `get_owner_filter(FoodEntry, ...)` in the join query.
   - Dependencies: Phase 2 step 1
   - Risk: Low

7. **Update sync router** (`backend/app/features/sync/router.py`)
   - Action: Add `user_id` param support to the sync_since query. Use `get_owner_filter()` for each of the 3 models queried.
   - Dependencies: Phase 2 step 1
   - Risk: Low

8. **Verify existing tests still pass**
   - Action: Run full test suite. All tests pass because they still pass `device_id` and `user_id=None` (default), so filter behavior is identical.
   - Why: Backward compatibility verification
   - Risk: Low

Verification:
- `cd backend && ruff check app/`
- `cd backend && pytest --cov=app --cov-report=term-missing`

### Phase 4: Client -- Local Data Summary & Claim API (fe-developer)
Estimate: 5 files

1. **Add `getLocalDataCounts()` utility** (`client/src/storage/storage.ts`)
   - Action: Add an exported function at the bottom of storage.ts:
     ```typescript
     export type LocalDataCounts = {
       products: number;
       meals: number;
       goals: number;
       bodyWeights: number;
       waterLogs: number;
     };

     export const getLocalDataCounts = async (): Promise<LocalDataCounts> => {
       const [products, meals, goal, bodyWeights, waterLogs] = await Promise.all([
         loadProducts(),
         loadMeals(),
         loadGoal(),
         loadBodyWeights(),
         loadWaterLogs(),
       ]);
       return {
         products: products.length,
         meals: meals.length,
         goals: goal ? 1 : 0,
         bodyWeights: bodyWeights.length,
         waterLogs: waterLogs.length,
       };
     };

     export const hasAnyLocalData = async (): Promise<boolean> => {
       const counts = await getLocalDataCounts();
       return Object.values(counts).some(c => c > 0);
     };
     ```
   - Why: Thin wrapper reusing existing loaders; separates counting from UI
   - Dependencies: None
   - Risk: Low
   - Test: Tested via useLocalDataSummary hook test

2. **Create claim API client** (`client/src/services/auth/claimApi.ts`)
   - Action: Create file with:
     ```typescript
     import { apiFetch } from "@services/api/http";

     export type ClaimDeviceDataResponse = {
       claimed_counts: {
         products: number;
         portions: number;
         food_entries: number;
         goals: number;
         body_weights: number;
       };
     };

     export const claimDeviceData = async (
       deviceId: string,
     ): Promise<ClaimDeviceDataResponse> => {
       return apiFetch<ClaimDeviceDataResponse>("/v1/auth/claim-device-data", {
         method: "POST",
         body: { device_id: deviceId },
       });
     };
     ```
   - Why: Follows existing authApi.ts pattern
   - Dependencies: None
   - Risk: Low

3. **Create `useLocalDataSummary` hook** (`client/src/hooks/useLocalDataSummary.ts`)
   - Action: Hook that loads counts on mount and exposes `{ counts, isLoading, hasData, refresh }`:
     ```typescript
     export type UseLocalDataSummaryResult = {
       counts: LocalDataCounts | null;
       isLoading: boolean;
       hasData: boolean;
       refresh: () => void;
     };
     ```
     - On mount: call `getLocalDataCounts()`, set state
     - `hasData`: derived from counts -- true if any count > 0
   - Why: Screens need to know if there's local data to claim
   - Dependencies: Step 1
   - Risk: Low

4. **Create `useClaimData` hook** (`client/src/hooks/useClaimData.ts`)
   - Action: Hook that wraps the claim API call:
     ```typescript
     export type UseClaimDataResult = {
       claimData: () => Promise<ClaimDeviceDataResponse>;
       isClaiming: boolean;
       error: string | null;
       result: ClaimDeviceDataResponse | null;
     };
     ```
     - `claimData()`: gets deviceId from `getOrCreateDeviceId()`, calls `claimDeviceData(deviceId)`
     - Manages loading/error state
   - Why: Keeps API call logic out of screens
   - Dependencies: Step 2
   - Risk: Low

5. **Write hook tests** (`client/src/hooks/useLocalDataSummary.test.ts`, `client/src/hooks/useClaimData.test.ts`)
   - Action: Test useLocalDataSummary:
     - `test_returns_counts_when_data_exists` -- mock storage loaders to return data
     - `test_returns_zero_counts_when_empty` -- mock storage loaders to return empty
     - `test_hasData_is_true_when_any_count_positive`
     - `test_hasData_is_false_when_all_zero`
   - Action: Test useClaimData:
     - `test_calls_api_with_device_id` -- mock claimApi and device storage
     - `test_sets_error_on_failure`
     - `test_sets_result_on_success`
   - Why: TDD
   - Dependencies: Steps 3, 4
   - Risk: Low

Verification:
- `cd client && npx tsc --noEmit`
- `cd client && pnpm test`

### Phase 5: Client -- DataClaimScreen & Navigation (fe-developer)
Estimate: 5 files

1. **Update navigation types** (`client/src/app/navigationTypes.ts`)
   - Action: Add `DataClaim` to `AuthStackParamList`:
     ```typescript
     export type AuthStackParamList = {
       Login: undefined;
       MagicLinkSent: { email: string };
       DataClaim: undefined;
     };
     ```
   - Why: Type-safe navigation to the new screen
   - Dependencies: None
   - Risk: Low

2. **Create DataClaimScreen** (`client/src/screens/AuthFlow/DataClaimScreen.tsx`)
   - Action: Flow-specific screen (lives in AuthFlow because it's part of the auth onboarding). Shows:
     - Summary of local data counts (products, meals, goal, body weights, water logs)
     - "Attach to my account" button that calls `useClaimData().claimData()`
     - "Skip" button that navigates to the main app
     - Loading/error/success states
     - After successful claim: auto-navigate to main app
   - Pattern: Follow existing LoginScreen pattern (SafeAreaView, useTheme, useAuth, StyleSheet.create inside component)
   - Why: Users need to see what data will be claimed and confirm
   - Dependencies: Phase 4 hooks
   - Risk: Low

3. **Update AuthContext** (`client/src/services/auth/AuthContext.tsx`)
   - Action: After successful sign-in (in `onAuthStateChange` SIGNED_IN handler), check for local data:
     - After `performLinkDevice()`, call `hasAnyLocalData()` from storage.ts
     - Add a new state field `needsDataClaim: boolean` to AuthState when authenticated
     - Update AuthContextValue type to include `needsDataClaim` and `setDataClaimed: () => void`
   - Alternative approach (simpler): Do NOT put this in AuthContext. Instead, have AppNavigator check for local data independently. This avoids complicating the auth state machine.
   - **Recommended approach**: Keep AuthContext unchanged. Add the local data check directly in AppNavigator's authenticated branch. Simpler, fewer changes to AuthContext, and the data claim check is a navigation concern, not an auth concern.
   - Dependencies: Phase 4 `hasAnyLocalData`
   - Risk: Medium -- must not break existing auth flow

4. **Update AppNavigator** (`client/src/app/AppNavigator.tsx`)
   - Action:
     - Import DataClaimScreen
     - Add `DataClaim` screen to AuthStack (so it can be shown right after login but before main app)
     - Actually, better approach: Create a **transitional state** in the authenticated flow:
       - Add a `useState<boolean | null>(null)` for `hasUnclaimed` in AppNavigator
       - When `status === "authenticated"`, check `hasAnyLocalData()` on mount
       - If `hasUnclaimed === null`, show loading (null)
       - If `hasUnclaimed === true`, show a temporary navigator with DataClaimScreen
       - If `hasUnclaimed === false`, show TabNavigator
       - DataClaimScreen sets `hasUnclaimed = false` when done (claim or skip)
     - Alternative: Add DataClaimScreen as the first screen in a new "OnboardingStack" that wraps between auth and tab navigation
     - **Recommended approach**: Simplest is to create an intermediate "PostAuthGate" component:
       ```
       const PostAuthGate = () => {
         const [checkDone, setCheckDone] = useState(false);
         const [showClaim, setShowClaim] = useState(false);

         useEffect(() => {
           hasAnyLocalData().then(has => {
             setShowClaim(has);
             setCheckDone(true);
           });
         }, []);

         if (!checkDone) return null; // or splash
         if (showClaim) return <DataClaimScreen onComplete={() => setShowClaim(false)} />;
         return <TabNavigator />;
       };
       ```
       In AppNavigator, replace `<TabNavigator />` with `<PostAuthGate />`
   - Why: Users who just logged in with pre-existing local data should see the claim screen before reaching the main app
   - Dependencies: DataClaimScreen from step 2
   - Risk: Medium -- navigation flow change. Must test that: (a) fresh users go straight to tabs, (b) users with local data see claim screen, (c) after claim/skip, they see tabs, (d) on subsequent app opens, they go straight to tabs
   - Important: The `hasAnyLocalData()` check should only happen ONCE after login, not on every app open. Solution: store a flag in AsyncStorage `@countOnMe/data-claimed/v1` that is set after claim or skip. Check this flag first; if set, skip the data check entirely.

5. **Add claimed flag to storage** (`client/src/storage/storage.ts`)
   - Action: Add a new storage key and helpers:
     ```typescript
     // In STORAGE_KEYS:
     dataClaimed: `${STORAGE_PREFIX}/data-claimed/${STORAGE_VERSION_V1}`,

     // New exports:
     export const isDataClaimed = async (): Promise<boolean> => {
       const value = await AsyncStorage.getItem(STORAGE_KEYS.dataClaimed);
       return value === "true";
     };

     export const setDataClaimed = async (): Promise<void> => {
       await AsyncStorage.setItem(STORAGE_KEYS.dataClaimed, "true");
     };
     ```
   - Why: Prevents the claim screen from showing on every app open
   - Dependencies: None
   - Risk: Low

Verification:
- `cd client && npx tsc --noEmit`
- `cd client && pnpm test`
- Manual: Open app -> login -> see DataClaimScreen if local data exists -> claim or skip -> see main app -> reopen app -> go straight to main app

### Phase 6: AccountScreen Enhancement (fe-developer)
Estimate: 2 files

1. **Update AccountScreen** (`client/src/screens/ProfileFlow/AccountScreen.tsx`)
   - Action: Add a "Claim device data" section:
     - Use `useLocalDataSummary` hook to check if there's unclaimed local data
     - If `hasData` is true, show a card with:
       - "You have unclaimed data on this device" message
       - Summary counts
       - "Claim Data" button that calls `useClaimData().claimData()`
       - Success toast/message after claim
     - If `hasData` is false (or data already claimed), hide the section
   - Why: Users who skipped the initial claim screen can still claim their data later
   - Dependencies: Phase 4 hooks, Phase 5 storage flag
   - Risk: Low

2. **Write AccountScreen test additions**
   - Action: If `AccountScreen.test.tsx` exists, add tests for the claim section. If not, create basic test for the new functionality.
   - Dependencies: Step 1
   - Risk: Low

Verification:
- `cd client && npx tsc --noEmit`
- `cd client && pnpm test`

## Testing Strategy

### Unit tests (backend)
- `backend/tests/services/test_claim.py` -- Tests for `claim_device_data()` service function (5+ test cases)
- `backend/tests/api/test_claim_endpoint.py` -- Integration tests for `POST /v1/auth/claim-device-data` (4+ test cases)
- Existing service tests in `test_products_db.py`, `test_portions_db.py`, `test_food_entries_db.py`, `test_goals_db.py`, `test_weights_db.py` must still pass (backward compat)

### Unit tests (client)
- `client/src/hooks/useLocalDataSummary.test.ts` -- Tests for local data counting hook
- `client/src/hooks/useClaimData.test.ts` -- Tests for claim API hook
- `client/src/storage/storage.ts` -- If a test file exists, add tests for `getLocalDataCounts`, `hasAnyLocalData`, `isDataClaimed`, `setDataClaimed`

### Integration tests
- Backend: Full HTTP round-trip for claim endpoint (create data -> link device -> claim -> verify)
- Client: Navigation flow test (mock auth state + local data -> verify correct screen shown)

### Manual verification
- Fresh install: Login -> no DataClaimScreen shown -> straight to tabs
- Existing user with local data: Login -> DataClaimScreen with counts -> "Attach" -> success -> tabs
- Existing user with local data: Login -> DataClaimScreen -> "Skip" -> tabs -> Profile -> Account -> see "Claim" section
- Claim is idempotent: Run claim twice, second time shows 0 new claims

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Migration 0013 on large production data | Medium | Columns are nullable, no data rewrite needed. `ADD COLUMN ... NULL` is fast in Postgres. Indexes created CONCURRENTLY would be ideal but Alembic doesn't support it easily; for current data volumes this is fine. |
| Bulk UPDATE in claim could be slow for users with thousands of rows | Low | The WHERE clause uses indexed `device_id` column. 5 separate UPDATE statements within one transaction is acceptable. |
| Dual-mode filter introduces subtle bugs in services | Medium | All existing tests continue to pass (they use device_id path). Add new tests specifically for user_id path in Phase 3. |
| PostAuthGate flash on every app open | Medium | Use `isDataClaimed()` flag check before `hasAnyLocalData()`. Flag check is a single AsyncStorage read (fast). |
| Race condition: user logs in on two devices simultaneously, both try to claim | Low | `WHERE user_id IS NULL` ensures idempotency. Second claim gets 0 counts. No data corruption possible. |
| Breaking existing device-token auth flow | High | Phase 3 only adds optional `user_id` param with `None` default. All existing router -> service calls are unchanged. |

## Open Questions

1. **Water logs**: The issue mentions 5 tables (products, portions, food_entries, goals, body_weights) but the client has `waterLogs` in AsyncStorage. Water logs do NOT exist as a backend table -- they are client-only. Should the DataClaimScreen show water log counts for informational purposes even though they cannot be claimed server-side? **Recommendation**: Show them in the summary but note they are "local only" -- no backend claim needed.

2. **data_router**: The `data` feature (`app/features/data/service.py`) does a bulk soft-delete of food entries by device_id. It should also get `get_owner_filter()` support in Phase 3. Added to Phase 3 scope as step 7b.

3. **Claim on every device link or only explicit action?**: The issue says explicit "claim-device-data" endpoint. But should we auto-claim when a device is linked? **Recommendation**: No -- keep it explicit. Auto-claiming could be confusing and the user should confirm.

4. **PostAuthGate vs AuthContext approach**: The plan recommends PostAuthGate (simpler). User should confirm this approach is acceptable vs. extending AuthContext with `needsDataClaim` state.

5. **Should services in Phase 3 also be updated to SET user_id/device tracking on new creates?**: When a service creates a new product via `create_product()`, should it also set `user_id` if the caller has a user context? **Recommendation**: Yes -- add optional `user_id` param to create functions. But routers do not pass it yet (they only have device_id from `get_current_device_id`). This prepares for Phase 3+ when routers switch to user-based auth. For now, new rows will have `user_id=NULL` until claimed.
