# Implementation Plan: Bug Fix Batch 2

## Overview

Four bugs spanning frontend and backend. Phases 1 and 2 are independent and can run in parallel.
Phase 1 covers two small single-file FE fixes (Bugs 1.1 and 1.2). Phase 2 covers the BE reset endpoint
(Bug 4 BE half). Phase 3 depends on Phase 2 (FE reset button, Bug 4 FE half). Phase 4 is the largest
change (Bug 5 — show saved entries in AddMeal).

---

## Success Criteria

- [ ] SelectProduct "All" tab shows up to 5 favourites + up to 10 recents, not a flat alphabetical dump
- [ ] My Products screen hides products with `source === undefined`; only shows `source === "user"` items
- [ ] `DELETE /v1/data/reset` deletes all food entries for the authenticated device and returns 204
- [ ] Profile screen has a "Reset all data" button that clears AsyncStorage and calls the reset endpoint
- [ ] AddMeal screen loads and displays today's already-saved food entries per meal type on open
- [ ] After saving a new meal and returning to AddMeal, previously saved entries remain visible

---

## Assumptions

- `useFoodEntries.getEntriesForDay` already calls `listFoodEntries({ day })` — confirmed in `client/src/hooks/useFoodEntries.ts` line 219
- `listFoodEntries` accepts a `day` query param — confirmed in `client/src/services/api/foodEntries.ts` line 71
- Backend `list_food_entries` filters by `day` — confirmed in `backend/app/services/food_entries.py` line 81
- `FoodEntry` from the API has `productId`, `mealType`, `amount`, `unit` — confirmed in `FoodEntry` type in `client/src/services/api/foodEntries.ts`
- Products are always loaded before AddMeal renders (via `useProducts` already present on the screen)
- The `data` router does not yet exist; a new file is needed
- `AsyncStorage.clear()` is sufficient for client-side reset (no SQLite, no other local state to clear)
- `clearFoodEntryCaches()` must be called after reset to flush in-memory caches in `useFoodEntries.ts`

---

## Files Affected

### Phase 1A — Bug 1.1: SelectProduct "All" tab prioritization

#### Modified Files
- `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx` — replace `allList` memo and `defaultList` assignment

### Phase 1B — Bug 1.2: My Products source filter

#### Modified Files
- `client/src/screens/ProductsListScreen.tsx` — change filter from `p.source !== "catalog"` to `p.source === "user"`

### Phase 2 — Bug 4 BE: Device data reset endpoint

#### New Files
- `backend/app/api/routers/data.py` — new router with `DELETE /v1/data/reset`
- `backend/app/services/data.py` — service: soft-delete all food entries for a device
- `backend/tests/api/test_data_api.py` — integration test for reset endpoint

#### Modified Files
- `backend/app/main.py` — register `data_router` on `v1`

### Phase 3 — Bug 4 FE: Profile reset button (depends on Phase 2)

#### Modified Files
- `client/src/screens/ProfileScreen.tsx` — add "Reset all data" Pressable with confirmation Alert

### Phase 4 — Bug 5: AddMeal shows today's saved entries

#### Modified Files
- `client/src/screens/AddMealFlow/components/AddMeal/index.tsx` — fetch today's entries on focus, display per meal type above draft items

---

## Implementation Steps

### Phase 1A: Bug 1.1 — SelectProduct "All" tab (FE, single file)

Estimate: 1 file

**1. Replace `allList` memo and `defaultList` with prioritized list**
(`client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`)

- Action: Delete lines 89–102 (the `allList` memo and the `const defaultList = ...` assignment).
  Replace with a single `defaultList` memo that:
  1. When `tab === "favourited"`, returns `favouritedList` unchanged.
  2. When `tab === "all"`:
     - Take `favourites.slice(0, 5)`, map each id through `productMap`, filter out `undefined`,
       sort alphabetically by `name`. Call this `favSlot`.
     - Build `favIds = new Set(favSlot.map(p => p.id))`.
     - Take `recents.filter(id => !favIds.has(id)).slice(0, 10)`, map through `productMap`,
       filter out `undefined`, sort alphabetically. Call this `recentSlot`.
     - Return `[...favSlot, ...recentSlot]`.
  3. Dependencies array: `[tab, favourites, recents, productMap, favouritedList]`.
