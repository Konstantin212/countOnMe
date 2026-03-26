---
type: plan
status: draft
last-updated: 2026-03-26
related-features:
  - shared-data-domain
  - discover-tab
  - community-features
---

# Implementation Plan: Phase 7 -- Shared Data Features UI (Discover Tab, Search, Publish, Import)

## Overview

Add client-side UI for the shared/community food domain built in Phase 4. This introduces a new "Discover" bottom tab (4th tab) with search, food detail, publishing from private products, and one-tap import into the user's private collection. The backend API surface already exists; this is a client-heavy phase.

## Success Criteria

- [ ] New "Discover" bottom tab appears as the 3rd tab (between My Path and Profile)
- [ ] Discover tab has a search screen that queries `GET /v1/shared/foods/search`
- [ ] Search results show display name, brand, category, and default portion calories
- [ ] Tapping a search result opens a detail screen showing all portions and macro info
- [ ] Detail screen has an "Import to My Foods" button calling `POST /v1/shared/foods/{id}/import`
- [ ] After import, user sees confirmation and can navigate to the imported product
- [ ] "My Shared Foods" screen lists the user's own shared foods via `GET /v1/shared/foods/mine`
- [ ] User can publish a private product as a shared food (create + publish flow)
- [ ] User can unpublish their own shared foods
- [ ] Debounced search (400ms) with loading, error, and empty states
- [ ] All new screens are themed (light/dark) and use existing particles/patterns
- [ ] All new hooks have co-located unit tests
- [ ] Type check, lint, and existing tests pass after each phase

## Assumptions

- Backend shared foods API is fully implemented and deployed (Phase 4 -- verified by reading `backend/app/features/shared/router.py`)
- Authentication is required for all shared food endpoints (verified: all use `get_current_user_id`)
- Backend returns Decimal fields as strings in JSON (verified: `SharedFoodPortionResponse` uses Decimal types via Pydantic)
- The search endpoint only returns public+approved items (verified: `search_shared_foods` service filters on visibility=public, moderation_status=approved)
- Auto-approval is not implemented; newly published items stay "pending" until manually approved. This means a user who publishes will NOT see their item in search until an admin approves it.
- Shared meal templates do NOT exist in backend yet (verified: no template models/tables). Templates are out of scope for this phase.
- The app requires authentication (verified: `AppNavigator` shows `AuthStackNavigator` when unauthenticated)

## Architecture Changes

- New bottom tab: "Discover" inserted between MyPath and Profile
- New navigation stack: `DiscoverStackParamList` with screens: DiscoverHome, SharedFoodDetail, MySharedFoods, PublishFood
- New API service: `client/src/services/api/sharedFoods.ts`
- New hooks: `useSharedFoodSearch`, `useMySharedFoods`, `useSharedFoodDetail`
- New screen flow: `screens/DiscoverFlow/`
- New shared types in `models/types.ts` for SharedFood and SharedFoodPortion

## Files Affected

### New Files

- `client/src/services/api/sharedFoods.ts` -- API service for shared food endpoints
- `client/src/services/api/sharedFoods.test.ts` -- API service tests
- `client/src/hooks/useSharedFoodSearch.ts` -- Debounced search hook
- `client/src/hooks/useSharedFoodSearch.test.tsx` -- Search hook tests
- `client/src/hooks/useMySharedFoods.ts` -- Hook for user's own shared foods
- `client/src/hooks/useMySharedFoods.test.tsx` -- My shared foods hook tests
- `client/src/screens/DiscoverFlow/DiscoverHomeScreen.tsx` -- Main discover tab screen with search
- `client/src/screens/DiscoverFlow/SharedFoodDetailScreen.tsx` -- Detail screen for a shared food
- `client/src/screens/DiscoverFlow/MySharedFoodsScreen.tsx` -- User's own shared foods list
- `client/src/screens/DiscoverFlow/PublishFoodScreen.tsx` -- Publish a product as shared food
- `client/src/screens/DiscoverFlow/components/SharedFoodListItem.tsx` -- Flow-specific list item component
- `client/src/screens/DiscoverFlow/components/PortionCard.tsx` -- Flow-specific portion display component
- `client/src/screens/DiscoverFlow/components/PublishStatusBadge.tsx` -- Flow-specific visibility/moderation badge

### Modified Files

