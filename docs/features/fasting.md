---
type: feature
status: current
last-updated: 2026-04-05
related-features:
  - mypath-widgets
  - sync-system
  - sqlite-cache
---

# Fasting Tracker

The **Fasting** feature enables users to log intermittent fasting sessions with technique selection (16:8, 18:6, 20:4, or custom hours), track active sessions with a countdown timer, and persist fasting history locally and to the backend.

## Overview

**Fasting Sessions** are time-bounded periods where a user commits to fasting for a specified number of hours. Each session records:
- **Technique**: Name or pattern (e.g., "16:8" = 16 hours fast, 8 hours eat window)
- **Duration**: Fasting hours (1–72 hours max)
- **Timestamps**: Started at, target end at, optionally ended at
- **Status**: Completed flag (true if ended after target time)

Sessions are scoped per user and synced via the delta-based sync system. A user can have only one active (non-ended, non-deleted) session at a time, enforced by a partial unique index on the backend.

## User Flows

### Start Fasting (FastingSetupScreen)

1. User taps "Start fast" FAB action from MyPath screen
2. **FastingSetupScreen** displays technique options:
   - 16:8 (Popular badge)
   - 18:6 (Intermediate badge)
   - 20:4 (Advanced badge)
   - Custom (user enters hours 1–72)
3. User selects a technique or enters custom hours
4. User taps "Start Fasting" button
5. `useFasting.startSession()` creates a new session optimistically in SQLite
6. Navigation pushes to **FastingScreen** with the session ID

### Track Active Session (FastingScreen)

1. User views countdown timer (timestamp-based, not a counter)
2. Timer updates every 1 second and survives app backgrounding
3. User can view session details: technique, elapsed time, remaining time
4. User taps "End Fasting" to mark session as complete
5. `useFasting.endSession()` sets `endedAt` timestamp and calculates `completed` flag
6. Session is marked as complete if `endedAt >= targetEndAt`

### View Fasting History

1. User navigates to fasting history (via MyPath or settings)
2. Screen lists all sessions (active first, then completed/deleted)
3. User can delete past sessions or edit (update technique/hours)

## Data Model

### Backend

**FastingSession** (SQLAlchemy ORM):
- `id` (UUID, PK)
- `user_id` (UUID, FK to users, indexed)
- `device_id` (UUID, nullable) — device that created/updated the session
- `technique` (String, 10 max) — "16:8", "18:6", "20:4", or "custom"
- `fasting_hours` (Integer) — 1–72 hours
- `started_at` (DateTime, UTC) — when the fast began
- `target_end_at` (DateTime, UTC) — started_at + fasting_hours
- `ended_at` (DateTime, UTC, nullable) — when the user manually ended the fast
- `completed` (Boolean, default False) — true if ended_at >= target_end_at
- `created_at` (DateTime, server timestamp)
- `updated_at` (DateTime, server timestamp)
- `deleted_at` (DateTime, nullable) — soft delete timestamp
- `server_updated_at`, `sync_version` — sync tracking fields

**Indexes**:
- `(user_id)` — query user's sessions
- `(user_id, deleted_at)` — filter non-deleted sessions
- `(user_id, started_at)` — temporal ordering
- `UNIQUE (user_id) WHERE ended_at IS NULL AND deleted_at IS NULL` — one active session per user

### Client

**FastingSession** (TypeScript type):
- `id` (string, UUID)
- `technique` (FastingTechnique: "16:8" | "18:6" | "20:4" | "custom")
- `fastingHours` (number)
- `startedAt` (ISO 8601 string)
- `targetEndAt` (ISO 8601 string)
- `endedAt` (ISO 8601 string or null)
- `completed` (boolean)
- `createdAt` (ISO 8601 string)
- `updatedAt` (ISO 8601 string)

**SQLite Schema** (SCHEMA_V2): Stores fasting sessions with sync and soft-delete tracking.
- Core: `id` (PK), `user_id`, `technique`, `fasting_hours`, `started_at`, `target_end_at`, `ended_at`, `completed`
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Sync: `server_updated_at`, `last_synced_at`, `is_dirty`
- Device: `created_on_device_id`, `updated_on_device_id`

**Sync Integration**: fasting_sessions is a SYNCABLE_MODEL. Client tracks dirty rows (`is_dirty=1`) and syncs via push/pull deltas.

## Backend API Endpoints

See `docs/api/fasting.md` for full endpoint reference.

