---
type: architecture
status: current
last-updated: 2026-03-19
related-features:
  - food-tracking
  - product-management
  - goal-system
  - barcode-scanner
---

# CountOnMe Navigation Map

Complete client navigation structure: 3 tabs, 25 screens, 6 shared flows, and cross-tab navigation.

## Tab Structure

CountOnMe uses a bottom-tab navigator with tab-press reset behavior (press a tab to jump to its root screen):

| Tab | Icon | Root Screen | Entry Point |
|-----|------|-------------|------------|
| **MyDayTab** | calendar / calendar-outline | MyDay | Day summary, add meals workflow |
| **MyPathTab** | trending-up / trending-up-outline | MyPath | Stats, goals, trends, weight tracking |
| **ProfileTab** | person / person-outline | ProfileMenu | Settings, products, meals, goals |

Tab colors come from `useTheme()`:
- `colors.tabBarActive` — focused icon color
- `colors.tabBarInactive` — unfocused icon color
- `colors.background` — tab bar background
- `colors.border` — top border color

All screens inherit `colors.background` from theme context.

---

## MyDayStack (8 screens, wrapped in DraftMealProvider)

Adds meals for today, selects products, and enters food portions. Uses `DraftMealProvider` context to manage meal composition before save.

```
MyDay
├── AddMeal
│   ├── SelectProduct
│   │   ├── BarcodeScanner
│   │   └── ProductForm (create new product)
│   └── AddFood (from SelectProduct)
├── MealTypeEntries (view entries by meal type)
└── ProductForm (modal edit during AddMeal flow)
└── BarcodeScanner (scan from SelectProduct)
└── ProductConfirm (confirm scanned external product)
```

### Screen Details

| Screen | File | Params | Purpose |
|--------|------|--------|---------|
| **MyDay** | `MyDayScreen.tsx` | `undefined` | Summary: macros, daily calories, meal type buttons; FAB to AddMeal |
| **AddMeal** | `AddMealFlow/components/AddMeal/index.tsx` | `undefined` | Select meal type (breakfast, lunch, dinner, snacks); display draft items; save button |
| **SelectProduct** | `AddMealFlow/components/SelectProduct/index.tsx` | `undefined` | Search products (local + catalog); favorites/recents tabs; barcode scan button; create product button |
| **AddFood** | `AddMealFlow/components/AddFood/index.tsx` | `productId: string` | Enter grams/portion; add to draft; return to AddMeal |
| **MealTypeEntries** | `MealFlow/MealTypeEntriesScreen.tsx` | `mealType: MealTypeKey` | View all entries for a meal type (breakfast/lunch/dinner/snacks); edit entries |
| **ProductForm** | `ProductFlow/ProductFormScreen.tsx` | `productId?: string` | Create or edit product; name, kcal/100g, macros |
| **BarcodeScanner** | `BarcodeFlow/BarcodeScannerScreen.tsx` | `undefined` | Scan barcode or enter manually; lookup product → ProductConfirm |
| **ProductConfirm** | `ProductFlow/ProductConfirmScreen.tsx` | `externalProduct: ExternalProductParam` | Confirm/edit barcode lookup; add to products |

### Navigation Flows

**Flow 1: Add meal from scratch**
```
MyDay → AddMeal (select meal type)
      → SelectProduct (pick product or search)
      → AddFood (enter grams)
      → AddMeal (back, item added to draft)
      → [repeat for more items]
      → Save → MyDay
```

**Flow 2: Barcode to food entry**
```
SelectProduct → BarcodeScanner (scan code)
             → ProductConfirm (confirm product name, kcal)
             → AddFood (auto-populated with product)
             → AddMeal
```

**Flow 3: Create product inline**
```
SelectProduct → ProductForm (empty, create mode)
             → [save] → SelectProduct (product added to local list)
```

---

## MyPathStack (1 screen)

Goal progress, weight trends, macro adherence, and streaks. Cross-tab navigation to ProfileTab only.

```
MyPath (FAB: "Set up goal" → ProfileTab/GoalSetup)
```

### Screen Details