- `client/src/app/navigationTypes.ts` -- Add `DiscoverStackParamList`, update `RootTabParamList`
- `client/src/app/AppNavigator.tsx` -- Add Discover tab, stack navigator, TAB_ICONS entry
- `client/src/models/types.ts` -- Add SharedFood, SharedFoodPortion, SharedFoodListItem, Visibility, ModerationStatus types
- `client/src/theme/colors.ts` -- (Possibly) add semantic colors for moderation status badges if needed; existing status colors may suffice

## Implementation Steps

### Phase 1: Types + API Service (Data Layer)
Estimate: 3 files new, 1 file modified

1. **Add shared food types to models** (`client/src/models/types.ts`)
   - Action: Add these types at the bottom of the file:
     - `Visibility = "private" | "unlisted" | "public"`
     - `ModerationStatus = "pending" | "approved" | "rejected"`
     - `SharedFoodPortion` -- id, sharedFoodId, label, baseAmount, baseUnit (Unit), gramWeight, calories, protein, carbs, fat, isDefault (all numbers, nullable where backend has Decimal|None)
     - `SharedFood` -- id, ownerUserId, name, displayName, description, brand, barcode, category, visibility (Visibility), moderationStatus (ModerationStatus), createdAt, updatedAt, portions (SharedFoodPortion[])
     - `SharedFoodListItem` -- id, ownerUserId, name, displayName, brand, barcode, category, visibility, moderationStatus, defaultPortion (SharedFoodPortion | null)
     - `SharedFoodImportResult` -- productId (string), portionCount (number)
   - Why: Types must exist before hooks/services can reference them
   - Dependencies: None
   - Risk: Low
   - Test: `cd client && npx tsc --noEmit`

2. **Create shared foods API service** (`client/src/services/api/sharedFoods.ts`)
   - Action: Create file with functions that call the backend endpoints. Follow the `catalog.ts` pattern for Decimal-to-number transformation.
   - API types (snake_case, matching backend JSON):
     - `SharedFoodPortionApiResponse` -- all numeric fields as `string | number` (Decimal serialization)
     - `SharedFoodApiResponse` -- snake_case fields, `portions: SharedFoodPortionApiResponse[]`
     - `SharedFoodListItemApiResponse` -- snake_case, `default_portion: SharedFoodPortionApiResponse | null`
   - Transform functions (snake_case to camelCase, string Decimals to numbers):
     - `transformPortion(raw) -> SharedFoodPortion` -- use `parseNumeric` from `@services/utils/parsing`
     - `transformSharedFood(raw) -> SharedFood`
     - `transformListItem(raw) -> SharedFoodListItem`
   - Exported async functions:
     - `searchSharedFoods(q?: string, limit?: number, offset?: number) -> SharedFoodListItem[]` -- `GET /v1/shared/foods/search`
     - `getSharedFood(id: string) -> SharedFood` -- `GET /v1/shared/foods/{id}`
     - `listMySharedFoods(limit?: number, offset?: number) -> SharedFoodListItem[]` -- `GET /v1/shared/foods/mine`
     - `createSharedFood(body: CreateSharedFoodRequest) -> SharedFood` -- `POST /v1/shared/foods`
     - `publishSharedFood(id: string) -> SharedFood` -- `POST /v1/shared/foods/{id}/publish`
     - `unpublishSharedFood(id: string) -> SharedFood` -- `POST /v1/shared/foods/{id}/unpublish`
     - `addSharedFoodPortion(id: string, body: CreateSharedFoodPortionRequest) -> SharedFoodPortion` -- `POST /v1/shared/foods/{id}/portions`
     - `importSharedFood(id: string) -> SharedFoodImportResult` -- `POST /v1/shared/foods/{id}/import`
     - `deleteSharedFood(id: string) -> void` -- `DELETE /v1/shared/foods/{id}`
   - Request types (camelCase, since these are client-side):
     - `CreateSharedFoodRequest` -- name, displayName, description?, brand?, barcode?, category?
     - `CreateSharedFoodPortionRequest` -- label, baseAmount, baseUnit, gramWeight?, calories, protein?, carbs?, fat?, isDefault?
   - Note: Request bodies sent to backend must be snake_case. Convert in the service function before passing to `apiFetch`.
   - Why: Centralizes all API communication; hooks never call `apiFetch` directly
   - Dependencies: Step 1 (types)
   - Risk: Medium -- Decimal-to-number transformation must handle both string and number inputs (backend may return either depending on serialization). Follow `catalog.ts` `transformPortion` pattern exactly.
   - Test: See Step 3

