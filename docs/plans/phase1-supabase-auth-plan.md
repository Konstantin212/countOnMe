# Implementation Plan: Phase 1 — Supabase Auth + Users/Devices Tables

## Overview

Add real user identity to CountOnMe by integrating Supabase Auth (email magic link). This introduces `users` and `user_devices` tables on the backend, JWT verification in the FastAPI dependency layer, three new auth endpoints, and a complete client-side auth flow with gated navigation. After this phase, users must create an account on first launch and all API requests carry a Supabase JWT instead of the legacy device token.

## Success Criteria

- [ ] Backend: `users` and `user_devices` tables exist (Alembic migration 0012)
- [ ] Backend: `GET /v1/auth/me` returns user profile with linked devices
- [ ] Backend: `POST /v1/auth/link-device` links a device to the authenticated user (optionally migrating legacy device data)
- [ ] Backend: `DELETE /v1/auth/account` soft-deletes user data and removes Supabase auth record
- [ ] Backend: `get_current_user()` / `get_current_user_id()` dependency validates Supabase JWTs (HS256)
- [ ] Backend: All existing tests still pass (existing endpoints still use `get_current_device_id` for now; migration to `user_id` scoping is Phase 2)
- [ ] Client: Supabase JS SDK initialized with SecureStore adapter
- [ ] Client: AuthContext + useAuth hook manage session lifecycle
- [ ] Client: LoginScreen (email input, send magic link)
- [ ] Client: MagicLinkSentScreen (waiting state + fallback 6-digit code entry)
- [ ] Client: Auth-gated navigation: unauthenticated -> auth stack, authenticated -> main app
- [ ] Client: Deep link handling for `countonme://auth/callback`
- [ ] Client: `apiFetch` sends Supabase JWT (not legacy device token) in Authorization header
- [ ] Client: AccountScreen accessible from Profile (email, devices, logout, delete account)
- [ ] Client: All existing tests still pass

## Assumptions

- **Supabase uses HS256 for JWT verification** (confirmed by user correction; Supabase signs JWTs with the `SUPABASE_JWT_SECRET` using HS256, not RS256/JWKS). The ADR-006 mentions JWKS but the user explicitly corrected this. We will use `PyJWT` with HS256 and the secret from env vars.
- **Supabase project is already configured** with Resend SMTP and `countonme://auth/callback` in allowed redirect URLs.
- **No guest mode** — account required on first launch (user confirmed; contradicts original issue AC).
- **Existing device-token endpoints continue to work** during this phase for backward compatibility. The `POST /v1/devices/register` endpoint is NOT removed yet. Phase 2 will migrate data ownership from `device_id` to `user_id`.
- **`expo-secure-store` works in Expo Go** with limitations (no biometric protection, but basic key-value encryption works). Full encryption requires a development build.
- **Magic link fallback**: Supabase magic link emails include a 6-digit OTP code that can be entered manually when deep linking fails. We need a code entry screen.
- **The backend connects to Supabase's hosted Postgres** by changing `DATABASE_URL` in `.env`. This is a deployment concern, not a code change (the connection string format is the same).

## Architecture Changes

- **New backend model**: `User` in `backend/app/features/auth/models.py` — `id`, `supabase_id`, `email`, timestamps
- **New backend model**: `UserDevice` in `backend/app/features/auth/models.py` — `id`, `user_id`, `device_id`, `device_name`, timestamps
- **New backend dependency**: `get_current_user()` and `get_current_user_id()` in `backend/app/core/deps.py` — JWT validation with HS256
- **New backend service functions**: `get_or_create_user()`, `link_device_to_user()`, `get_user_profile()`, `delete_user_account()` in `backend/app/features/auth/service.py`
- **New backend schemas**: `LinkDeviceRequest`, `UserProfileResponse`, `UserDeviceResponse` in `backend/app/features/auth/schemas.py`
- **New backend endpoints**: `/v1/auth/link-device`, `/v1/auth/me`, `/v1/auth/account` in `backend/app/features/auth/router.py`
- **New backend setting**: `supabase_jwt_secret` in `backend/app/settings.py`
- **New client service**: `client/src/services/supabase.ts` — Supabase client initialization with SecureStore adapter
- **New client context**: `client/src/services/auth/AuthContext.tsx` — AuthProvider + useAuth hook
- **New client screens**: `LoginScreen.tsx`, `MagicLinkSentScreen.tsx` in `client/src/screens/AuthFlow/`
- **New client screen**: `AccountScreen.tsx` in `client/src/screens/ProfileFlow/` (or added to Profile stack)
- **Modified client**: `App.tsx` — wrap with AuthProvider, gate navigation on auth state
- **Modified client**: `AppNavigator.tsx` — conditional rendering based on auth state
- **Modified client**: `client/src/services/api/http.ts` — use Supabase session token instead of device token

