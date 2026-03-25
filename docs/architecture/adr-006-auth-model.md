---
type: adr
status: proposed
last-updated: 2026-03-25
related-features:
  - supabase-migration
  - authentication
  - account-management
---

# ADR-006: Auth Model — Anonymous Device Tokens to Supabase JWT

## Status

Proposed

## Context

CountOnMe currently uses anonymous device tokens for authentication. The flow (implemented in `backend/app/features/auth/service.py` and `backend/app/core/deps.py`) works as follows:

1. Client generates a UUID stored in AsyncStorage at key `device:id`
2. Client calls `POST /v1/devices/register` which returns `device_token = "{device_id}.{secret}"`
3. Token is stored unencrypted in AsyncStorage at key `device:token`
4. Backend hashes the secret with SHA-256 + pepper (`settings.device_token_pepper`), stores hash in `devices.token_hash`
5. `get_current_device_id()` dependency parses the Bearer token, looks up the device, verifies the hash
6. Returns `device.id` (UUID) as the scoping identity

This model has fundamental limitations:
- **No account recovery**: lose the device, lose all data
- **No multi-device**: data trapped on the original device
- **No email/identity**: cannot implement social features, sharing, or support
- **Weak security**: token stored in plaintext AsyncStorage, not encrypted at rest

The project owner has decided:
- Auth provider: **Supabase Auth**
- Auth method: **Email magic link** (not OTP, not password)
- Guest mode: **NONE** -- account creation required on first launch
- Custom SMTP: **Resend** configured in Supabase dashboard

## Decision

### 1. Supabase Auth as the identity provider

Supabase Auth manages user registration, email verification, magic link delivery, and JWT issuance. The FastAPI backend validates JWTs but never handles credentials directly.

Supabase project: `https://svfbntnkzroydrydwtsq.supabase.co`

### 2. Email magic link as the sole auth method

Login flow:
1. User enters email on the login screen
2. Client calls `supabase.auth.signInWithOtp({ email })` -- this sends a magic link email via Resend SMTP
3. User taps the magic link in their email
4. Link opens the app via deep link, Supabase SDK exchanges the token automatically
5. Client receives a session: `{ access_token, refresh_token, user }`

No password, no social logins, no SMS OTP. Magic link only.

### 3. Deep linking configuration

| Environment | Scheme | Redirect URL |
|---|---|---|
| Production | `countonme://` | `countonme://auth/callback` |
| Development (Expo Go) | `exp://` | `exp://localhost:8081/--/auth/callback` |
| Development (dev build) | `countonme://` | `countonme://auth/callback` |

Configuration required:
- **Supabase dashboard**: Add `countonme://auth/callback` to allowed redirect URLs
- **Expo**: Configure `scheme: "countonme"` in `app.json`
- **Expo Router / React Navigation**: Handle the `/auth/callback` deep link to complete the auth flow

### 4. Token storage: expo-secure-store

| Token | Storage | Reason |
|---|---|---|
| `access_token` (JWT) | `expo-secure-store` | Short-lived (default 1h), encrypted at rest via OS keychain |
| `refresh_token` | `expo-secure-store` | Long-lived, must be protected -- loss means session hijack |
| `device:id` (UUID) | AsyncStorage | Non-sensitive device identifier, needed for `created_on_device_id` audit |
| `device:token` | **REMOVED** | Replaced entirely by Supabase JWT |

The `@supabase/supabase-js` client accepts a custom `storage` adapter. We provide one backed by `expo-secure-store`:

```typescript
import * as SecureStore from 'expo-secure-store';

const supabaseStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
```

### 5. Session lifecycle

| Event | Trigger | Client Action | Backend Action |
|---|---|---|---|
| **Sign up** | User enters email for first time | Call `signInWithOtp`, show "check email" screen | Supabase creates `auth.users` row |
| **Magic link tap** | User taps email link | Deep link opens app, SDK exchanges code for session | - |
| **Session established** | SDK fires `SIGNED_IN` event | Store tokens in SecureStore, navigate to main app, call `POST /v1/auth/link-device` | Create `users` row (if first login), link current device via `user_devices`, backfill `user_id` on device's data |
| **Token refresh** | Access token nearing expiry | SDK auto-refreshes using refresh token | Validate new JWT normally |
| **Token expired (no refresh)** | Refresh token revoked/expired | Navigate to login screen | Return 401 |
| **Logout** | User taps logout | Clear SecureStore, clear local DB, navigate to login | - |
| **Account deletion** | User requests deletion | Call `DELETE /v1/auth/account`, clear everything | Soft-delete all user data, call Supabase Admin API to delete auth.users row |

### 6. Backend JWT validation

The FastAPI backend validates Supabase JWTs without the Supabase Python SDK. It uses the JWKS endpoint for key rotation support:

```
JWKS URL: https://svfbntnkzroydrydwtsq.supabase.co/auth/v1/.well-known/jwks.json
```

New dependency replaces `get_current_device_id()`:

```python
# backend/app/core/deps.py (new)
from jose import jwt, JWTError
import httpx

SUPABASE_JWKS_URL = "https://svfbntnkzroydrydwtsq.supabase.co/auth/v1/.well-known/jwks.json"
SUPABASE_ISSUER = "https://svfbntnkzroydrydwtsq.supabase.co/auth/v1"

async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
) -> UUID:
    # 1. Decode + verify JWT using JWKS
    # 2. Extract sub claim (Supabase user UUID)
    # 3. Look up users table by supabase_id
    # 4. Return users.id (application user_id)
```

The JWKS response is cached in-memory with a TTL (e.g., 5 minutes) to avoid per-request HTTP calls. Key rotation is handled by cache invalidation on verification failure + retry.

### 7. Transition period for existing device-token users

Existing users who have data scoped by `device_id` need a migration path:

