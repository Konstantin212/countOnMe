---
type: feature
status: current
last-updated: 2026-03-30
related-features:
  - device-auth
---

# Supabase Authentication

## Overview

CountOnMe migrated from anonymous device tokens to Supabase email-based magic link authentication (Phase 3, 4+). Users now sign in with email, receive a magic link, and are issued a Supabase JWT. The backend verifies JWTs using JWKS (not secret keys), preventing algorithm-confusion attacks. Devices are linked to user accounts, enabling data ownership and cross-device synchronization.

## Sign-In Flow

### 1. Email Magic Link Request

User enters email on the LoginScreen. `signInWithEmail(email)` calls Supabase:

```typescript
supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: Linking.createURL("auth/callback") }
})
```

Magic link is sent to the user's email with a deep link back to the app.

### 2. Deep Link Callback

When user taps the link, the app receives a deep link with the URL fragment:

```
countonme://auth/callback#access_token=...&refresh_token=...&type=magiclink
```

`extractTokensFromUrl()` parses the fragment and calls:

```typescript
supabase.auth.setSession({ access_token, refresh_token })
```

### 3. Session Established

Supabase emits `SIGNED_IN` event. The AuthContext updates with user `id`, `email`, and `accessToken`.

### 4. Device Link (Auto-Performed)

After successful sign-in, the app calls `linkDevice()` to associate the current device with the user account and optionally claim any pre-login device data.

## Authentication Model

### Supabase JWT Verification

Tokens are verified using **JWKS** (JSON Web Key Set):

- `decode_supabase_jwt()` fetches the public key from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`
- Only **ES256** (elliptic curve) is accepted; HS256 is explicitly rejected
- Token must include `sub` (user ID) and `exp` claims
- JWT is verified against the `authenticated` audience
- Public keys are cached for 1 hour

Never store or use the Supabase secret key for token verification.

### User Auto-Creation

On first sign-in, `get_or_create_user()` creates a backend `User` row:

- `supabase_id` — Supabase user UUID
- `email` — From JWT payload (may be null)
- `created_at` — Timestamp
- `deleted_at` — Null (prevents reactivation of deleted accounts)

If the user was previously soft-deleted, login is rejected (403).

## Device Linking

### Link-Device Endpoint

```
POST /v1/auth/link-device
Authorization: Bearer {supabase_jwt}
Body: { device_id, device_name?, legacy_device_token? }
```

**Purpose:** Associate a device (and optionally claim pre-login device data) with the authenticated user.

**Migration Path:**

- If device is new: Auto-create it with `token_hash = "supabase-managed"`
- If device already has data (legacy token): Require `legacy_device_token` to prove ownership
- Validate the legacy token against the stored hash
- Link the device to the user
- Auto-claim unclaimed data on the device (products, portions, food entries, goals, body weights)

**Response:** Returns linked device info with claim counts.

### Claim-Device-Data Endpoint

```
POST /v1/auth/claim-device-data
Authorization: Bearer {supabase_jwt}
Body: { device_id }
```

**Purpose:** Claim unclaimed data on a device you own, in case the auto-claim during link-device was skipped.

## Session Management

### Client-Side Session

Supabase manages the session internally. The app listens for auth state changes:

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
    setAuthState({ status: "authenticated", user, accessToken })
  } else if (event === "SIGNED_OUT") {
    setAuthState({ status: "unauthenticated" })
  }
})
```

On token refresh, the accessToken is automatically updated and used for subsequent requests.

### Server-Side Session Validation

Every protected request includes the Supabase JWT in the `Authorization: Bearer` header. The `get_current_user()` dependency:

1. Extracts the Bearer token
2. Calls `decode_supabase_jwt()` to verify signature and claims
3. Looks up or creates the user row
4. Returns the authenticated User object

All downstream endpoints depend on the user ID (not device ID).

## Account Deletion

```
DELETE /v1/auth/account
Authorization: Bearer {supabase_jwt}
```

Soft-deletes the user account:

1. Clears all device links
2. Sets `deleted_at` timestamp on the user row
3. Calls the Supabase Admin API to delete the auth.users row (best-effort)

Deleted accounts cannot be reactivated.

## Key Files

- `client/src/services/auth/AuthContext.tsx` — Auth state provider, sign-in, session listener, deep link handler
- `client/src/services/auth/authApi.ts` — API calls: linkDevice, getProfile, claimDeviceData, deleteAccount
- `client/src/screens/AuthFlow/LoginScreen.tsx` — Email entry screen
- `client/src/screens/AuthFlow/MagicLinkSentScreen.tsx` — Confirmation screen
- `backend/app/features/auth/router.py` — Auth endpoints
- `backend/app/features/auth/service.py` — JWT verification, user creation, device linking, claim logic
- `backend/app/features/auth/schemas.py` — Request/response models
- `backend/app/features/auth/models.py` — User, Device, UserDevice ORM models
- `backend/app/core/deps.py` — `get_current_user` dependency (JWT validation)