## Files Affected

### New Files

#### Backend
- `backend/alembic/versions/0012_users_and_user_devices.py` — Migration for users + user_devices tables
- `backend/tests/services/test_auth_jwt.py` — Unit tests for JWT verification and user service functions
- `backend/tests/api/test_auth_endpoints.py` — Integration tests for new auth endpoints

#### Client
- `client/src/services/supabase.ts` — Supabase client initialization with SecureStore adapter
- `client/src/services/auth/AuthContext.tsx` — AuthProvider, AuthContext, useAuth hook
- `client/src/services/auth/authApi.ts` — API calls for link-device, me, delete-account
- `client/src/screens/AuthFlow/LoginScreen.tsx` — Email input + send magic link (flow-specific)
- `client/src/screens/AuthFlow/MagicLinkSentScreen.tsx` — Waiting + fallback OTP code entry (flow-specific)
- `client/src/screens/AuthFlow/AccountScreen.tsx` — Profile, devices, logout, delete account (flow-specific to auth management, but navigated from Profile)

### Modified Files

#### Backend
- `backend/app/features/auth/models.py` — Add `User` and `UserDevice` models
- `backend/app/features/auth/service.py` — Add JWT decode, get_or_create_user, link_device, delete_account functions
- `backend/app/features/auth/router.py` — Add `/auth/link-device`, `/auth/me`, `/auth/account` endpoints
- `backend/app/features/auth/schemas.py` — Add request/response schemas for new endpoints
- `backend/app/core/deps.py` — Add `get_current_user()` and `get_current_user_id()` dependencies
- `backend/app/settings.py` — Add `supabase_jwt_secret` setting
- `backend/app/main.py` — Register new auth router (currently only has devices_router from auth)
- `backend/alembic/env.py` — Models already auto-imported via `from app.features.auth import models`
- `backend/pyproject.toml` — Add `PyJWT` dependency
- `backend/tests/conftest.py` — Add `authenticated_user_client` fixture, update table creation for new models
- `.env` — Already has `SUPABASE_JWT_SECRET` defined

#### Client
- `client/package.json` — Add `@supabase/supabase-js`, `expo-secure-store` dependencies
- `client/app.config.js` — Add `scheme: "countonme"`, pass Supabase env vars via `extra`
- `client/App.tsx` — Wrap with AuthProvider, conditional root navigation
- `client/src/app/AppNavigator.tsx` — Add AuthStack for unauthenticated state
- `client/src/app/navigationTypes.ts` — Add AuthStackParamList
- `client/src/services/api/http.ts` — Replace device token with Supabase JWT in Authorization header
- `client/src/storage/device.ts` — Keep `getOrCreateDeviceId()`, deprecate token functions
- `client/src/screens/ProfileScreen.tsx` — Add "Account" menu item navigating to AccountScreen
- `client/src/app/navigationTypes.ts` — Add AccountScreen to ProfileStackParamList

## Implementation Phases

### Phase 1A: Backend — Database Models + Migration
**Agent**: `backend-developer`
**Estimate**: 4 files

1. **Add `PyJWT` dependency** (`backend/pyproject.toml`)
   - Action: Add `PyJWT = "^2.9.0"` to `[tool.poetry.dependencies]`
   - Why: Needed for HS256 JWT verification. We use PyJWT (not python-jose) because it is actively maintained, has fewer dependencies, and directly supports HS256 verification.
   - Dependencies: None
   - Risk: Low
   - Test: `python -c "import jwt; print(jwt.__version__)"`

2. **Add `User` and `UserDevice` models** (`backend/app/features/auth/models.py`)
   - Action: Add `User` model with columns: `id` (UUID PK), `supabase_id` (UUID UNIQUE NOT NULL), `email` (Text nullable), `created_at`, `updated_at`. Add `UserDevice` model with columns: `id` (UUID PK), `user_id` (UUID FK to users.id ON DELETE CASCADE), `device_id` (UUID FK to devices.id ON DELETE CASCADE), `device_name` (Text nullable), `linked_at` (timestamptz), `last_seen_at` (timestamptz). Add UNIQUE constraint on `(user_id, device_id)`.
   - Why: Core identity tables per ADR-005. The `User` table links to Supabase's `auth.users` via `supabase_id` without a direct FK (Supabase manages that schema).
   - Dependencies: None
   - Risk: Low
   - Test: `python -c "from app.features.auth.models import User, UserDevice"` — imports without error

