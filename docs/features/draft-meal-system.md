---
type: feature
status: current
last-updated: 2026-03-19
related-features:
  - food-tracking
  - product-management
---

# Draft Meal System

## Overview

The draft meal system enables multi-step meal creation with persistent state across navigation. Users add products and quantities to a draft, switch between meal types (breakfast, lunch, dinner), and save all meals at once. The draft persists to AsyncStorage, surviving app crashes and manual closure.

## Architecture

**DraftMealProvider** wraps the entire `MyDayStack` navigator in `AppNavigator.tsx`. This ensures draft state is available to all screens in the meal creation flow without prop drilling.

```tsx
<DraftMealProvider>
  <MyDayStack.Navigator>
    <MyDayStack.Screen name="MyDay" component={MyDayScreen} />
    <MyDayStack.Screen name="AddMeal" component={AddMealScreen} />
    <MyDayStack.Screen name="SelectProduct" component={SelectProductScreen} />
    <MyDayStack.Screen name="AddFood" component={AddFoodScreen} />
  </MyDayStack.Navigator>
</DraftMealProvider>
```

Screens access draft state via `useDraftMeal()` hook, throwing an error if used outside the provider.

## State Shape

```typescript
type DraftMealState = {
  mealType: MealTypeKey;  // "breakfast", "lunch", "dinner", "snacks", "water"
  itemsByMealType: Record<MealTypeKey, MealItem[]>;
};

type MealItem = {
  productId: string;
  amount: number;
  unit: Unit;  // "g", "ml", "cup", "tbsp", "tsp", "kg", "l", "mg", "pcs", "serving"
};
```

Each meal type maintains its own item array. Switching meal types (via segment buttons) changes the active `mealType` without losing items already added to other meals.

## Core Operations

**setMealType(mealType: MealTypeKey)**
- Updates current active meal type
- Does not clear items from previous meal type
- Used when user taps segment button in AddMeal screen

**upsertItem(item: { productId: string; amount: number; unit: Unit })**
- Adds or replaces item in current meal type
- If product already in draft, amount/unit are updated (no duplicates)
- Called by AddFood screen after user enters quantity
- State immutably creates new arrays and itemsByMealType object

**removeItem(productId: string)**
- Removes product from current meal type's items array
- Called when user taps "Remove" in AddMeal screen
- No-op if product not present

**reset()**
- Clears all items from all meal types
- Resets active meal type to `"breakfast"`
- Calls `clearDraftMeal()` to erase AsyncStorage key
- Invoked after successful save in AddMeal screen

## Persistence

**On Provider Mount**
1. useEffect triggers `loadDraftMeal()` from AsyncStorage
2. If stored draft exists (valid JSON with proper shape), it hydrates state
3. Errors during load are silently caught; empty state used as fallback
4. `hydrated` flag set to true, enabling auto-save

**Auto-Save**
- Second useEffect watches `draft` and `hydrated` flags
- Calls `saveDraftMeal(draft)` whenever draft changes (after hydration)
- Errors during save are silently swallowed; save failures do not interrupt user flow
- Async/non-blocking; save failures are graceful

**AsyncStorage Key**
- `"@countOnMe/draft-meal/v1"`
- Stored as JSON serialized DraftMealState
- Cleared only via explicit `reset()` call

## Screen Interactions

### AddMeal (Primary Hub)
- Displays current meal type via SegmentedButtons
- Shows products in current meal type with amounts
- Calculates meal calories via `calcMealCalories(items, products)`
- Operations: `setMealType()`, `removeItem()`, `reset()`
- Navigates to SelectProduct to add items
- On save: iterates all meal types with items, calls `saveMealToBackend()` and `addMeal()` hook, then resets draft

### SelectProduct (Product Discovery)
- Screen shows favourites, recents, and search results
- Does not directly interact with draft
- Navigates to AddFood with selected `productId` param
- Recent products tracked separately via `pushProductRecent()`

### AddFood (Quantity Entry)
- Route param: `productId`
- User enters amount and selects unit
- Calculates calories based on product `caloriesPerBase` (fallback to `caloriesPer100g`), `portionSize`, and `scaleUnit`
- On confirmation: calls `upsertItem()`, records recent product, returns to AddMeal
- Uses StackActions.popTo to return to AddMeal (preserving other screens)

## Lifecycle

1. **Mount**: Provider loads draft from AsyncStorage, hydrates state
2. **Navigate to AddMeal**: User sees current draft with active meal type
3. **Add Products**: User taps "Add product" → SelectProduct → AddFood → upsertItem → back to AddMeal
4. **Switch Meal Type**: User taps segment button → setMealType → different items displayed
5. **Save**: All meal types with items saved to backend and local storage → reset() clears draft
6. **Recover**: If app crashes mid-draft, draft persists and re-hydrates on relaunch

## Edge Cases

**Empty Draft at Save**
- Save button disabled if no items across all meal types
- `hasAnyItems` memo checks if any itemsByMealType array has length > 0

**Meal Type Switching**
- Items in other meal types are never deleted
- UI shows "Already logged today" entries from backend (read-only, not draft)
- User can build multiple meals in one flow

**Product Not Found**
- AddFood screen shows error if route.params.productId doesn't exist in products list
- Gracefully handles API failures (e.g., catalog product missing after sync)

**Crash Recovery**
- AsyncStorage persists draft until explicit reset()
- No loss of data on force-close
- Hydration on Provider mount uses null-safe parsing; malformed JSON defaults to empty state

**Offline**
- Draft saves locally; backend save fails non-blocking
- Draft state remains intact for retry on next sync
- Food entries queued (see food-tracking feature for sync details)

## Key Files

- **Context & Provider**: `client/src/screens/AddMealFlow/context.tsx`
- **AddMeal Screen**: `client/src/screens/AddMealFlow/components/AddMeal/index.tsx`
- **AddFood Screen**: `client/src/screens/AddMealFlow/components/AddFood/index.tsx`
- **SelectProduct Screen**: `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`
- **Persistence**: `client/src/storage/storage.ts` (`loadDraftMeal`, `saveDraftMeal`, `clearDraftMeal`)
- **Navigation Setup**: `client/src/app/AppNavigator.tsx`
- **Types**: `client/src/models/types.ts` (`MealTypeKey`, `MealItem`, `Unit`)
