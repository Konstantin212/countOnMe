---
type: feature
status: current
last-updated: 2026-03-30
related-features:
  - supabase-auth
  - sqlite-cache
  - product-management
---

# Sync System

## Overview

CountOnMe uses **delta-based, user-scoped sync** (Phase 5, 9+). All data (products, portions, food entries, goals, body weights, water logs) is stored in a local SQLite database and synced with the backend. The sync engine fetches changes since the last sync cursor, merges locally using last-write-wins (LWW), and pushes local dirty rows to the server. The system supports offline-first workflows: local writes work immediately, and syncs happen in the background.

## Architecture Summary

| Data Type    | Storage | Sync Model | Offline Capable |
|-------------|---------|------------|-----------------|
| Products    | SQLite  | Pull (LWW) + Push (dirty)      | Yes (full CRUD) |
| Portions    | SQLite  | Pull (LWW) + Push (dirty)      | Yes (full CRUD) |
| Food Entries| SQLite  | Pull (LWW) + Push (dirty)      | Yes (full CRUD) |
| Goals       | SQLite  | Pull (LWW) + Push (dirty)      | Yes (full CRUD) |
| Body Weights| SQLite  | Pull (LWW) + Push (dirty)      | Yes (full CRUD) |
| Water Logs  | SQLite  | Pull (LWW) + Push (dirty)      | Yes (full CRUD) |
| Stats       | Backend | Computed on-demand             | No (requires backend) |

## Pull-Push Sync Pattern

Sync is driven by two operations:

### Pull (Fetch Server Changes)

```
GET /v1/sync/pull?since_version={version}&limit=500
```

Fetches records updated since the last sync version. The backend returns changes grouped by entity type (products, portions, food_entries, goals, body_weights, water_logs) with a new sync_version and has_more flag.

**Conflict Resolution:** Last-write-wins (LWW) using the `updated_at` timestamp. If both local and server have changes:
- Server has newer updated_at → overwrite local
- Local has newer updated_at → local change will be pushed next

### Push (Send Local Changes)

```
POST /v1/sync/push
Body: {
  products: { upserts: [...], deletes: [...] },
  portions: { upserts: [...], deletes: [...] },
  ...
}
```

Send all local dirty rows to the server. The backend applies changes and returns updated server_updated_at values. Client marks sent rows as clean (is_dirty = 0).

## Dirty Tracking

All rows in SQLite have an `is_dirty` flag (0 or 1). When a user makes a local change:

1. The row is immediately created/updated/deleted in the local database
2. `is_dirty` is set to 1
3. The change is visible to the UI instantly
4. On the next sync, all dirty rows are collected and pushed to the server

This enables offline-first workflows: users can add products, log food, and update goals without network connectivity. Once online, changes sync in the background.

## Sync Engine

The sync engine (`client/src/hooks/useSync.ts`) orchestrates pull + push:

1. **Check connectivity** — Uses NetInfo to determine if online
2. **Pull** — Fetch changes since last sync_version
3. **Merge** — Merge pulled changes into local database using LWW
4. **Push** — Send all dirty rows to the server
5. **Mark clean** — Set is_dirty = 0 for successfully pushed rows
6. **Repeat** — While has_more = true, fetch next batch

On failure, the engine retries with exponential backoff.

## Sync Hooks

### useSyncStatus

Monitors the overall sync state and allows manual sync triggering.

**State:**
- `isOnline` — Current network connectivity
- `syncing` — Whether a sync is in progress
- `lastSyncAt` — Timestamp of last successful sync
- `lastError` — Last sync error message
- `dirtyCount` — Number of dirty rows waiting to be synced

**Actions:**
- `syncNow()` — Trigger an immediate pull + push
- `refresh()` — Reload sync status from the database

### useSync

Lower-level hook that performs pull and push operations individually.

## Data Consistency Model

| Data Type    | Strategy       | Notes |
|-------------|----------------|-------|
| All entities| Local-first + Sync-on-background | Written to SQLite immediately (is_dirty = 1); pulled/pushed during background sync |
| Stats       | Backend-only   | Computed on-the-fly via API calls; never cached locally |

The LWW (last-write-wins) model ensures convergence: server's updated_at decides conflicts during pull. Local dirty rows override server state in push (assumption: user's latest local change is intentional).
