---
type: plan
status: draft
last-updated: 2026-03-15
---

# Implementation Plan: Search Results Relevance Sorting and Recent Badge

## Overview

Fix two bugs in the product search experience: (1) backend returns user products first then catalog products instead of interleaving by relevance, and (2) frontend shows a refresh icon for recent items but no "Recent" text badge like catalog items have a "Catalog" badge.

## Success Criteria

- [ ] Search results interleaved by relevance (starts-with > contains), not user-first
- [ ] User products that start with the query appear before catalog products that merely contain it
- [ ] Catalog products with high tsvector rank appear above user products that only partially match
- [ ] Recent items in search results display a "Recent" text badge alongside the existing icon
- [ ] Existing test suite passes with updated assertions
- [ ] No schema/migration changes needed
- [ ] No breaking changes to the API response shape

## Assumptions

- User products have no tsvector column -- relevance must use ILIKE + positional scoring (validated by reading `Product` model: only `name` TEXT column, no FTS)
- Catalog products already have `search_vector` tsvector with GIN index and `ts_rank` is used in the catalog service (validated in `catalog/service.py` lines 49-56)
- The API response schema `ProductSearchResultItem` does not need changes -- only the ordering of results changes
- The frontend `recentSet` is already computed and available in `renderSearchRow` scope (validated at line 182)
- No frontend tests exist for SelectProduct screen (confirmed by glob search)

## Architecture Changes

- **No schema changes** -- the `ProductSearchResultItem` Pydantic model stays the same
- **No migration needed** -- no database changes
- **Backend service logic** -- merge both queries into a single sorted result using SQL `CASE` expressions for relevance scoring
- **Frontend component** -- add a "Recent" badge text element to user search rows

## Files Affected

### Modified Files

- `backend/app/features/products/service.py` -- Rewrite `search_products()` to score and interleave results by relevance
- `backend/tests/services/test_products_db.py` -- Update `test_search_returns_user_first` and add new relevance-ordering tests
- `client/src/screens/AddMealFlow/components/SelectProduct/index.tsx` -- Add "Recent" text badge in `renderSearchRow` for user items that are in `recentSet`

## Implementation Steps

### Phase 1: Backend -- Relevance-Based Search Ordering

Estimate: 2 files

**Design decision: Relevance scoring approach**

Since user products lack a tsvector column, use a simple positional heuristic via SQL `CASE` expressions:

- **Score 0 (highest)**: name starts with the query (case-insensitive)
- **Score 1**: name contains the query but doesn't start with it

For catalog products, use the same positional heuristic. The tsvector `ts_rank` is useful for ranking within the catalog, but for interleaving with user products, positional matching provides a consistent cross-source comparison.

Execute both queries independently (user + catalog), assign a `_rank` score to each `ProductSearchResultItem`, then merge and sort by `(_rank, name)`. This avoids a complex UNION query and keeps the two query paths separate (important because user products are device-scoped while catalog is global).

1. **Refactor `search_products` in service** (`backend/app/features/products/service.py`)
   - Action: Add a `_relevance_rank(name: str, query: str) -> int` helper that returns 0 if `name` starts with `query` (case-insensitive), else 1
   - Action: After building `user_results` and `catalog_results` lists, assign rank to each item using the helper (compare against `name` for user, `display_name` for catalog)
   - Action: Merge both lists into one: `combined = user_results + catalog_results`
   - Action: Sort combined list by `(rank, name.lower())` using Python `sorted()` with a key function
   - Action: Return `combined[:limit]` to respect the overall limit
   - Action: Change both sub-query limits -- fetch up to `limit` from each source (not 10 user + 25 catalog) so that sorting can produce the best `limit` results from the full candidate pool. Cap each sub-query at `limit` to avoid unbounded fetches
   - Why: The current approach hardcodes user products first; the new approach scores all results uniformly and sorts by relevance
   - Dependencies: None
   - Risk: Low -- pure Python sorting on small result sets (max 70 items before trim)
   - Test: New and updated tests in Phase 1 Step 2