1. **App update launches**: Client detects it has a `device:token` in AsyncStorage but no Supabase session in SecureStore
2. **Force account creation**: Client shows the login/signup screen. The user must create an account (no guest mode)
3. **After signup, call `POST /v1/auth/link-device`**: This endpoint:
   - Accepts both the legacy `device_token` (in a request body field) and the Supabase JWT (in Authorization header)
   - Verifies the legacy device token using the existing `verify_device_token()` logic
   - Creates a `user_devices` row linking the device to the new user
   - Triggers the `user_id` backfill for all rows owned by that `device_id`
4. **Clear legacy token**: Client removes `device:token` from AsyncStorage

This endpoint is the ONLY place where legacy device tokens are accepted after the migration. All other endpoints require Supabase JWT.

### 8. New API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/v1/auth/link-device` | Supabase JWT + optional legacy token in body | Link a device to a user, backfill user_id |
| `DELETE` | `/v1/auth/account` | Supabase JWT | Soft-delete all user data, delete Supabase auth record |
| `GET` | `/v1/auth/me` | Supabase JWT | Return user profile (id, email, devices, created_at) |

### 9. Client auth state management

A new `useAuth()` hook manages auth state:

```typescript
type AuthState =
  | { status: 'loading' }          // Checking SecureStore on app launch
  | { status: 'unauthenticated' }  // No session, show login screen
  | { status: 'authenticated'; user: User; session: Session }
  | { status: 'linking' }          // Has legacy device token, creating account
```

The hook:
- Subscribes to `supabase.auth.onAuthStateChange()`
- On `SIGNED_IN`: stores session, calls `/v1/auth/link-device` if legacy token exists, navigates to main app
- On `SIGNED_OUT` or `TOKEN_REFRESHED`: updates state accordingly
- Exposes `signIn(email)`, `signOut()`, `deleteAccount()` actions

### 10. Navigation gating

The root navigator checks `useAuth()` status:
- `loading` -> splash screen
- `unauthenticated` -> AuthStack (LoginScreen, CheckEmailScreen)
- `linking` -> LinkingScreen (progress indicator while device is being linked)
- `authenticated` -> MainStack (existing tab navigator)

### 11. Removed components after migration

| Component | Path | Disposition |
|---|---|---|
| `Device` model | `backend/app/features/auth/models.py` | Kept but no longer used for auth; becomes device registry |
| `issue_device_token()` | `backend/app/features/auth/service.py` | Deprecated after transition period, then removed |
| `parse_device_token()` | `backend/app/features/auth/service.py` | Kept temporarily for `link-device` endpoint |
| `verify_device_token()` | `backend/app/features/auth/service.py` | Kept temporarily for `link-device` endpoint |
| `_hash_secret()` | `backend/app/features/auth/service.py` | Kept temporarily for `link-device` endpoint |
| `registerDevice()` | `client/src/services/api/devices.ts` | Removed |
| `device:token` storage | `client/src/storage/device.ts` | Removed (functions become no-ops then deleted) |
| `acquireDeviceToken()` | `client/src/services/api/http.ts` | Replaced by Supabase session token |
| `POST /v1/devices/register` | `backend/app/features/auth/router.py` | Deprecated, returns 410 Gone after transition |
| `settings.device_token_pepper` | `backend/app/settings.py` | Removed after transition |

## Consequences

### Positive
- Users can recover their account on a new device via email
- Tokens are encrypted at rest (OS keychain via SecureStore) instead of plaintext AsyncStorage
- JWT standard means the backend never sees or stores credentials
- Magic link eliminates password management, phishing risk, and credential stuffing
- JWKS-based validation handles key rotation without backend redeployment
- Session auto-refresh means seamless long-lived sessions

### Negative
- Magic link requires email access -- users in low-connectivity situations may struggle to receive the link
- No offline signup: the initial account creation requires network access (acceptable since no guest mode)
- expo-secure-store requires a development build (not Expo Go) for full functionality
- JWKS caching adds a small amount of complexity to the backend auth dependency
- The transition period requires maintaining two auth paths temporarily (legacy device token + Supabase JWT)

### Risks
- **Deep link hijacking**: A malicious app could register the same URL scheme and intercept the magic link. Mitigation: use Universal Links (iOS) / App Links (Android) with domain verification for production builds.
- **Refresh token theft**: If SecureStore is compromised (rooted device), the attacker gets a long-lived refresh token. Mitigation: Supabase allows configuring refresh token rotation and short access token TTLs.
- **Email deliverability**: Magic links depend on Resend SMTP. If emails land in spam, users cannot log in. Mitigation: configure SPF/DKIM/DMARC properly; provide a "resend" button with rate limiting.
- **Transition period complexity**: Supporting both auth methods increases attack surface temporarily. Mitigation: the `link-device` endpoint is the only dual-auth path, and it is removed after the transition period.

## Alternatives Considered

### A. OTP (6-digit code) instead of magic link
Rejected because: the project owner explicitly decided on magic link. OTP has slightly better UX for users who cannot easily switch between email and app, but magic link is simpler to implement with Supabase and avoids code-entry UX.

### B. Keep device tokens alongside Supabase JWT permanently
Rejected because: maintaining two auth systems indefinitely doubles the security surface and audit burden. The device token system should be fully deprecated after the transition period.

### C. Use Supabase JS SDK on the backend (Python)
Rejected because: no official Supabase Python SDK with full auth support. JWKS-based JWT validation with `python-jose` is more reliable, has fewer dependencies, and does not couple the backend to Supabase SDK release cycles.

### D. Guest mode with deferred account creation
Rejected by project owner: "Guest mode: NONE -- account creation required on first launch." This simplifies the auth model significantly by ensuring every row always has a `user_id` after the initial migration.
