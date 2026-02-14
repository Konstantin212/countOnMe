# Sync System

## Overview

CountOnMe follows an **offline-first** architecture. Products and goals are stored locally in AsyncStorage and work without network connectivity. When the backend is available, mutations are synchronized via a deferred queue. Food entries, however, are backend-first -- they require an active connection to be created, and the backend is the authoritative source for all food entry data and daily statistics.

## Architecture Summary

| Data Type    | Primary Storage | Sync Direction       | Offline Capable |
|-------------|-----------------|----------------------|-----------------|
| Products    | AsyncStorage    | Client -> Backend    | Yes (full CRUD) |
| Goals       | AsyncStorage    | Bidirectional        | Yes (read local, write syncs) |
| Food Entries| Backend (PostgreSQL) | Backend -> Client | No (requires backend) |
| Stats       | Backend (computed) | Backend -> Client   | No (requires backend) |

## Sync Queue

The sync queue is the mechanism for deferring backend mutations when the client writes locally. It lives in `client/src/storage/syncQueue.ts`.

### Queue Storage

The queue is persisted in AsyncStorage under the key `syncQueue:v1` as a JSON array. Associated metadata:
- `syncQueue:lastSyncAt` -- Timestamp of the last successful sync (epoch ms)
- `syncQueue:lastError` -- Last error message (cleared on full success)

### Operation Structure

Each queued operation has the following shape:

```typescript
{
  id: string;          // Unique identifier (e.g., "products.create:{uuid}")
  resource: string;    // "products" or "goals"
  action: string;      // "create", "update", or "delete"
  payload: any;        // Resource-specific data (e.g., { id, name })
  createdAt: number;   // Epoch timestamp when enqueued
  attempts: number;    // Number of flush attempts so far
  nextAttemptAt?: number; // Epoch timestamp for next retry (backoff)
  lastError?: string;  // Error message from last failed attempt
}
```

### Supported Resources and Actions

| Resource | Action  | API Call                                | Payload      |
|----------|---------|----------------------------------------|--------------|
| products | create  | `POST /v1/products`                    | `{ id, name }` |
| products | update  | `PATCH /v1/products/{id}`              | `{ id, name }` |
| products | delete  | `DELETE /v1/products/{id}`             | `{ id }`       |
| goals    | create  | (No-op: goal already created via API)  | `{ id, goalType }` |
| goals    | update  | `PATCH /v1/goals/{id}`                 | `{ id, ... }` |
| goals    | delete  | `DELETE /v1/goals/{id}`                | `{ id }`       |

Note: Goal creation operations are no-ops in the sync queue because goals are created directly via API calls in the `useGoal` hook. The queue entry exists primarily as a record and for potential future offline-create support.

### Enqueue

The `enqueue()` function appends an operation to the queue:

```typescript
await enqueue({
  id: `products.create:${product.id}`,
  resource: 'products',
  action: 'create',
  payload: { id: product.id, name: product.name },
});
```

The `id` field is structured to be unique per operation (using entity ID and sometimes a timestamp). This prevents accidental duplication.

### Flush Mechanism

The `flush()` function processes the queue:

1. **Check connectivity** -- Calls `NetInfo.fetch()`. If offline, returns immediately with `{ offline: true, remaining: queueSize }`.

2. **Iterate the queue** -- For each operation:
   - If `nextAttemptAt` is in the future, skip it (backoff not yet expired)
   - Otherwise, attempt to apply the operation via the appropriate API call

3. **Handle success** -- Remove the operation from the queue

4. **Handle failure** -- Keep the operation in the queue with:
   - Incremented `attempts` counter
   - Computed `nextAttemptAt` using exponential backoff
   - Stored `lastError` message

5. **Update metadata** -- If all attempted operations succeeded and the queue is empty, clear `lastError` and update `lastSyncAt`

### Exponential Backoff

Failed operations use exponential backoff to avoid hammering the server:

```
delay = min(60000, 1500 * 2^attempts)
```