3. **Create Alembic migration** (`backend/alembic/versions/0012_users_and_user_devices.py`)
   - Action: Run `alembic revision --autogenerate -m "users_and_user_devices"`, then review and hand-edit. Ensure the migration creates `users` table first, then `user_devices` (FK dependency). Add index on `user_devices(user_id)` and `user_devices(device_id)`. Verify the autogenerated migration does NOT touch existing tables.
   - Why: Tables must exist before service code can reference them.
   - Dependencies: Step 2
   - Risk: Medium — autogenerate may produce unexpected changes. Review carefully.
   - Test: `alembic upgrade head` succeeds; `alembic downgrade -1` succeeds; tables exist in DB.

4. **Update test conftest** (`backend/tests/conftest.py`)
   - Action: Import `User` and `UserDevice` models in the `test_engine` fixture's model registration tuple. Add `User` and `UserDevice` to the list so `Base.metadata.create_all` picks them up in tests.
   - Why: Tests need these tables to exist for the new auth fixtures.
   - Dependencies: Step 2
   - Risk: Low
   - Test: Existing test suite still passes.

**Verification**: `cd backend && ruff check app/ && pytest --cov=app --cov-report=term-missing`

---

### Phase 1B: Backend — JWT Verification + Settings
**Agent**: `backend-developer`
**Estimate**: 4 files (new tests + modified files)

1. **Add `supabase_jwt_secret` to Settings** (`backend/app/settings.py`)
   - Action: Add `supabase_jwt_secret: str = ""` field. In non-local environments, validate it is non-empty (similar to pepper validation). For local dev, allow empty (tests mock JWT verification).
   - Why: The HS256 secret is needed to verify Supabase access tokens.
   - Dependencies: Phase 1A
   - Risk: Low
   - Test: Settings loads without error when env var is set.

2. **Add JWT decode function** (`backend/app/features/auth/service.py`)
   - Action: Add `decode_supabase_jwt(token: str) -> dict` function that uses `jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated")`. Returns the decoded payload dict. Raises `jwt.InvalidTokenError` on failure. Add `get_or_create_user(session, supabase_id, email) -> User` function. Add `get_user_with_devices(session, user_id) -> User | None`.
   - Why: Central JWT verification logic, user lookup/creation.
   - Dependencies: Step 1
   - Risk: Medium — must verify exact Supabase JWT claims (`sub`, `aud`, `exp`). The `aud` claim is `"authenticated"` for logged-in users.
   - Test: Unit tests with crafted JWTs (signed with a test secret).

3. **Add `get_current_user()` and `get_current_user_id()` dependencies** (`backend/app/core/deps.py`)
   - Action: Add new dependency functions that: (a) extract Bearer token, (b) call `decode_supabase_jwt()`, (c) extract `sub` claim as `supabase_id`, (d) look up `User` by `supabase_id`, (e) return `User` / `user.id`. On any failure, raise 401. Keep existing `get_current_device()` and `get_current_device_id()` unchanged for backward compatibility.
   - Why: New endpoints use `get_current_user_id()`. Existing endpoints continue using `get_current_device_id()` until Phase 2.
   - Dependencies: Step 2
   - Risk: Medium — must handle case where user exists in Supabase but not yet in our `users` table (first request after signup). Decision: `get_current_user()` should NOT auto-create; only `link-device` creates the user. If user not found, return 401 with "User not linked" message, prompting client to call link-device.
   - Test: Unit tests mocking JWT decode.

4. **Write tests for JWT verification** (`backend/tests/services/test_auth_jwt.py`)
   - Action: TDD — write tests FIRST for: (a) `decode_supabase_jwt` with valid token, (b) expired token, (c) wrong secret, (d) missing `sub` claim, (e) wrong audience. Then for `get_or_create_user`: (a) creates new user, (b) returns existing user, (c) updates email if changed.
   - Why: JWT verification is security-critical; must be thoroughly tested.
   - Dependencies: Steps 1-2
   - Risk: Low
   - Test: `pytest tests/services/test_auth_jwt.py -v`

**Verification**: `cd backend && ruff check app/ && pytest --cov=app --cov-report=term-missing`

---

### Phase 1C: Backend — Auth Endpoints
**Agent**: `backend-developer`
**Estimate**: 4 files

1. **Add request/response schemas** (`backend/app/features/auth/schemas.py`)
   - Action: Add schemas:
     - `LinkDeviceRequest`: `device_id: UUID`, `device_name: str | None = None`, `legacy_device_token: str | None = None`
     - `UserDeviceResponse(APIModel)`: `id: UUID`, `device_id: UUID`, `device_name: str | None`, `linked_at: datetime`, `last_seen_at: datetime`
     - `UserProfileResponse(APIModel)`: `id: UUID`, `email: str | None`, `created_at: datetime`, `devices: list[UserDeviceResponse]`
   - Why: Typed request/response contracts for the three new endpoints.
   - Dependencies: Phase 1B
   - Risk: Low
   - Test: Schema instantiation tests (Pydantic validates).