3. **Write API service tests** (`client/src/services/api/sharedFoods.test.ts`)
   - Action: Mock `apiFetch` via `vi.mock('./http')`, test each exported function
   - Test cases:
     - `searchSharedFoods` passes query params, transforms response
     - `getSharedFood` transforms full response with portions
     - `importSharedFood` returns transformed result
     - `createSharedFood` sends snake_case body, returns transformed response
     - `publishSharedFood` sends POST, returns transformed response
     - Transform handles string Decimal values (e.g., `"123.456"` -> `123.456`)
     - Transform handles null optional fields
   - Pattern: Follow `client/src/services/api/goals.test.ts` or `client/src/services/api/config.test.ts` patterns
   - Dependencies: Steps 1-2
   - Risk: Low
   - Test: `cd client && pnpm test -- sharedFoods.test`

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm test -- sharedFoods.test
```

### Phase 2: Search Hook (State Layer)
Estimate: 2 files new

1. **Create search hook** (`client/src/hooks/useSharedFoodSearch.ts`)
   - Action: Create a hook that manages debounced search state
   - Return type `UseSharedFoodSearchResult`:
     - `results: SharedFoodListItem[]` -- current search results
     - `query: string` -- current search query
     - `setQuery: (q: string) => void` -- update query (triggers debounced search)
     - `loading: boolean` -- whether a search is in flight
     - `isError: boolean` -- whether the last search failed
     - `retry: () => void` -- retry the last failed search
     - `hasSearched: boolean` -- whether a search has been performed (vs initial empty state)
   - Implementation pattern (follow `SelectProduct/index.tsx` debounce pattern):
     - Use `useState` for query, results, loading, error
     - Use `useRef` for debounce timer
     - Use `useEffect` watching query changes, clearing timer, setting new timeout
     - 400ms debounce constant
     - On empty query: clear results, set hasSearched=false
     - On non-empty query after debounce: call `searchSharedFoods(q)`, update state
     - Error handling: set isError=true, results stay as previous (or empty)
     - Use `isMountedRef` pattern to prevent state updates after unmount
   - Why: Encapsulates search state and debounce logic; screen stays lean
   - Dependencies: Phase 1 (API service)
   - Risk: Low -- well-established pattern in the codebase
   - Test: See Step 2

2. **Write search hook tests** (`client/src/hooks/useSharedFoodSearch.test.tsx`)
   - Action: Mock `@services/api/sharedFoods`, test hook via `renderHook`
   - Test cases:
     - Initial state: empty results, not loading, not error, hasSearched=false
     - Setting query triggers debounced search after 400ms
     - Successful search: results populated, loading=false, hasSearched=true
     - Failed search: isError=true, results empty
     - Clearing query: results cleared, hasSearched=false
     - Rapid query changes: only last query fires (debounce)
     - Retry re-fires the last query
   - Use `vi.useFakeTimers()` for debounce testing, `vi.advanceTimersByTime(400)`
   - Use `waitFor` from `@testing-library/react` for async state updates
   - Dependencies: Step 1
   - Risk: Low
   - Test: `cd client && pnpm test -- useSharedFoodSearch.test`

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm test -- useSharedFoodSearch.test
```

### Phase 3: My Shared Foods Hook (State Layer)
Estimate: 2 files new

1. **Create my shared foods hook** (`client/src/hooks/useMySharedFoods.ts`)
   - Action: Create a hook that manages the user's own shared foods list
   - Return type `UseMySharedFoodsResult`:
     - `foods: SharedFoodListItem[]`
     - `loading: boolean`
     - `error: string | null`
     - `refresh: () => Promise<void>`
     - `publishFood: (id: string) => Promise<void>` -- calls publishSharedFood API
     - `unpublishFood: (id: string) => Promise<void>` -- calls unpublishSharedFood API
     - `deleteFood: (id: string) => Promise<void>` -- calls deleteSharedFood API
   - Implementation pattern (follow `useProducts.ts` load-on-mount pattern):
     - Load on mount via `useEffect`
     - `isMountedRef` for unmount safety
     - `refresh` calls `listMySharedFoods` and updates state
     - `publishFood` / `unpublishFood` call API then call `refresh`
     - `deleteFood` calls API then removes from local state optimistically
   - Why: Encapsulates CRUD operations for the "My Shared Foods" screen
   - Dependencies: Phase 1 (API service)
   - Risk: Low
   - Test: See Step 2