| Screen | File | Params | Purpose |
|--------|------|--------|---------|
| **MyPath** | `MyPath/MyPathScreen.tsx` | `undefined` | Goal progress card; weight chart; calorie trends; macro adherence; streak counter; FAB |

### Cross-Tab Navigation

FAB action: "Set up goal" → `navigation.getParent().navigate("ProfileTab", { screen: "GoalSetup" })`

---

## ProfileStack (14 screens)

Products, meals, and goals: CRUD operations + goal configuration. Split into 4 sub-flows: ProductFlow, ProductImportFlow, MealFlow, GoalFlow.

```
ProfileMenu
├── ProductFlow
│   ├── ProductsList
│   │   └── ProductDetails
│   │       └── ProductForm (edit)
│   └── ProductSearch (import from catalog)
│       ├── BarcodeScanner
│       └── ProductConfirm (add to local)
│
├── MealFlow
│   ├── MealsList
│   │   └── MealDetails
│   └── MealBuilder (create/edit meal template)
│
└── GoalFlow
    ├── GoalSetup (choose mode)
    ├── GoalCalculated (manual input: age, height, weight, activity)
    │   └── GoalCalculatedResult (show targets, save)
    └── GoalManual (directly enter kcal/macros)
```

### Screen Details (14 total)

| Screen | File | Params | Purpose |
|--------|------|--------|---------|
| **ProfileMenu** | `ProfileScreen.tsx` | `undefined` | Menu: My Goal, My Products, My Meals; theme toggle; sync status; reset data |
| **ProductsList** | `ProductFlow/ProductsListScreen.tsx` | `undefined` | Local products (user-created or imported); add/search buttons |
| **ProductDetails** | `ProductFlow/ProductDetailsScreen.tsx` | `productId: string` | Product info, portions, kcal breakdown |
| **ProductForm** | `ProductFlow/ProductFormScreen.tsx` | `productId?: string` | Create or edit product |
| **ProductSearch** | `ProductFlow/ProductSearchScreen.tsx` | `undefined` | Search catalog for products to import; barcode scan button |
| **BarcodeScanner** | `BarcodeFlow/BarcodeScannerScreen.tsx` | `undefined` | Scan barcode; fallback manual entry |
| **ProductConfirm** | `ProductFlow/ProductConfirmScreen.tsx` | `externalProduct: ExternalProductParam` | Confirm catalog product; add to local list |
| **MealsList** | `MealFlow/MealsListScreen.tsx` | `undefined` | Saved meal templates; add/edit buttons |
| **MealBuilder** | `MealFlow/MealBuilderScreen.tsx` | `mealId?: string` | Add/edit meal template; add products; save as template |
| **MealDetails** | `MealFlow/MealDetailsScreen.tsx` | `mealId: string` | View meal; edit/delete buttons |
| **GoalSetup** | `GoalFlow/GoalSetupScreen.tsx` | `undefined` | Choose: calculate (Mifflin-St Jeor) or manual entry |
| **GoalCalculated** | `GoalFlow/GoalCalculatedScreen.tsx` | `undefined` | Input: age, sex, height, weight, activity level → calculate |
| **GoalCalculatedResult** | `GoalFlow/GoalCalculatedResultScreen.tsx` | `calculation: GoalCalculateResponse, inputs: GoalCalculateRequest` | Show kcal + macro targets; save or adjust |
| **GoalManual** | `GoalFlow/GoalManualScreen.tsx` | `undefined` | Directly enter daily kcal and macro targets |

### Navigation Flows

**Flow 1: Product CRUD**
```
ProductsList → ProductDetails → ProductForm (edit) → ProductsList
```

**Flow 2: Import product from catalog**
```
ProductsList → ProductSearch (search or scan barcode)
            → BarcodeScanner (scan) → ProductConfirm → ProductsList
```

**Flow 3: Meal template**
```
MealsList → MealBuilder (create/edit) → [add products] → Save → MealsList
        or MealDetails (view) → Edit → MealBuilder
```

**Flow 4: Goal calculation**
```
GoalSetup → GoalCalculated (Mifflin-St Jeor)
         → GoalCalculatedResult (show targets) → Save
   or GoalSetup → GoalManual (direct entry) → Save
```