- Why: The current flat alphabetical list ignores spec. The prioritized list (5 favs + 10 recents)
  is what the product spec requires.
- Dependencies: None
- Risk: Low — purely presentational, no data mutation
- Test: Open SelectProduct with some favourited and recently-used products. "All" tab must show
  favourites first (sorted), then recents not already in favourites (sorted), not more than 15 items.

Verification: `cd client && npx tsc --noEmit`

---

### Phase 1B: Bug 1.2 — My Products source filter (FE, single file)

Estimate: 1 file

**1. Change filter predicate**
(`client/src/screens/ProductsListScreen.tsx` line 18)

- Action: Change `products.filter((p) => p.source !== "catalog")` to
  `products.filter((p) => p.source === "user")`.
- Why: Old products have `source = undefined`. The negation `!== "catalog"` passes undefined,
  showing stale catalog-materialized products in My Products. The positive check `=== "user"`
  hides anything without an explicit user source.
- Dependencies: None
- Risk: Low — one character change with no side effects
- Test: Open My Products. Products added before source field existed (source = undefined) must
  not appear. Products explicitly created by the user (source = "user") must still appear.

Verification: `cd client && npx tsc --noEmit`

---

### Phase 2: Bug 4 BE — Device data reset endpoint

Estimate: 4 files (2 new, 1 new test, 1 modified)

**1. Create `backend/app/services/data.py`**

- Action: Add a single async function `delete_all_food_entries(session, *, device_id) -> int`.
  It must issue a bulk soft-delete: `UPDATE food_entries SET deleted_at = now(), updated_at = now()
  WHERE device_id = :device_id AND deleted_at IS NULL`. Return the count of rows updated.
  Use `sqlalchemy.update(FoodEntry)` with `.where(...)` and `.execution_options(synchronize_session=False)`.
  Commit the session before returning.
- Why: Business logic must not live in the router. Soft-delete keeps data for possible recovery.
- Dependencies: None
- Risk: Low — straightforward bulk update following existing soft-delete patterns

**2. Create `backend/app/api/routers/data.py`**

- Action: Define `router = APIRouter(prefix="/data", tags=["data"])`.
  Add one endpoint: `DELETE /reset` with status 204, no response body.
  Depends on `get_current_device_id` and `get_session`.
  Calls `await delete_all_food_entries(session, device_id=device_id)`.
  Returns `Response(status_code=204)` (import `Response` from `fastapi`).
- Why: Thin router — no business logic, just wiring.
- Dependencies: Step 1
- Risk: Low

**3. Register router in `backend/app/main.py`**

- Action: Add `from app.api.routers.data import router as data_router` import.
  Add `v1.include_router(data_router)` after the existing router registrations.
- Why: Router is unreachable until registered.
- Dependencies: Step 2
- Risk: Low

**4. Create `backend/tests/api/test_data_api.py`**

- Action: Write two test cases following the pattern in `backend/tests/api/test_products_api.py`:
  - `test_reset_deletes_food_entries`: seed one food entry for the device, call
    `DELETE /v1/data/reset`, assert 204, assert the entry is soft-deleted (query `food_entries`
    directly and confirm `deleted_at IS NOT NULL`).
  - `test_reset_does_not_affect_other_device`: seed entries for device A and device B, reset
    device A, confirm device B's entries are untouched.
- Why: Device scoping must be verified to prevent data loss bugs.
- Dependencies: Steps 1–3
- Risk: Low

Verification: `cd backend && ruff check app/ && pytest tests/api/test_data_api.py -v`

---

### Phase 3: Bug 4 FE — Profile screen reset button (depends on Phase 2)

Estimate: 1 file

**1. Add "Reset all data" button to ProfileScreen**
(`client/src/screens/ProfileScreen.tsx`)