2. **Write my shared foods hook tests** (`client/src/hooks/useMySharedFoods.test.tsx`)
   - Action: Mock `@services/api/sharedFoods`, test hook via `renderHook`
   - Test cases:
     - Loads foods on mount
     - refresh updates the list
     - publishFood calls API and refreshes
     - unpublishFood calls API and refreshes
     - deleteFood calls API and removes item optimistically
     - Error state on API failure
   - Dependencies: Step 1
   - Risk: Low
   - Test: `cd client && pnpm test -- useMySharedFoods.test`

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm test -- useMySharedFoods.test
```

### Phase 4: Navigation Setup (Wiring Layer)
Estimate: 0 files new, 2 files modified

1. **Add DiscoverStackParamList to navigation types** (`client/src/app/navigationTypes.ts`)
   - Action: Add new stack param list and update RootTabParamList
   - Add:
     ```typescript
     export type DiscoverStackParamList = {
       DiscoverHome: undefined;
       SharedFoodDetail: { sharedFoodId: string };
       MySharedFoods: undefined;
       PublishFood: { productId: string };  // product to publish as shared food
     };
     ```
   - Modify `RootTabParamList`:
     ```typescript
     export type RootTabParamList = {
       MyDayTab: NavigatorScreenParams<MyDayStackParamList>;
       MyPathTab: NavigatorScreenParams<MyPathStackParamList>;
       DiscoverTab: NavigatorScreenParams<DiscoverStackParamList>;  // NEW
       ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
     };
     ```
   - Add import for `DiscoverStackParamList`
   - Why: Type-safe navigation requires param lists before screens
   - Dependencies: None
   - Risk: Medium -- adding a new tab to `RootTabParamList` changes the type of any component using `useNavigation<BottomTabNavigationProp<RootTabParamList>>()`. Must verify that existing cross-tab navigations in MyDayScreen and MyPathScreen still type-check.
   - Test: `cd client && npx tsc --noEmit`

2. **Add Discover tab to AppNavigator** (`client/src/app/AppNavigator.tsx`)
   - Action: Add the Discover stack navigator and tab. Use placeholder screens initially (empty View with Text) to verify navigation wiring before building real screens.
   - Changes:
     - Import `DiscoverStackParamList` from navigationTypes
     - Add `const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>()`
     - Add `TAB_ICONS.DiscoverTab = { focused: "search", unfocused: "search-outline" }`
     - Create `DiscoverStackNavigator` component (same pattern as other stack navigators)
     - Register screens: DiscoverHome, SharedFoodDetail, MySharedFoods, PublishFood
     - Add `<Tab.Screen>` for DiscoverTab between MyPathTab and ProfileTab with `title: "Discover"`
     - Add tabPress listener (same pattern as other tabs)
   - **CRITICAL**: Initially use placeholder components for all 4 screens (simple View with Text). The real screen implementations come in Phase 5-7. This keeps Phase 4 purely about navigation wiring.
   - Why: Navigation must work before screens can be built
   - Dependencies: Step 1
   - Risk: Medium -- adding a 4th tab changes the tab bar layout. Need to verify visual appearance. Tab label "Discover" must fit alongside "My Day", "My Path", "Profile".
   - Test: `cd client && npx tsc --noEmit`; visually verify 4 tabs appear

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm run lint
```

### Phase 5: Discover Home Screen (Search UI)
Estimate: 3 files new

1. **Create SharedFoodListItem component** (`client/src/screens/DiscoverFlow/components/SharedFoodListItem.tsx`)
   - Placement: Flow-specific (only used in DiscoverFlow)
   - Action: Create a list item component for shared food search results
   - Props: `SharedFoodListItemProps { item: SharedFoodListItem; onPress: () => void }`
   - Display: displayName (title), brand (subtitle if present), category badge, default portion calories ("X kcal / Y unit")
   - Style: Follow `ProductListItem.tsx` pattern -- card with borderRadius 12, border, cardBackground
   - Theme-aware via `useTheme()`
   - Why: Reusable within the Discover flow for both search results and "my shared foods"
   - Dependencies: Phase 1 (types)
   - Risk: Low
   - Test: Visual verification