---

## Shared Screens (Used in Multiple Stacks)

### ProductFormScreen
- **Location**: `client/src/screens/ProductFlow/ProductFormScreen.tsx`
- **Stacks**: MyDayStack, ProfileStack
- **Params**: `productId?: string`
- **Usage**:
  - MyDayStack: Create new product during AddMeal → SelectProduct flow
  - ProfileStack: Edit existing product in ProductDetails

### BarcodeScannerScreen
- **Location**: `client/src/screens/BarcodeFlow/BarcodeScannerScreen.tsx`
- **Stacks**: MyDayStack, ProfileStack
- **Params**: `undefined`
- **Usage**:
  - MyDayStack: Scan barcode during SelectProduct → AddFood
  - ProfileStack: Scan catalog product during ProductSearch

### ProductConfirmScreen
- **Location**: `client/src/screens/ProductFlow/ProductConfirmScreen.tsx`
- **Stacks**: MyDayStack, ProfileStack
- **Params**: `externalProduct: ExternalProductParam`
- **Usage**:
  - MyDayStack: Confirm external product → AddFood
  - ProfileStack: Confirm external product → ProductsList

---

## Screen Registry (Full Alphabetical List)

| Screen | File | Stack(s) | Params | Entry Points |
|--------|------|----------|--------|--------------|
| AddFood | `AddMealFlow/components/AddFood/index.tsx` | MyDayStack | `productId: string` | SelectProduct → AddFood |
| AddMeal | `AddMealFlow/components/AddMeal/index.tsx` | MyDayStack | `undefined` | MyDay → AddMeal; MyPath FAB |
| BarcodeScanner | `BarcodeFlow/BarcodeScannerScreen.tsx` | MyDayStack, ProfileStack | `undefined` | SelectProduct, ProductSearch |
| GoalCalculated | `GoalFlow/GoalCalculatedScreen.tsx` | ProfileStack | `undefined` | GoalSetup (calculate mode) |
| GoalCalculatedResult | `GoalFlow/GoalCalculatedResultScreen.tsx` | ProfileStack | `calculation, inputs` | GoalCalculated (after compute) |
| GoalManual | `GoalFlow/GoalManualScreen.tsx` | ProfileStack | `undefined` | GoalSetup (manual mode) |
| GoalSetup | `GoalFlow/GoalSetupScreen.tsx` | ProfileStack | `undefined` | ProfileMenu; MyPath FAB |
| MealBuilder | `MealFlow/MealBuilderScreen.tsx` | ProfileStack | `mealId?: string` | MealsList; MealDetails edit |
| MealDetails | `MealFlow/MealDetailsScreen.tsx` | ProfileStack | `mealId: string` | MealsList → MealDetails |
| MealsList | `MealFlow/MealsListScreen.tsx` | ProfileStack | `undefined` | ProfileMenu |
| MealTypeEntries | `MealFlow/MealTypeEntriesScreen.tsx` | MyDayStack | `mealType: MealTypeKey` | MyDay meal row click |
| MyDay | `MyDayScreen.tsx` | MyDayStack | `undefined` | Tab root; AddMeal save return |
| MyPath | `MyPath/MyPathScreen.tsx` | MyPathStack | `undefined` | Tab root |
| ProfileMenu | `ProfileScreen.tsx` | ProfileStack | `undefined` | Tab root |
| ProductConfirm | `ProductFlow/ProductConfirmScreen.tsx` | MyDayStack, ProfileStack | `externalProduct` | BarcodeScanner result |
| ProductDetails | `ProductFlow/ProductDetailsScreen.tsx` | ProfileStack | `productId: string` | ProductsList → ProductDetails |
| ProductForm | `ProductFlow/ProductFormScreen.tsx` | MyDayStack, ProfileStack | `productId?: string` | SelectProduct, ProductDetails, MealBuilder |
| ProductSearch | `ProductFlow/ProductSearchScreen.tsx` | ProfileStack | `undefined` | ProductsList (import) |
| ProductsList | `ProductFlow/ProductsListScreen.tsx` | ProfileStack | `undefined` | ProfileMenu |
| SelectProduct | `AddMealFlow/components/SelectProduct/index.tsx` | MyDayStack | `undefined` | AddMeal → SelectProduct |