- Action:
  1. Add imports at the top: `Alert` from `react-native` (already imported via `react-native`
     — check if present; add if missing), `AsyncStorage` from
     `@react-native-async-storage/async-storage`, `clearFoodEntryCaches` from
     `@hooks/useFoodEntries`, and `apiFetch` from `@services/api/http` OR create a small
     helper in `client/src/services/api/data.ts` that exports
     `resetDeviceData(): Promise<void>` (calls `DELETE /v1/data/reset` via `apiFetch`).
     Prefer the dedicated helper so ProfileScreen stays thin.
  2. Create `client/src/services/api/data.ts` with:
     ```
     export const resetDeviceData = async (): Promise<void> => {
       await apiFetch<void>("/v1/data/reset", { method: "DELETE" });
     };
     ```
  3. In ProfileScreen, add a `handleResetData` function that:
     - Shows `Alert.alert("Reset all data", "This will delete all your food entries. ...", [{text:"Cancel"}, {text:"Reset", style:"destructive", onPress: async () => { ... }}])`.
     - In `onPress`: calls `resetDeviceData()` (swallow errors but log them), then calls
       `clearFoodEntryCaches()`, then `AsyncStorage.clear()`.
     - Wraps in try/catch; shows error alert on failure.
  4. Add a new entry to the `menuItems` array (or add a separate danger zone section after
     "My Data") — a `Pressable` styled with `colors.error` border/text, labeled "Reset all data",
     `onPress: handleResetData`.
  5. Add styles: `dangerButton` (border 1 `colors.error`, borderRadius 12, padding 16),
     `dangerButtonText` (color `colors.error`, fontWeight 700, fontSize 16).
- Why: Users with NULL macro data need a way to start fresh. The confirmation Alert prevents
  accidental deletion.
- Dependencies: Phase 2 (endpoint must exist); `client/src/services/api/data.ts` new file
- Risk: Medium — destructive action; must have a confirmation gate and error handling

**New file created in this phase:**
- `client/src/services/api/data.ts`

Verification: `cd client && npx tsc --noEmit`

---

### Phase 4: Bug 5 — AddMeal shows today's saved entries (FE)

Estimate: 1 file

**1. Fetch today's food entries on screen focus**
(`client/src/screens/AddMealFlow/components/AddMeal/index.tsx`)

- Action:
  1. Add state: `const [savedEntries, setSavedEntries] = useState<FoodEntry[]>([])`.
     Import `FoodEntry` from `@services/api/foodEntries`.
  2. Add state: `const [loadingEntries, setLoadingEntries] = useState(false)`.
  3. Destructure `getEntriesForDay` from the existing `useFoodEntries()` call (it is already
     called on line 37 for `saveMealToBackend`).
  4. Replace the existing `useFocusEffect` block (lines 31–35, which only calls `refreshProducts`)
     with an expanded version that also fetches today's entries:
     ```
     useFocusEffect(
       useCallback(() => {
         refreshProducts();
         setLoadingEntries(true);
         const today = new Date().toISOString().split("T")[0];
         getEntriesForDay(today)
           .then((entries) => setSavedEntries(entries))
           .finally(() => setLoadingEntries(false));
       }, [refreshProducts, getEntriesForDay]),
     );
     ```
  5. Derive a per-meal-type view of savedEntries using `useMemo`:
     ```
     const savedByMealType = useMemo(() => {
       const map: Partial<Record<MealTypeKey, FoodEntry[]>> = {};
       for (const entry of savedEntries) {
         const key = entry.mealType as MealTypeKey;
         if (!map[key]) map[key] = [];
         map[key]!.push(entry);
       }
       return map;
     }, [savedEntries]);
     ```
     Import `MealTypeKey` from `@models/types` (already available).
  6. In the JSX, inside the "Products" card (currently starting at line 184), add a
     read-only list of saved entries ABOVE the `currentItems` draft list. Show them only when
     `savedByMealType[draft.mealType]?.length > 0`:
     ```jsx
     {(savedByMealType[draft.mealType] ?? []).length > 0 && (
       <>
         <Text style={styles.sectionTitle}>Already logged today</Text>
         {(savedByMealType[draft.mealType] ?? []).map((entry) => {
           const p = products.find((x) => x.id === entry.productId);
           return (
             <View key={entry.id} style={[styles.itemRow, { opacity: 0.6 }]}>
               <Text style={styles.itemName}>{p?.name ?? "Unknown product"}</Text>
               <Text style={styles.itemMeta}>
                 {entry.amount} {entry.unit}
               </Text>
             </View>
           );
         })}
       </>
     )}
     ```
  7. Optionally show a subtle loading indicator (`<ActivityIndicator>`) while `loadingEntries`
     is true, replacing the saved entries section. ActivityIndicator is already imported
     from `react-native-paper`.