2. **Create PublishStatusBadge component** (`client/src/screens/DiscoverFlow/components/PublishStatusBadge.tsx`)
   - Placement: Flow-specific (only used in DiscoverFlow)
   - Action: Small badge showing visibility + moderation status
   - Props: `{ visibility: Visibility; moderationStatus: ModerationStatus }`
   - Display logic:
     - private: gray badge "Private"
     - public + pending: warning badge "Pending Review"
     - public + approved: success badge "Published"
     - public + rejected: error badge "Rejected"
     - unlisted: info badge "Unlisted"
   - Uses existing status colors from theme (success, warning, error, info)
   - Why: Shows the state of a shared food in the "My Shared Foods" list
   - Dependencies: Phase 1 (types)
   - Risk: Low

3. **Create DiscoverHomeScreen** (`client/src/screens/DiscoverFlow/DiscoverHomeScreen.tsx`)
   - Action: Build the main Discover tab screen with search
   - Layout (top to bottom):
     - SafeAreaView with header ("Discover")
     - Subtitle: "Find foods shared by the community"
     - TextInput for search (same style as SelectProduct search)
     - "My Shared Foods" card/button (navigates to MySharedFoods screen)
     - FlatList of search results (SharedFoodListItem)
     - Loading state (ActivityIndicator)
     - Error state with retry button
     - Empty state ("No results found" / "Search for community foods")
   - Uses `useSharedFoodSearch` hook for search state
   - On result tap: `navigation.navigate("SharedFoodDetail", { sharedFoodId: item.id })`
   - On "My Shared Foods" tap: `navigation.navigate("MySharedFoods")`
   - Pattern: Follow `ProductSearchScreen.tsx` for layout, `SelectProduct` for debounced search UX
   - Why: Primary entry point for the Discover feature
   - Dependencies: Phase 2 (search hook), Phase 4 (navigation), Step 1 (SharedFoodListItem)
   - Risk: Low
   - Test: Visual verification in app

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm run lint
```

### Phase 6: Shared Food Detail + Import Screen
Estimate: 2 files new

1. **Create PortionCard component** (`client/src/screens/DiscoverFlow/components/PortionCard.tsx`)
   - Placement: Flow-specific
   - Action: Display a single portion's nutritional information
   - Props: `{ portion: SharedFoodPortion; isDefault: boolean }`
   - Display: label (bold if default), calories, protein/carbs/fat, base amount + unit
   - Format: "100g -- 250 kcal | P: 20g C: 30g F: 10g"
   - Mark default portion with a small badge/indicator
   - Why: Used in SharedFoodDetailScreen to show each portion
   - Dependencies: Phase 1 (types)
   - Risk: Low

2. **Create SharedFoodDetailScreen** (`client/src/screens/DiscoverFlow/SharedFoodDetailScreen.tsx`)
   - Action: Detail view for a single shared food with import functionality
   - Params: `{ sharedFoodId: string }` from navigation
   - Data: Call `getSharedFood(sharedFoodId)` on mount (inline useEffect, or extract a `useSharedFoodDetail` hook if logic grows)
   - Layout (top to bottom):
     - Back button + header with display name
     - Description (if present)
     - Info section: brand, category, barcode (if present)
     - "Portions" section header
     - List of PortionCard components for each portion
     - "Import to My Foods" button (primary action, bottom of screen or sticky footer)
   - Import flow:
     - On press: call `importSharedFood(sharedFoodId)` via API service
     - Show loading state on button during import
     - On success: show Alert with "Food imported! Added X portions." and option to navigate to products list or stay
     - On error: show Alert with error message
   - Loading state: ActivityIndicator while fetching detail
   - Error state: "Failed to load food" with retry
   - 404 handling: "Food not found" if API returns 404
   - Why: Core feature -- users need to see what they are importing before adding to their collection
   - Dependencies: Phase 1 (API service), Phase 4 (navigation), Step 1 (PortionCard)
   - Risk: Medium -- import creates products+portions in the private domain. The user should understand this is a copy. Consider adding a brief note: "This will copy this food and its portions to your private collection."
   - Test: Visual verification

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm run lint
```

### Phase 7: My Shared Foods + Publish Screens
Estimate: 2 files new