**Summary** (all under `/v1/fasting-sessions`):
- `GET /` — List sessions for current user (paginated)
- `POST /` — Start new session (409 if one already active)
- `GET /active` — Get active session or 404
- `GET /{id}` — Get session by ID (404 if not owned)
- `POST /{id}/end` — End session (idempotent)
- `PATCH /{id}` — Update session fields
- `DELETE /{id}` — Soft delete session (204)

**Rate Limiting**: 20 write requests per minute per user (applies to POST, PATCH, DELETE).

**Validation**:
- `technique`: Must match `^(16:8|18:6|20:4|custom)$`
- `fasting_hours`: 1–72 hours
- `started_at`, `ended_at`: Within ±24 hours future, ±365 days past (server clock)
- One active session per user enforced by unique index
- `ended_at` must be >= `started_at`

## Client-Side Implementation

### Hook: useFasting

Manages fasting session lifecycle. Returns `{ sessions, activeSession, loading, error, refresh, startSession, endSession, updateSession, deleteSession }`.

**Key behaviors**:
- On mount: loads from SQLite and syncs
- Derives `activeSession` from list (first with no `endedAt`)
- All mutations are optimistic: update local state before API calls
- Soft deletes mark `deleted_at` and set `is_dirty` flag for sync
- If sync fails, eventual consistency applies (local mutations persist)

### Repository: fastingRepository

**Methods**:
- `findAll(db, userId)` → FastingSession[]
- `findActive(db, userId)` → FastingSession | null
- `upsert(db, userId, session)` → void
- `markDeleted(db, id)` → void (sets `deleted_at`)
- `findDirty(db)` → FastingSession[] (where `is_dirty=1`)
- `clearDirty(db, ids)` → void (sets `is_dirty=0`)
- `deleteAll(db, userId)` → void (hard delete for user data)

Uses SQLite transactions for multi-step operations.

### API Service: services/api/fasting.ts

HTTP wrapper around `/v1/fasting-sessions` endpoints. Methods: `listFastingSessions`, `startFastingSession`, `endFastingSession`, `updateFastingSession`, `deleteFastingSession`, `getActiveFastingSession`. Returns null on 404; throws on errors.

### Screens

**FastingSetupScreen**: Displays preset techniques (16:8, 18:6, 20:4) and custom hours input. On submit, calls `startSession()` and navigates to FastingScreen.

**FastingScreen**: Shows active session with timestamp-based countdown timer (survives backgrounding). "End Fasting" button marks session complete and navigates back.

**Fasting History** (future): List view with edit and delete options.

## Sync & Offline Behavior

**Push (Client → Server)**:
- Dirty rows (`is_dirty=1`) are sent in `POST /v1/sync/push`
- Outbox entries with `entityType: "fasting_session"` enqueue mutations
- After sync completes, dirty flags are cleared

**Pull (Server → Client)**:
- `GET /v1/sync/pull` returns all fasting_sessions for user (upserts)
- Client merges pulled sessions into SQLite via LWW (last-write-wins by `updated_at`)

**Offline Behavior**:
- All mutations optimistically update local state and SQLite
- Outbox queues sync when app comes online
- Eventually consistent: local state may diverge temporarily from server until sync

**One Active Session Rule**:
- Enforced on server (409 Conflict if try to start while one active)
- Client UI prevents starting new session if `activeSession` already exists
- On sync, pull replaces local active session with server's authoritative version

## Key Files

**Backend**:
- `backend/app/features/fasting/models.py` — FastingSession ORM model
- `backend/app/features/fasting/schemas.py` — Pydantic request/response schemas
- `backend/app/features/fasting/router.py` — API endpoints and rate limiting
- `backend/app/features/fasting/service.py` — Business logic (validation, conflicts, soft delete)
- `backend/alembic/versions/0021_fasting_sessions.py` — Database migration

**Client**:
- `client/src/hooks/useFasting.ts` — Hook for session management
- `client/src/screens/FastingFlow/FastingSetupScreen.tsx` — Technique selection screen
- `client/src/screens/FastingFlow/FastingScreen.tsx` — Active session timer screen
- `client/src/services/api/fasting.ts` — HTTP API calls
- `client/src/storage/repositories/fastingRepository.ts` — SQLite CRUD operations
- `client/src/models/types.ts` — TypeScript type definitions
- `client/src/storage/database.ts` — SQLite schema (SCHEMA_V2)

## Validation & Limits

- **Technique**: Must match `^(16:8|18:6|20:4|custom)$`
- **Fasting hours**: 1–72 hours
- **Timestamps**: ±24 hours future, ±365 days past (from server clock)
- **One active per user**: Enforced by backend unique index; 409 Conflict if violated