2. **Add service functions for endpoints** (`backend/app/features/auth/service.py`)
   - Action: Add:
     - `link_device_to_user(session, user: User, device_id, device_name, legacy_token) -> UserDevice` — Creates user_devices row. If `legacy_token` provided, verify it against the device's `token_hash` (backward compat for migration). If device doesn't exist, create it.
     - `get_user_profile(session, user_id) -> User` — Eagerly loads user_devices.
     - `delete_user_account(session, user_id) -> None` — Soft-deletes all user data (future: for now just deletes `user_devices` and `users` row since data is still device-scoped). Does NOT call Supabase Admin API yet (deferred to Phase 2 or handled separately).
   - Why: Business logic must not live in routers.
   - Dependencies: Step 1
   - Risk: Medium — `link_device_to_user` with legacy token verification touches both old and new auth systems.
   - Test: Integration tests.

3. **Add auth endpoints** (`backend/app/features/auth/router.py`)
   - Action: Add a NEW router `auth_router = APIRouter(prefix="/auth", tags=["auth"])` (separate from existing `devices` router). Add:
     - `POST /auth/link-device` — Depends on `get_current_user()`. Calls `link_device_to_user()`. Returns 200 with `UserDeviceResponse`.
     - `GET /auth/me` — Depends on `get_current_user()`. Returns `UserProfileResponse`.
     - `DELETE /auth/account` — Depends on `get_current_user()`. Calls `delete_user_account()`. Returns 204.
   - Note: The `get_current_user()` dependency will auto-create the user on first call via `get_or_create_user()` (revision from Phase 1B step 3 — change decision: `get_current_user()` SHOULD auto-create the user from the JWT `sub` and `email` claims, because link-device is called immediately after login). This simplifies the flow.
   - Why: Thin router pattern — wiring only.
   - Dependencies: Steps 1-2, Phase 1B step 3
   - Risk: Low
   - Test: Integration tests via `app_client`.

4. **Register auth_router in main.py and write integration tests** (`backend/app/main.py`, `backend/tests/api/test_auth_endpoints.py`)
   - Action: Import and register `auth_router` in `create_app()`. Write TDD integration tests:
     - `test_link_device_creates_user_device` — POST with valid JWT + device_id
     - `test_link_device_with_legacy_token` — POST with JWT + legacy device token in body
     - `test_link_device_duplicate_is_idempotent` — POST same device twice returns same link
     - `test_me_returns_profile` — GET /auth/me with linked device
     - `test_me_without_user_returns_401` — GET /auth/me without valid JWT
     - `test_delete_account` — DELETE /auth/account removes user data
   - Add a `authenticated_user_client` fixture to `conftest.py` that creates a User + JWT token for testing.
   - Why: Verify endpoints work end-to-end.
   - Dependencies: Steps 1-3
   - Risk: Medium — need to generate valid JWTs in tests. Use `PyJWT` to sign test tokens with a test secret. Set `SUPABASE_JWT_SECRET=test-jwt-secret` in test env.
   - Test: `pytest tests/api/test_auth_endpoints.py -v`

**Verification**: `cd backend && ruff check app/ && pytest --cov=app --cov-report=term-missing`

---

### Phase 1D: Client — Supabase SDK + Auth Context
**Agent**: `fe-developer`
**Can run in parallel with**: Phase 1B and 1C (backend) once Phase 1A migration schema is agreed upon
**Estimate**: 6 files

1. **Install dependencies**
   - Action: `cd client && pnpm add @supabase/supabase-js expo-secure-store expo-linking`
   - Why: Supabase JS SDK for auth flows, SecureStore for encrypted token storage, expo-linking for deep link handling.
   - Dependencies: None
   - Risk: Low — check for peer dependency conflicts.
   - Test: `pnpm list @supabase/supabase-js expo-secure-store expo-linking`

2. **Update app.config.js** (`client/app.config.js`)
   - Action: Add `scheme: "countonme"` to the `expo` config object. Add `expo-secure-store` to plugins array (if needed). Pass Supabase env vars:
     ```js
     extra: {
       apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
       supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
       supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
     },
     ```
   - Why: Deep linking requires scheme. Supabase SDK needs URL + anon key.
   - Dependencies: None
   - Risk: Low
   - Test: Expo config loads without error (`npx expo config --type public`).