1. **Create MySharedFoodsScreen** (`client/src/screens/DiscoverFlow/MySharedFoodsScreen.tsx`)
   - Action: List the user's own shared foods with publish/unpublish actions
   - Uses `useMySharedFoods` hook
   - Layout:
     - Back button + header ("My Shared Foods")
     - "Share a Food" button at top (navigates to PublishFood screen, requires selecting a product)
     - FlatList of user's shared foods using SharedFoodListItem + PublishStatusBadge
     - Each item has swipe-to-delete or long-press menu with: Publish / Unpublish / Delete actions
     - Implementation choice: use simple buttons on each card rather than swipe gestures (simpler, more accessible)
     - Each list item shows: displayName, brand, PublishStatusBadge, and action buttons
   - Action handlers:
     - Publish: calls `publishFood(id)` from hook, shows confirmation Alert first ("Publishing will submit for review. Continue?")
     - Unpublish: calls `unpublishFood(id)`, shows confirmation Alert
     - Delete: calls `deleteFood(id)`, shows destructive confirmation Alert
     - Tap item: navigates to SharedFoodDetail screen
   - Empty state: "You haven't shared any foods yet. Share your first food to help the community!"
   - Loading state: ActivityIndicator
   - useFocusEffect to refresh on screen focus
   - Why: Users need to manage their contributed content
   - Dependencies: Phase 3 (useMySharedFoods hook), Phase 4 (navigation), Phase 5 (SharedFoodListItem, PublishStatusBadge)
   - Risk: Low
   - Test: Visual verification