- Base delay: 1.5 seconds
- Maximum delay: 60 seconds (cap)
- Exponential growth capped at attempt 6 (1500 * 64 = 96000, capped to 60000)

Backoff schedule:
| Attempt | Delay    |
|---------|----------|
| 1       | 3.0s     |
| 2       | 6.0s     |
| 3       | 12.0s    |
| 4       | 24.0s    |
| 5       | 48.0s    |
| 6+      | 60.0s    |

### Flush Result

The `flush()` function returns a summary:

```typescript
{
  attempted: number;   // Operations that were tried
  succeeded: number;   // Operations that succeeded
  remaining: number;   // Operations still in the queue
  skipped: number;     // Operations skipped due to backoff
  offline: boolean;    // True if network was unavailable
}
```

## Cursor-Based Sync Endpoint

For pulling changes from the backend, there is a cursor-based sync endpoint:

### `GET /v1/sync/since`

**Parameters:**
- `cursor` (optional) -- Opaque cursor string from a previous response
- `limit` (default: 200, max: 500) -- Maximum number of rows per entity type

**Response:**
```json
{
  "cursor": "2024-01-15T10:30:00Z|550e8400-...",
  "products": [...],
  "portions": [...],
  "food_entries": [...]
}
```

### Cursor Format

The cursor encodes a position in the `(updated_at, id)` space:

```
{ISO-8601-timestamp}|{UUID}
```

Example: `2024-01-15T10:30:00Z|550e8400-e29b-41d4-a716-446655440000`

### How It Works

1. For each entity type (products, portions, food entries), the endpoint queries rows where:
   - `device_id` matches the authenticated device
   - `updated_at > cursor_timestamp` OR (`updated_at == cursor_timestamp` AND `id > cursor_uuid`)
2. Results are ordered by `(updated_at ASC, id ASC)` and limited to `limit` rows
3. The response includes all three entity types in a single call
4. The `cursor` in the response advances to the maximum `(updated_at, id)` across all returned rows
5. Clients call again with the new cursor to get the next page; when all three lists are empty, sync is complete

### Sync Response Types

Each entity in the response includes `updated_at` and `deleted_at` fields. A non-null `deleted_at` indicates a soft-deleted row that the client should remove from local storage.

## Hook: useSyncStatus

Located in `client/src/hooks/useSyncStatus.ts`. Monitors the sync system state.

**State:**
- `baseUrl` -- The API base URL
- `deviceId` -- The device's UUID
- `hasToken` -- Whether a device token is stored
- `isOnline` -- Current network connectivity (via NetInfo listener)
- `queueSize` -- Number of pending operations in the sync queue
- `lastSyncAt` -- Epoch timestamp of last successful flush
- `lastError` -- Last sync error message
- `flushing` -- Whether a flush is currently in progress

**Actions:**
- `refresh()` -- Reloads all sync state from AsyncStorage and NetInfo
- `flushNow()` -- Triggers an immediate queue flush, then refreshes state

The `isOnline` state is kept up-to-date via a `NetInfo.addEventListener` subscription that fires on connectivity changes.

## Data Consistency Model

### Products

Products are primarily managed locally. The backend copy is a secondary representation used for:
- Food entry creation (entries reference backend product IDs)
- Cross-session persistence if the local device data is lost

When a product is created/updated/deleted locally, the change is immediately applied to AsyncStorage and a sync operation is enqueued. The backend eventually receives the mutation.

### Goals

Goals use a hybrid approach:
- On load, the local goal is shown immediately (offline-first)
- The hook then attempts to fetch the remote goal
- If the remote goal is available and different, it overwrites the local copy
- Mutations go to the backend first (via API), then are saved locally and enqueued

### Food Entries

Food entries are strictly backend-first:
- Creation requires a live backend connection
- Queries always hit the backend
- The backend computes stats (macro totals) from entries
- There is no local cache of food entries (except transient in-memory state in hooks)

### Stats

Stats are computed on-the-fly by the backend by joining food entries with product portions. They are never cached locally.