---

## Parameter Type Definitions

From `client/src/app/navigationTypes.ts`:

```typescript
// Product from external source (barcode API)
type ExternalProductParam = {
  code: string;
  name: string;
  brands?: string;
  caloriesPer100g: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
}

// Create/edit mode: productId undefined = create, defined = edit
type ProductFormParams = { productId?: string } | undefined

// Goal calculation result
type GoalCalculateResponse = {
  dailyCaloriesKcal: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}
```

---

## Cross-Tab Navigation Patterns

### MyPath → ProfileTab/GoalSetup

User presses "Set up goal" on MyPath screen:

```typescript
navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()
  ?.navigate("ProfileTab", { screen: "GoalSetup" });
```

### MyPath → MyDayTab/AddMeal

FAB action "Add meal" on MyPath screen:

```typescript
navigation.getParent<BottomTabNavigationProp<RootTabParamList>>()
  ?.navigate("MyDayTab", { screen: "AddMeal" });
```

Both patterns use `getParent()` to access the tab navigator from a nested stack.

---

## Context Wrappers

### DraftMealProvider

Wraps **MyDayStack** only. Manages draft meal state (items, meal type) during AddMeal workflow.

- **Location**: `client/src/screens/AddMealFlow/context.tsx`
- **Consumer**: `AddMealScreen`, `SelectProductScreen`, `AddFoodScreen`
- **State**: `{ draft: { itemsByMealType, mealType }, setMealType, reset, removeItem }`
- **Lifecycle**: Draft persists across stack navigation within MyDayStack; cleared on save or MyDay tab reset

---

## Key Navigation Properties

### Stack-Level Options

- **headerShown**: `false` on all root screens (MyDay, MyPath, ProfileMenu)
- **contentStyle**: `{ backgroundColor: colors.background }` — matches theme
- **Title**: Each screen has stack-level title for header (except root screens)

### Tab-Level Options

- **tabBarActiveTintColor**: `colors.tabBarActive`
- **tabBarInactiveTintColor**: `colors.tabBarInactive`
- **tabBarLabelStyle**: `{ fontSize: 12, fontWeight: "600" }`
- **Tab press listeners**: Reset stack to root screen on press (MyDay → MyDay, ProfileMenu → ProfileMenu)

---

## Implementation Notes

1. **Type Safety**: All param lists defined in `navigationTypes.ts`; no implicit navigation or params.
2. **Device Scoping**: All screens respect device-scoped data (auth layer in `app/api/deps.py`).
3. **Async Loading**: MyDay, MyPath load goal/stats on mount; screens handle loading states via hooks.
4. **Shared Screens**: ProductForm, BarcodeScanner, ProductConfirm instantiated in both stacks (no shared navigator).
5. **FAB Reset**: FABs close on blur/focus/tab-press to avoid stale open state.
6. **Favorites/Recents**: SelectProduct maintains favorites and recents in AsyncStorage; persists across sessions.

---

## Files Reference

| Path | Purpose |
|------|---------|
| `client/src/app/AppNavigator.tsx` | Tab, stack, and screen registration |
| `client/src/app/navigationTypes.ts` | Param list definitions |
| `client/src/screens/MyDayScreen.tsx` | Day summary, meal type entry |
| `client/src/screens/AddMealFlow/` | AddMeal, SelectProduct, AddFood, DraftMealProvider |
| `client/src/screens/ProfileScreen.tsx` | Settings, menu, theme, reset |
| `client/src/screens/ProductFlow/` | Product CRUD, search, import |
| `client/src/screens/MealFlow/` | Meal CRUD, templates, entries |
| `client/src/screens/GoalFlow/` | Goal setup, calculation, manual entry |
| `client/src/screens/MyPath/` | Stats, trends, weight, streaks |
| `client/src/screens/BarcodeFlow/` | Barcode scanner, manual fallback |