2. **Create PublishFoodScreen** (`client/src/screens/DiscoverFlow/PublishFoodScreen.tsx`)
   - Action: Screen for creating a shared food from a private product
   - Params: `{ productId: string }` -- the private product to share
   - Flow:
     1. Load the private product via `useProducts` hook (find by productId)
     2. Pre-fill a form with: name (from product.name), displayName (editable), description (new field), brand (new field), category (from product.category)
     3. User can edit all fields before publishing
     4. On submit:
        a. Call `createSharedFood(body)` to create the shared food (starts as private)
        b. For each portion-like data on the product, call `addSharedFoodPortion(sharedFoodId, portionBody)` -- NOTE: current Product type has caloriesPer100g etc. but no structured portions. We need to create at least one default portion from the product's nutritional data.
        c. Call `publishSharedFood(sharedFoodId)` to submit for review
        d. Navigate back to MySharedFoods with success message
     5. On error: show Alert with error details
   - Form uses existing particles: FormField, Input, Button
   - Why: The "share" workflow converts private data into the shared domain
   - Dependencies: Phase 1 (API service), Phase 4 (navigation), `useProducts` hook (existing)
   - Risk: High -- the Product type has legacy nutritional fields (caloriesPer100g) and newer portion-based fields (caloriesPerBase, portionSize, scaleUnit). The publish screen needs to map these to SharedFoodPortion format. See Open Questions #1.
   - Test: Visual verification

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm run lint
cd client && pnpm test
```

### Phase 8: Wire Real Screens into Navigator + Final Polish
Estimate: 0 files new, 1 file modified

1. **Replace placeholder screens with real implementations** (`client/src/app/AppNavigator.tsx`)
   - Action: Replace placeholder screen imports with real screen components
   - Import all 4 real screens from `@screens/DiscoverFlow/`
   - Remove placeholder components
   - Why: Phase 4 used placeholders; now wire real screens
   - Dependencies: Phases 5-7 (all screens built)
   - Risk: Low
   - Test: Full app navigation verification

2. **Add "Share" entry point from Profile > My Products** (`client/src/screens/ProductFlow/ProductsListScreen.tsx`)
   - Action: Add a small share icon/button on each product card in the products list that navigates to the Publish flow
   - Navigate cross-tab: `navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate("DiscoverTab", { screen: "PublishFood", params: { productId: item.id } })`
   - Pattern: follows MyPathScreen cross-tab nav pattern
   - Why: Users should be able to share a product directly from their products list
   - Dependencies: Phase 7 (PublishFoodScreen), Phase 4 (navigation types)
   - Risk: Medium -- cross-tab navigation typing can be tricky. Follow existing MyPathScreen pattern for cross-tab navigation.
   - Test: Visual verification

Verification:
```bash
cd client && npx tsc --noEmit
cd client && pnpm run lint
cd client && pnpm test  # all existing + new tests pass
cd client && pnpm run verify  # full verification
```

## Testing Strategy

- **Unit tests** (hooks):
  - `client/src/hooks/useSharedFoodSearch.test.tsx` -- debounce, search, error, retry
  - `client/src/hooks/useMySharedFoods.test.tsx` -- CRUD operations, optimistic updates
- **Unit tests** (API service):
  - `client/src/services/api/sharedFoods.test.ts` -- transform functions, API calls
- **Integration tests**: Not applicable (no backend changes in this phase)
- **Manual verification**:
  - Discover tab appears and is tappable
  - Search returns results from backend
  - Tapping a result opens detail with portions
  - Import creates a product in "My Products"
  - Publish flow works end-to-end (create shared food + portions + publish)
  - My Shared Foods shows user's items with correct status badges
  - Publish/Unpublish/Delete actions work
  - Dark mode renders correctly for all new screens
  - Empty states display correctly
  - Error states display correctly with retry

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| 4th tab makes tab bar crowded on small screens | Medium | Use short label "Discover" (8 chars); test on smallest supported screen (iPhone SE). If too tight, abbreviate to icon-only or use "Find" (4 chars). |
| Auto-approval not implemented -- published items stay "pending" forever | High | Phase 7 only covers publishing. The "pending" state must be clearly communicated to users. Add explanatory text: "Your food has been submitted for review." Separate admin/auto-approval is a future phase. |
| Product-to-SharedFood mapping is lossy | High | Current Product type has caloriesPer100g (legacy) OR caloriesPerBase+portionSize (v2). The publish screen must handle both formats and create a valid SharedFoodPortion. Default to 100g portion if using legacy format. |
| Cross-tab navigation typing | Medium | Follow the proven MyPathScreen pattern for `getParent<BottomTabNavigationProp<RootTabParamList>>()?.navigate()`. |
| Backend returns 409 Conflict on already-published foods | Low | Handle ApiError with status 409 in publishFood -- show "Already published" message. |
| User imports the same food multiple times | Low | Backend creates a new product each time (no dedup). This is consistent with catalog import behavior. Could add a warning in UI: "You may have already imported this food." Deferred to future iteration. |
| Screen file sizes | Medium | DiscoverHomeScreen and SharedFoodDetailScreen could grow large. Extract sub-components into `DiscoverFlow/components/` proactively. Plan already includes 3 flow-specific components. |

## Open Questions

1. **Product-to-SharedFoodPortion mapping**: When publishing a private product, how should we create SharedFoodPortion(s)?
   - Option A: Create a single "100g" default portion using the product's `caloriesPer100g` (and optional macros). Simple but loses v2 portion data.
   - Option B: If the product has v2 data (`caloriesPerBase`, `portionSize`, `scaleUnit`), create a portion using those values. If legacy-only, fall back to "100g" portion.
   - **Recommendation**: Option B -- use v2 data when available, fall back to legacy. This preserves the most nutritional accuracy.
   - Needs user confirmation.

2. **Tab order**: The plan places Discover as the 3rd tab (MyDay, MyPath, Discover, Profile). An alternative is making it the 2nd tab (MyDay, Discover, MyPath, Profile) to emphasize discovery. Which order is preferred?
   - **Recommendation**: MyDay, MyPath, Discover, Profile -- Discover is a secondary feature; the primary workflow (tracking) should be leftmost.
   - Needs user confirmation.

3. **"Share" entry point placement**: Besides the Profile > My Products list, should there be a "Share this food" option in the MyDay flow (e.g., on the AddFood screen or food entry detail)? This plan only adds the entry point from Products list.
   - **Recommendation**: Start with Products list only. Add more entry points after validating the feature. Keeps scope manageable.
   - Needs user confirmation.

4. **Category browsing**: The Discover home screen is search-focused. Should there also be category-based browsing (e.g., "Fruits", "Dairy", "Grains")? The backend has a `category` field but no category taxonomy or dedicated endpoint.
   - **Recommendation**: Defer category browsing. The current backend only has free-text category. A proper taxonomy would need a backend schema change. Search-first is the MVP approach.
   - Needs user confirmation.

5. **Shared meal templates**: The GitHub issue mentions "public templates." No backend table exists for shared meal templates. Should this phase include backend work for templates, or is Phase 7 strictly about shared foods?
   - **Recommendation**: Phase 7 is shared foods only. Templates need their own ADR, backend schema, and migration. Plan as Phase 8 or later.
   - Needs user confirmation.