3. **Create Supabase client** (`client/src/services/supabase.ts`)
   - Action: Create the Supabase client with SecureStore adapter:
     ```typescript
     import { createClient } from '@supabase/supabase-js';
     import * as SecureStore from 'expo-secure-store';
     import Constants from 'expo-constants';

     const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
     const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

     const secureStoreAdapter = {
       getItem: (key: string) => SecureStore.getItemAsync(key),
       setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
       removeItem: (key: string) => SecureStore.deleteItemAsync(key),
     };

     export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
       auth: {
         storage: secureStoreAdapter,
         autoRefreshToken: true,
         persistSession: true,
         detectSessionInUrl: false, // We handle deep links manually
       },
     });
     ```
   - Why: Single Supabase client instance shared across the app.
   - Dependencies: Steps 1-2
   - Risk: Medium — `detectSessionInUrl: false` is critical for React Native. Supabase should NOT try to parse the URL automatically; we handle deep link tokens manually.
   - Test: Module imports without error. Supabase client is created.

4. **Create AuthContext + useAuth hook** (`client/src/services/auth/AuthContext.tsx`)
   - Action: Create AuthProvider that:
     - Defines `AuthState` type: `{ status: 'loading' } | { status: 'unauthenticated' } | { status: 'authenticated'; user: { id: string; email: string | null }; accessToken: string }`
     - On mount: calls `supabase.auth.getSession()` to check for existing session
     - Subscribes to `supabase.auth.onAuthStateChange()` — updates state on `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`
     - Exposes actions: `signInWithEmail(email: string)` (calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: 'countonme://auth/callback' } })`), `verifyOtp(email: string, token: string)` (fallback: calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`), `signOut()`, `deleteAccount()`
     - Exposes `session` (Supabase Session object) for access token retrieval
   - Why: Central auth state management. All screens and hooks consume this.
   - Dependencies: Step 3
   - Risk: Medium — auth state transitions must be correct. `onAuthStateChange` can fire multiple times.
   - Test: Hook unit tests with mocked supabase client.

5. **Create auth API service** (`client/src/services/auth/authApi.ts`)
   - Action: Create functions that call the backend auth endpoints:
     - `linkDevice(deviceId: string, deviceName?: string, legacyToken?: string): Promise<UserDeviceResponse>`
     - `getProfile(): Promise<UserProfileResponse>`
     - `deleteAccount(): Promise<void>`
   - These use `apiFetch` from `../api/http.ts` (which will be updated in Phase 1E to use Supabase JWT).
   - Why: Separate API layer from context logic.
   - Dependencies: Step 4
   - Risk: Low
   - Test: Unit tests with mocked apiFetch.

6. **Add vitest mock for expo-secure-store** (`client/src/test/setup.ts`)
   - Action: Add `vi.mock('expo-secure-store', ...)` with getItemAsync/setItemAsync/deleteItemAsync stubs. Add `vi.mock('expo-linking', ...)` stub. Add `vi.mock('@supabase/supabase-js', ...)` if needed for unit tests.
   - Why: Tests run in jsdom, not on device. SecureStore and Linking must be mocked.
   - Dependencies: None
   - Risk: Low
   - Test: Existing tests still pass after adding mocks.

**Verification**: `cd client && npx tsc --noEmit && pnpm test`

---

### Phase 1E: Client — HTTP Client Migration + Deep Linking
**Agent**: `fe-developer`
**Estimate**: 4 files

1. **Update `apiFetch` to use Supabase JWT** (`client/src/services/api/http.ts`)
   - Action: Replace the device-token auth flow with Supabase session token:
     - Remove `acquireDeviceToken()` and `ensureDeviceToken()`
     - Replace with `getAccessToken()` that calls `supabase.auth.getSession()` and returns `session.access_token`
     - On 401: call `supabase.auth.refreshSession()` and retry once. If refresh fails, the AuthContext will handle sign-out.
     - Keep the same `apiFetch<T>` signature — callers don't change.
     - Import `supabase` from `@services/supabase`.
   - Why: All API calls must now carry Supabase JWT instead of device token.
   - Dependencies: Phase 1D steps 3-4
   - Risk: High — this is the most critical change. All existing API calls flow through `apiFetch`. Must ensure the token refresh flow works correctly. Must ensure that if no session exists (unauthenticated), the function throws rather than making an unauthenticated request.
   - Test: Update existing `http.test.ts` to mock Supabase session instead of device token.

2. **Update device.ts** (`client/src/storage/device.ts`)
   - Action: Keep `getOrCreateDeviceId()` (still needed for `link-device` call and `created_on_device_id` audit). Mark `getDeviceToken()`, `setDeviceToken()`, `clearDeviceToken()` as deprecated (add JSDoc `@deprecated` tag) but keep them functional for the legacy token migration in `link-device`. They will be removed in a later phase.
   - Why: Device ID is still needed. Token functions are needed temporarily for migration.
   - Dependencies: None
   - Risk: Low
   - Test: Existing device.ts tests still pass.

