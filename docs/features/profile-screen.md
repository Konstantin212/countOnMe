---
type: feature
status: current
last-updated: 2026-03-19
related-features:
  - goal-system
  - product-management
  - food-tracking
  - sync-system
  - device-auth
---

# Profile Screen

## Overview

The Profile screen is a hub for user settings and data management. It provides theme customization, sync status monitoring, quick navigation to data management features (goals, products, meals), and a data reset option in the Danger Zone.

## Screen Sections

### Header

- Title: "Profile"
- Subtitle: "Manage your nutrition data"

### Theme Settings

Three interactive cards for theme selection:

| Theme | Icon | Description |
|-------|------|-------------|
| Light | sunny | Always use light theme |
| Dark | moon | Always use dark theme |
| System Default | phone-portrait | Follow device settings |

When "System Default" is selected and device system theme detection fails (known issue on some Android devices), a warning message is displayed: "If your phone is in dark mode but the app shows light, manually select 'Dark' below."

Active selection is highlighted with a primary-colored border and checkmark icon.

### Sync Status Card

Displays real-time sync state and allows manual sync trigger:

| Field | Source | Description |
|-------|--------|-------------|
| Backend | `useSyncStatus().baseUrl` | API server URL |
| Device | `useSyncStatus().deviceId` | Device UUID (first 8 chars) |
| Token | `useSyncStatus().hasToken` | "Saved" or "Missing (will register)" |
| Status | `useSyncStatus().isOnline` | "Online" or "Offline" |
| Queue | `useSyncStatus().queueSize` | Number of pending mutations |
| Last sync | `useSyncStatus().lastSyncAt` | Formatted timestamp or "-" |
| Error | `useSyncStatus().lastError` | Last sync error message, if any |

**Sync Button:** "Sync now" (disabled when offline or already flushing). Calls `useSyncStatus().flushNow()` to manually trigger sync queue flush.

### My Data Menu

Navigation items to access key features:

| Item | Icon | Target | Description |
|------|------|--------|-------------|
| My Goal | flag | GoalSetup | Set your calorie and macro targets |
| My Products | basket | ProductsList | Manage your food database |
| My Meals | restaurant | MealsList | View and manage your meals |

Each item is a pressable card with chevron indicator; routes via `ProfileStackParamList` navigation types.

### Danger Zone

**Reset all data** button with destructive styling (red border and text). On press, triggers a confirmation alert:
- Title: "Reset all data"
- Message: "This will delete all your food entries, meals, products and goals. This cannot be undone."
- Actions: Cancel / Reset (destructive)

On confirmation, executes `resetDeviceData()` (backend) followed by `clearAllFoodData()` (local storage). Shows success or error alert on completion.

## Hooks Used

### useTheme

Pulls theme configuration from `ThemeContext`. Returns:
- `colors` -- Color tokens for current theme (background, text, primary, error, etc.)
- `theme` -- Current effective theme (`"light"` | `"dark"`)
- `themeMode` -- User's stored preference (`"light"` | `"dark"` | `"system"`)
- `setThemeMode` -- Function to update and persist theme preference

### useSyncStatus

Returns object with read-only sync state and actions:

**State:**
- `baseUrl` -- Configured API server URL
- `deviceId` -- Device UUID from local storage
- `hasToken` -- Boolean; true if device token saved
- `isOnline` -- Boolean; updated by `NetInfo` listener
- `queueSize` -- Number of pending mutations in sync queue
- `lastSyncAt` -- Timestamp (milliseconds) of last successful sync, or null
- `lastError` -- Last sync error message, or null
- `flushing` -- Boolean; true while sync is in progress

**Actions:**
- `refresh()` -- Reloads sync state from storage and device info
- `flushNow()` -- Manually triggers sync queue flush; sets `flushing` to true during, false after

## Data Reset Flow

When user confirms reset:

1. **Backend reset** -- `DELETE /v1/data/reset` clears all device-scoped data on server (products, goals, food entries, meals, portions)
2. **Local clear** -- `clearAllFoodData()` removes all AsyncStorage keys:
   - Products (v1 and v2)
   - Meals (v1 and v2)
   - Product favorites and recents
   - User goal
   - Body weights
   - Draft meal
3. **UI feedback** -- Alert confirms "All data has been reset" or shows error on failure

User is not logged out; device ID and token remain intact so the device can continue syncing.

## Navigation Targets

All items in "My Data" navigate within the ProfileStack (same stack as Profile screen):

- **GoalSetup** → `client/src/screens/GoalFlow/GoalSetupScreen.tsx` -- Choose goal type (calculated/manual)
- **ProductsList** → `client/src/screens/ProductFlow/ProductsListScreen.tsx` -- Browse, search, add/edit products
- **MealsList** → `client/src/screens/MealFlow/MealsListScreen.tsx` -- View meal history

Typed via `ProfileStackParamList` in `client/src/app/navigationTypes.ts`.

## Key Files

- `client/src/screens/ProfileScreen.tsx` -- Main screen component (465 lines)
- `client/src/hooks/useTheme.ts` -- Theme context hook
- `client/src/hooks/useSyncStatus.ts` -- Sync state and actions hook
- `client/src/services/api/data.ts` -- `resetDeviceData()` API call
- `client/src/storage/storage.ts` -- `clearAllFoodData()` local storage cleanup
- `client/src/app/navigationTypes.ts` -- ProfileStackParamList type definition

## Related Features

- [Goal System](./goal-system.md) -- Goal setup accessible from "My Goal" link
- [Product Management](./product-management.md) -- Product list accessible from "My Products" link
- [Food Tracking](./food-tracking.md) -- Meals list accessible from "My Meals" link
- [Sync System](./sync-system.md) -- Sync status display and manual flush button
- [Device Auth](./device-auth.md) -- Device ID and token display in sync card
