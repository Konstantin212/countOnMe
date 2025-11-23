Part 1) Waterfall plan as a Product Owner
0. Vision (1 page)

Goal: a calorie tracking app that lets you log meals. Start manual. Later add AI dish parsing.
Success metrics for MVP:

You can add/edit products and save meals without crashes.

Logging a meal takes < 60 seconds.

Data persists after app restart.

1. Requirements phase (SRS / PRD)

Deliverables:

User stories for MVP

As a user, I can add a product manually with name + calories per 100g (or per unit) so I can use it later.

As a user, I can edit or delete a product.

As a user, I can create a meal by selecting products and entering quantities.

As a user, I can save a meal and see history.

As a user, I can reopen the app and all products/meals are still there.

Functional requirements
FR-MVP-1 Product Catalog

Create product: fields

name (string, required)

caloriesPer100g (number, required, >=0)

optional: protein/fat/carbs per 100g (numbers) — can defer but easy to include.

List products with search.

Edit product.

Delete product (soft delete ok).

FR-MVP-2 Meal Builder

Create meal: fields

mealName (string, optional auto date name)

items: list of { productId, grams }

Total calories = Σ(grams * caloriesPer100g / 100)

Ability to edit grams per item in meal.

Save meal.

Meal history list and details screen.

FR-POST-MVP (later)

LLM dish input → parsed to ingredients (products) + estimated grams.

UI to adjust each ingredient and recalculates totals.

Templates, favorites, cloud sync, barcode scanner, etc. (not now).

Non-functional requirements

Offline-first.

Fast startup (<2s on mid Android).

Simple UI, no signup for MVP.

Data storage local (no backend).

iOS nice-to-have; Android must work.

Out of scope for MVP

Accounts, cloud sync, social, camera, scanning, AI.

Payment, subscriptions.
Keep it small or you won’t ship.

2. System & UX design phase

Deliverables:

Information architecture / screens

ProductsListScreen

ProductFormScreen (Add/Edit)

MealsListScreen (History)

MealBuilderScreen (Create/Edit)

MealDetailsScreen

Wireframes
Low-fidelity is enough. Define:

Primary action per screen

Empty states

Error states

Navigation flow

Data model

Product

id: string (uuid)

name: string

caloriesPer100g: number

macros?: { protein, fat, carbs }

createdAt, updatedAt

Meal

id: string

name: string

items: MealItem[]

totalCalories: number (derived but store for speed)

createdAt, updatedAt

MealItem

productId: string

grams: number

Tech decisions

React Native with Expo (fastest path).

TypeScript.

React Navigation.

Local persistence: start with AsyncStorage (simple). If it grows, move to SQLite later.

3. Implementation phase (by milestones)

Each milestone has a clear “done”.

Milestone A — Project skeleton

App boots.

Tab navigation: Products / Meals.

Basic styling system.
Done when: builds on Android emulator + physical device.

Milestone B — Manual product adding

Products list (empty state).

Add product form with validation.

Persist products locally.
Done when: add product, kill app, reopen → product still there.

Milestone C — Product edit/delete

Tap product → edit screen.

Delete product with confirm.
Done when: edits reflect in list and meals use updated values.

Milestone D — Meal builder

Select products into a meal.

Input grams per item.

Auto total calories.

Save meal locally.
Done when: history shows meals + totals.

Milestone E — Meal edit + details

Open meal → see items, totals.

Edit meal items + grams.
Done when: editing recomputes and persists.

Milestone F — Polish

Search products.

Basic UX cleanup.

Edge cases (0 grams, missing product, etc.)
Done when: no obvious UX holes.

Later milestone G — LLM input
Not part of MVP. You only start this after F ships.

4. Verification / QA phase

Deliverables:

Test checklist per milestone.

Small automated tests for core logic (calculation, storage).

Manual test matrix (Android versions).

Acceptance checklist examples:

Product calories can’t be negative.

Total calories matches formula.

Data survives restart.

No duplicate IDs.

Large meal (50 items) still ok.

5. Release phase

Deliverables:

Android internal build (APK/AAB).

Simple README for yourself.

Versioning.

6. Maintenance phase

Bug fixes.

Refactor storage to SQLite if needed.

Only after stability: start LLM.

Part 2) Solution Architect guide: how to build it in React Native (Expo)
0) What you’re building (mental model)

React Native is still React, but:

No DOM, no HTML. You use native components: View, Text, TextInput, Pressable, FlatList.

Styling is JS objects (similar to CSS but not the same).

Navigation is not the browser router; you use React Navigation.

Storage is not localStorage; you use AsyncStorage / SQLite.

Expo hides the painful native setup.