3. **Add deep link handling** (`client/App.tsx`)
   - Action: Add deep link configuration to `NavigationContainer`:
     ```typescript
     const linking = {
       prefixes: ['countonme://', 'exp://'],
       config: {
         screens: {
           AuthCallback: 'auth/callback',
         },
       },
     };
     ```
     Also handle the deep link token exchange in AuthContext: when the app receives `countonme://auth/callback?...`, extract the token parameters and call `supabase.auth.setSession()` or let the Supabase `onAuthStateChange` handle it.

     Actually, for Supabase magic links in React Native, the recommended approach is:
     - Listen for URL via `Linking.addEventListener('url')`
     - Parse the URL to extract the `access_token` and `refresh_token` (they are in the URL hash fragment)
     - Call `supabase.auth.setSession({ access_token, refresh_token })`
     - This triggers `onAuthStateChange` with `SIGNED_IN`

     Add this URL listener in `AuthContext.tsx` (not App.tsx) since it's auth-specific.
   - Why: Magic link emails contain a deep link. The app must handle the callback to complete auth.
   - Dependencies: Phase 1D step 4
   - Risk: High — deep link handling is platform-specific and fragile. URL fragment parsing varies. Expo Go uses `exp://` scheme.
   - Test: Manual testing required. Unit test the URL parsing function separately.

4. **Update http.test.ts** (`client/src/services/api/http.test.ts`)
   - Action: Rewrite tests to mock `supabase.auth.getSession()` instead of `getDeviceToken()` / `registerDevice()`. Test: (a) apiFetch includes JWT in Authorization header, (b) 401 triggers session refresh + retry, (c) no session throws error.
   - Why: Tests must match new auth flow.
   - Dependencies: Steps 1-3
   - Risk: Medium — significant test rewrite.
   - Test: `pnpm test -- src/services/api/http.test.ts`

**Verification**: `cd client && npx tsc --noEmit && pnpm test`

---

### Phase 1F: Client — Auth Screens + Gated Navigation
**Agent**: `fe-developer`
**Estimate**: 7 files

1. **Add AuthStackParamList** (`client/src/app/navigationTypes.ts`)
   - Action: Add:
     ```typescript
     export type AuthStackParamList = {
       Login: undefined;
       MagicLinkSent: { email: string };
     };
     ```
     Add `Account` to `ProfileStackParamList`:
     ```typescript
     Account: undefined;
     ```
   - Why: Type-safe navigation for auth flow.
   - Dependencies: None
   - Risk: Low
   - Test: Type check passes.

2. **Create LoginScreen** (`client/src/screens/AuthFlow/LoginScreen.tsx`)
   - Action: Flow-specific screen. Email input field (using FormField particle), "Send Magic Link" button. On submit: calls `useAuth().signInWithEmail(email)`. Shows loading state during API call. Shows error if email send fails. On success: navigates to MagicLinkSentScreen with email param.
   - Why: Entry point for authentication.
   - Dependencies: Phase 1D step 4 (useAuth), Step 1 (nav types)
   - Risk: Low
   - Test: Render test — verify email input and button render, mock useAuth.

3. **Create MagicLinkSentScreen** (`client/src/screens/AuthFlow/MagicLinkSentScreen.tsx`)
   - Action: Flow-specific screen. Shows "Check your email" message with the email address. Shows a "Resend" button (calls signInWithEmail again, with 60s cooldown). Shows a "Enter code manually" expandable section with a 6-digit input field. On code submit: calls `useAuth().verifyOtp(email, code)`. Success transitions are handled by AuthContext (onAuthStateChange fires, state becomes authenticated, navigation gates update).
   - Why: Covers both deep link (automatic) and manual code entry (fallback) flows.
   - Dependencies: Phase 1D step 4, Step 1
   - Risk: Medium — OTP verification must use the correct Supabase method (`verifyOtp` with type `'email'`).
   - Test: Render test — verify UI elements, mock useAuth.