- Why: After saving and navigating back to AddMeal, the draft is cleared so the screen looks
  empty. Displaying saved entries gives users visibility into what they already logged without
  requiring navigation to MyDay.
- Dependencies: None (getEntriesForDay already exists in useFoodEntries)
- Risk: Medium — `getEntriesForDay` makes a network call; must handle offline gracefully.
  The existing implementation already returns `[]` on error (line 226 of `useFoodEntries.ts`),
  so failure is safe. The read-only display does not interfere with draft state.
- Test: Save a meal, navigate back to AddMeal. The "Already logged today" section must show
  the just-saved entries under the correct meal type tab. Switching meal type tabs must show
  that meal type's saved entries. Entries must be read-only (no Remove button).

Verification: `cd client && npx tsc --noEmit`

---

## Testing Strategy

- **Unit tests**: No new pure functions introduced in FE phases; TDD not required for display-only changes
- **Backend service test**: `backend/tests/api/test_data_api.py` covers device scoping and soft-delete
- **Manual verification**:
  - Bug 1.1: Open SelectProduct, check "All" tab shows max 15 items, favourites appear first
  - Bug 1.2: Open My Products, confirm pre-source products are hidden
  - Bug 4: Tap "Reset all data" in Profile, confirm alert, confirm entries disappear from MyDay
  - Bug 5: Log a meal, go back to AddMeal, confirm "Already logged today" section is present

---

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| `getEntriesForDay` called on every focus triggers excessive API calls | Medium | Acceptable for now; if perf becomes an issue, add a date-keyed ref to skip if already fetched for today |
| `AsyncStorage.clear()` on reset also wipes theme preference and goal | Medium | Document this in the confirmation alert text ("...your theme and goal settings will also be cleared") |
| Bulk soft-delete in `delete_all_food_entries` locks table under high load | Low | Only affects single device's rows; index on `device_id` makes it fast |
| `savedEntries` rendered alongside draft could show duplicate if user adds same product twice without saving | Low | Saved entries are read-only past state; they are separate from the draft list visually and by data source |
| Phase 3 `AsyncStorage.clear()` wipes `device_id` + `device_token` stored in AsyncStorage | High | Before calling `clear()`, check where device identity is stored. Read `client/src/storage/storage.ts` fully and `client/src/storage/deviceStorage.ts` (if it exists) to confirm keys, then selectively delete only food-related keys instead of `clear()`, OR re-register device after clear |

> **Open Question (Phase 3, High priority)**: `AsyncStorage.clear()` is destructive. If `device_id` and `device_token` live in AsyncStorage under their own keys, clearing will force device re-registration and create a new device_id. This may be the desired behaviour (full reset) but must be confirmed with the user before implementation. If partial reset is intended, enumerate the keys to delete manually instead.

---

## Execution Order

```
Phase 1A  ─┐
            ├─ (parallel, no deps between them)
Phase 1B  ─┘

Phase 2   ─── (independent of 1A/1B, can run in parallel)

Phase 3   ─── (depends on Phase 2 endpoint existing)

Phase 4   ─── (independent of all above, can run in parallel with 1–3)
```

Recommended order for a single developer: 1A → 1B → 2 → 3 → 4.
For parallel agents: [1A + 1B + 2 + 4] in parallel, then 3 after 2 is done.