2. **Update and add search tests** (`backend/tests/services/test_products_db.py`)
   - Action: Rename `test_search_returns_user_first` to `test_search_interleaves_by_relevance`
   - Action: New test body: create a user product "Chicken thigh" and a catalog product "Chicken breast". Search for "Chicken breast". Assert the catalog "Chicken breast" appears before user "Chicken thigh" because "Chicken breast" is an exact-start match for the full query while "Chicken thigh" only starts with "Chicken"
   - Action: Add `test_search_starts_with_ranks_higher` -- create user product "Chicken breast" and catalog product "Fried chicken". Search "chicken". Assert user "Chicken breast" (starts with "chicken") appears before catalog "Fried chicken" (contains "chicken")
   - Action: Add `test_search_same_rank_sorts_alphabetically` -- create user "Chicken B" and catalog "Chicken A" (with display_name "Chicken A"). Search "Chicken". Assert catalog "Chicken A" appears first (same rank, alphabetical)
   - Action: Update `test_search_limit_cap` if its assertions depend on user-first ordering
   - Why: Existing test asserts user-first ordering which is the bug; new tests validate relevance interleaving
   - Dependencies: Phase 1 Step 1
   - Risk: Low
   - Test: `cd backend && pytest tests/services/test_products_db.py -v`

**Verification**: `cd backend && pytest tests/services/test_products_db.py -v && ruff check app/features/products/service.py`

### Phase 2: Frontend -- "Recent" Text Badge

Estimate: 1 file

1. **Add "Recent" badge to user search rows** (`client/src/screens/AddMealFlow/components/SelectProduct/index.tsx`)
   - Action: Add a `recentBadge` style in `StyleSheet.create`, matching the existing `catalogBadge` style (fontSize 11, textSecondary color, opacity 0.7, marginTop 2)
   - Action: In `renderSearchRow`, for the `item.source === "user"` branch where the product is found in `productMap` (line 303-306, which delegates to `renderUserRow`): instead of directly calling `renderUserRow`, inline or wrap the rendering to add a "Recent" badge. Specifically, after the row content, if `recentSet.has(item.id)`, render `<Text style={styles.recentBadge}>Recent</Text>` inside the `rowContent` View
   - Action: Also update `renderUserRow` itself to accept an optional `showBadges` boolean or check `recentSet` directly -- since `renderUserRow` is also used in the default (non-search) list, the "Recent" badge should only appear in search results to avoid clutter in the default list. The cleanest approach: extract the badge logic into `renderSearchRow` only, not into `renderUserRow`
   - Detailed approach for `renderSearchRow` user branch (lines 302-326):
     - When `product` is found in `productMap` (line 303-304): instead of `return renderUserRow({ item: product })`, duplicate the Pressable structure but add the Recent badge conditionally
     - When `product` is NOT found (line 307-325): similarly add the Recent badge if `recentSet.has(item.id)`
   - Why: Users need a visual label to understand why certain items appear in their results (they were recently used), matching the pattern of "Catalog" badge for catalog items
   - Dependencies: None (independent of Phase 1)
   - Risk: Low -- purely additive UI change
   - Test: Manual verification -- search for a product that was recently used, confirm "Recent" badge appears. No existing frontend tests for this screen

**Verification**: `cd client && npx tsc --noEmit && pnpm run lint`

## Testing Strategy

- **Backend unit tests**: Update and add tests in `backend/tests/services/test_products_db.py` covering:
  - Starts-with query ranks higher than contains
  - User and catalog results interleaved (not user-first)
  - Same-rank results sorted alphabetically
  - Limit still respected after interleaving
  - Existing tests (calories computation, device scoping, soft deletes) still pass
- **No frontend unit tests**: SelectProduct has no test file and this is a visual-only change (adding a Text element). Manual verification is appropriate
- **Manual verification**: In the app, search "chicken" with both user products and catalog products containing "chicken" -- verify they are sorted by relevance, not source. Verify recently-used products show a "Recent" badge

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Python-side sorting on 70 items per search has minor perf cost vs pure SQL | Low | 70 items is trivial; profile only if latency reported |
| Changing sub-query limits (both to `limit` instead of 10/25 split) fetches more rows from DB | Low | Still capped at `limit` per source (35 default); catalog uses selectin for portions but this is the same as before |
| Duplicating renderUserRow JSX in renderSearchRow increases code | Low | Acceptable tradeoff for clean separation of badge logic between search and default list contexts |
| test_search_returns_user_first test was previously asserting the buggy behavior | Medium | Explicitly rename and rewrite the test to assert correct behavior; no silent test change |

## Open Questions

None -- the approach is straightforward and doesn't require design decisions beyond what's specified.