4. **Create AccountScreen** (`client/src/screens/AuthFlow/AccountScreen.tsx`)
   - Action: Flow-specific screen (placed in AuthFlow since it's auth-related, navigated from Profile stack). Shows: user email, list of linked devices, "Sign Out" button, "Delete Account" button (with confirmation alert). Sign out: calls `useAuth().signOut()`. Delete: calls `useAuth().deleteAccount()` with double-confirmation.
   - Why: Users need to manage their account.
   - Dependencies: Phase 1D steps 4-5
   - Risk: Low
   - Test: Render test with mocked useAuth.

5. **Update AppNavigator with auth gating** (`client/src/app/AppNavigator.tsx`)
   - Action: Import `useAuth` from AuthContext. Create `AuthStackNavigator` with LoginScreen and MagicLinkSentScreen. In `AppNavigator`, check auth status:
     - `loading` -> return null (or splash)
     - `unauthenticated` -> render AuthStackNavigator
     - `authenticated` -> render TabNavigator (existing)
   - Add AccountScreen to ProfileStackNavigator.
   - Why: Core navigation gating — unauthenticated users see login, authenticated users see the app.
   - Dependencies: Steps 1-4
   - Risk: Medium — must ensure the auth state transition is smooth (no flash of wrong screen).
   - Test: Manual testing + snapshot test.

6. **Update App.tsx with AuthProvider** (`client/App.tsx`)
   - Action: Wrap the component tree with `AuthProvider` inside `ThemeProvider` (auth needs theme for styling login screen):
     ```tsx
     <ThemeProvider>
       <AuthProvider>
         <ThemedApp />
       </AuthProvider>
     </ThemeProvider>
     ```
   - Why: Auth state must be available throughout the app.
   - Dependencies: Phase 1D step 4
   - Risk: Low
   - Test: App renders without error.

7. **Update ProfileScreen** (`client/src/screens/ProfileScreen.tsx`)
   - Action: Add "Account" menu item at the top of the menu items array, navigating to `navigation.navigate("Account")`.
   - Why: AccountScreen must be accessible from the Profile tab.
   - Dependencies: Steps 4-5
   - Risk: Low
   - Test: ProfileScreen renders the Account menu item.

**Verification**: `cd client && npx tsc --noEmit && pnpm test`

---

### Phase 1G: Client — Post-Login Device Linking Flow
**Agent**: `fe-developer`
**Estimate**: 2 files (modifications)

1. **Add auto-link-device on sign-in** (`client/src/services/auth/AuthContext.tsx`)
   - Action: In the `onAuthStateChange` handler, when state becomes `SIGNED_IN`:
     1. Get device_id via `getOrCreateDeviceId()`
     2. Check if there's a legacy `device:token` in AsyncStorage (for migration)
     3. Call `POST /v1/auth/link-device` with device_id + optional legacy_token
     4. On success: clear legacy `device:token` from AsyncStorage
     5. Transition auth state to `authenticated`
   - Why: Every sign-in must link the current device to the user. Legacy token migration happens transparently.
   - Dependencies: Phases 1C (backend endpoint), 1D (auth context), 1E (HTTP client)
   - Risk: High — this is the critical integration point. Must handle: (a) first-time sign-up (no legacy token), (b) returning user (has legacy token), (c) network failure during link-device call (retry strategy).
   - Test: Integration test with mocked API — verify link-device is called on sign-in.

2. **Handle link-device failure gracefully** (`client/src/services/auth/AuthContext.tsx`)
   - Action: If `link-device` fails due to network error, store a flag in AsyncStorage (`@countOnMe/pending-device-link`). On next app launch with an active session, retry. If it fails due to 401 (token expired), the refresh flow in `apiFetch` handles it. If it fails due to 409 (already linked), treat as success.
   - Why: Network failures shouldn't block the user from using the app.
   - Dependencies: Step 1
   - Risk: Medium — state management complexity.
   - Test: Test the retry logic in useAuth tests.

**Verification**: `cd client && npx tsc --noEmit && pnpm test`

---

## Testing Strategy

### Backend Unit Tests
- **`tests/services/test_auth_jwt.py`**: Test `decode_supabase_jwt()` with valid/expired/wrong-secret/bad-audience tokens. Test `get_or_create_user()` create + idempotent. Test `link_device_to_user()` create + duplicate handling. Test `delete_user_account()`.
- Generate test JWTs using `PyJWT`: `jwt.encode({"sub": str(uuid4()), "aud": "authenticated", "exp": ...}, "test-secret", algorithm="HS256")`
- Set `SUPABASE_JWT_SECRET=test-jwt-secret` in test env (via conftest.py `os.environ.setdefault`)

### Backend Integration Tests
- **`tests/api/test_auth_endpoints.py`**: Full HTTP tests for `POST /v1/auth/link-device`, `GET /v1/auth/me`, `DELETE /v1/auth/account` via the `app_client` fixture with JWT auth header.
- **New fixture**: `authenticated_user_client` that creates a User + generates a valid JWT.
- **Existing tests**: Must continue passing — they use `authenticated_client` fixture with device tokens, which still works via `get_current_device_id()`.

### Client Unit Tests
- **`client/src/services/auth/AuthContext.test.tsx`**: Test useAuth hook: initial loading state, session restore, sign-in flow, sign-out flow, delete account flow. Mock supabase client.
- **`client/src/services/api/http.test.ts`**: Updated to test JWT-based auth flow.
- **`client/src/screens/AuthFlow/LoginScreen.test.tsx`**: Render test, email input, button press.
- **`client/src/screens/AuthFlow/MagicLinkSentScreen.test.tsx`**: Render test, code entry, resend.

### Manual Verification
- Launch app -> see login screen (no guest mode)
- Enter email -> receive magic link email (via Resend)
- Tap magic link -> app opens, auth completes, see main app
- Open email on different device, enter 6-digit code manually -> auth completes
- Profile -> Account -> see email and device
- Sign out -> return to login screen
- Delete account -> data removed, return to login

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `apiFetch` migration breaks all API calls | High | Phase 1E step 1 is atomic — update http.ts + its tests together. Run full test suite after. Backend still accepts both auth types during transition. |
| Deep link not working in Expo Go | High | Expo Go uses `exp://` scheme. Configure both `countonme://` and `exp://` as prefixes. Manual OTP code entry is the fallback. |
| Supabase JWT verification with wrong algorithm | High | Explicitly set `algorithms=["HS256"]` in PyJWT decode. Write a test that verifies a real-format Supabase JWT. |
| Auth state flash (show login then main app) | Medium | AuthProvider starts in `loading` state, returns null (or splash) until session check completes. |
| Legacy token migration fails silently | Medium | Log the error, store a retry flag, retry on next launch. Never block app usage. |
| `expo-secure-store` not available in Expo Go | Medium | SecureStore has limited functionality in Expo Go (no encryption, uses AsyncStorage fallback). Acceptable for development. Production requires dev build. |
| Concurrent `link-device` calls during auth callback | Medium | Debounce: track `isLinking` flag in AuthContext state. Only one link-device call at a time. |
| Existing tests break due to new mocks in setup.ts | Low | Add mocks conditionally — only mock expo-secure-store and supabase if they're imported. Or add to separate setup file. |

## Open Questions

1. **Supabase Admin API for account deletion**: ADR-006 says `DELETE /v1/auth/account` should call the Supabase Admin API to delete the `auth.users` row. This requires the `SUPABASE_SERVICE_ROLE_KEY` on the backend. Should we implement this in Phase 1, or defer to Phase 2? **Recommendation**: Implement it in Phase 1 since users expect account deletion to be complete. Add `supabase_service_role_key` to Settings and use `httpx` to call `DELETE https://{SUPABASE_URL}/auth/v1/admin/users/{supabase_id}` with the service role key.

2. **Backend: Should `get_current_user()` auto-create the user?** When a freshly signed-up user makes their first API call, they won't have a `users` row yet. Option A: `get_current_user()` auto-creates from JWT claims (`sub` + `email`). Option B: Only `link-device` creates the user; all other endpoints return 401 until link-device is called. **Recommendation**: Option A — auto-create in `get_current_user()`. This is simpler and more robust. The `link-device` endpoint then just handles the device linking, not user creation.

3. **Should we add `expo-linking` or use React Navigation's built-in linking?** React Navigation already supports deep link configuration via `linking` prop on `NavigationContainer`. We can use `expo-linking` for `Linking.addEventListener` to handle the auth callback URL parsing specifically. **Recommendation**: Use both — React Navigation linking for general deep link routing, and `Linking.addEventListener` in AuthContext for auth-specific URL handling (since the auth callback needs to extract tokens from the URL hash, which is not a standard navigation route).

4. **Where should AccountScreen live?** Options: (a) `screens/AuthFlow/AccountScreen.tsx` — groups with auth-related screens, (b) `screens/ProfileFlow/AccountScreen.tsx` — groups with profile, since it's accessed from Profile tab. **Recommendation**: (a) `screens/AuthFlow/AccountScreen.tsx` since it's fundamentally an auth management screen, even though it's navigated from Profile.

## Phase Dependency Graph

```
Phase 1A (DB Models + Migration)
    |
    v
Phase 1B (JWT Verification + Settings)
    |                   \
    v                    \
Phase 1C (Auth Endpoints) \
    |                      |
    |          Phase 1D (Supabase SDK + Auth Context) [PARALLEL with 1B/1C]
    |                      |
    |                      v
    |          Phase 1E (HTTP Client Migration + Deep Links)
    |                      |
    |                      v
    |          Phase 1F (Auth Screens + Gated Nav)
    |                      |
    v                      v
Phase 1G (Post-Login Device Linking) [requires both backend + client]
```

**Parallelization**:
- Backend (1A -> 1B -> 1C) and Client (1D -> 1E -> 1F) can be developed in parallel after agreeing on the API contract (schemas from Phase 1C step 1).
- Phase 1G requires both backend endpoints and client auth context to be complete.
