"""USDA SR Legacy catalog seeder.

Reads the SR Legacy JSON bulk download and upserts products + portions
into ``catalog_products`` / ``catalog_portions``.

Uses batch inserts (``executemany``) for dramatically faster seeding
over network connections (~70 round-trips instead of ~7000).
"""

from __future__ import annotations

import glob
import json
import logging
import os
from typing import Any

from scripts.seeders.base import (
    AbstractSeeder,
    build_portion_label,
    calc_kcal_per_100g,
    extract_macros_per_100g,
    normalize_unit,
)
from scripts.seeders.name_cleaner import clean_usda_name

logger = logging.getLogger(__name__)

_EXCLUDED_CATEGORIES: frozenset[str] = frozenset({"Supplements", "Baby Foods"})

# Glob patterns to locate the SR Legacy JSON in seeds_dir.
_SR_LEGACY_GLOBS: list[str] = [
    "*sr_legacy*.json",
    "*SR*legacy*.json",
    "FoodData_Central_sr_legacy_food_json_*.json",
]

_BATCH_SIZE = 100


class UsdaSeeder(AbstractSeeder):
    """Seed catalog from the USDA SR Legacy JSON."""

    # ------------------------------------------------------------------
    # Quality gates (public for testability)
    # ------------------------------------------------------------------

    @staticmethod
    def _is_valid_food(food: dict[str, Any]) -> bool:
        """Check that the food has a valid fdcId and a non-empty description."""
        fdc_id = food.get("fdcId") or food.get("fdc_id") or 0
        if not fdc_id:
            return False
        description = (food.get("description") or "").strip()
        return bool(description)

    @staticmethod
    def _is_not_excluded_category(food: dict[str, Any]) -> bool:
        """Return False for excluded categories (Supplements, Baby Foods)."""
        category_desc: str | None = (food.get("foodCategory") or {}).get("description")
        if category_desc and category_desc in _EXCLUDED_CATEGORIES:
            return False
        return True

    @staticmethod
    def _has_calories(kcal: float) -> bool:
        """Return True if kcal is positive."""
        return kcal > 0

    # ------------------------------------------------------------------
    # File discovery
    # ------------------------------------------------------------------

    def _find_sr_legacy_file(self) -> str | None:
        """Find the SR Legacy JSON file in seeds_dir."""
        for pattern in _SR_LEGACY_GLOBS:
            matches = glob.glob(os.path.join(self.seeds_dir, pattern))
            if matches:
                return matches[0]
        return None

    # ------------------------------------------------------------------
    # Data preparation (pure, no DB)
    # ------------------------------------------------------------------

    @staticmethod
    def _prepare_food(food: dict[str, Any]) -> dict[str, Any] | None:
        """Extract product + portion data from a single USDA food item.

        Returns None if the food should be skipped.  Otherwise returns a
        dict with keys: source_id, name, display_name, category, kcal,
        macros, portions.
        """
        fdc_id: int = food.get("fdcId") or food.get("fdc_id") or 0
        name: str = (food.get("description") or "").strip()
        category: str | None = (food.get("foodCategory") or {}).get("description")
        if isinstance(category, int):
            category = None

        macros = extract_macros_per_100g(food)
        kcal = calc_kcal_per_100g(macros)

        display_name = clean_usda_name(name)
        source_id = str(fdc_id)

        # Build portion list (excluding the default 100g which we always add)
        portions: list[dict[str, Any]] = []
        for portion in food.get("foodPortions", []):
            gram_weight_raw = portion.get("gramWeight")
            if gram_weight_raw is None:
                continue

            gram_weight = float(gram_weight_raw)
            measure_unit: dict[str, Any] = portion.get("measureUnit") or {}
            unit = normalize_unit(measure_unit.get("abbreviation"), measure_unit.get("name"))
            if unit is None:
                continue

            label = build_portion_label(portion)
            amount_raw = portion.get("value") or portion.get("amount") or 1.0

            portions.append({
                "label": label,
                "base_amount": round(float(amount_raw), 3),
                "base_unit": unit,
                "gram_weight": round(gram_weight, 3),
                "calories": round(kcal * gram_weight / 100.0, 3),
                "protein": (
                    round(macros["protein_g_100g"] * gram_weight / 100.0, 3)
                    if macros["protein_g_100g"] is not None else None
                ),
                "carbs": (
                    round(macros["carbs_g_100g"] * gram_weight / 100.0, 3)
                    if macros["carbs_g_100g"] is not None else None
                ),
                "fat": (
                    round(macros["fat_g_100g"] * gram_weight / 100.0, 3)
                    if macros["fat_g_100g"] is not None else None
                ),
            })

        return {
            "source_id": source_id,
            "name": name,
            "display_name": display_name,
            "category": category,
            "kcal": round(kcal, 3),
            "macros": macros,
            "portions": portions,
        }

    # ------------------------------------------------------------------
    # Core pipeline
    # ------------------------------------------------------------------

    async def run(self, conn: Any, *, dry_run: bool = False) -> tuple[int, int]:
        """Seed USDA SR Legacy products and portions.

        Returns:
            ``(products_seeded, portions_seeded)`` counts.
        """
        json_path = self._find_sr_legacy_file()
        if json_path is None:
            logger.warning(
                "No SR Legacy JSON found in %s — skipping USDA seed.", self.seeds_dir,
            )
            return 0, 0

        logger.info("Loading USDA SR Legacy data from %s ...", json_path)
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)

        foods: list[dict[str, Any]] = data.get("SRLegacyFoods", [])
        total_foods = len(foods)
        logger.info("Found %d raw USDA foods.", total_foods)

        # First pass: filter and prepare all valid foods in memory
        prepared: list[dict[str, Any]] = []
        for food in foods:
            if not self._is_valid_food(food):
                continue
            if not self._is_not_excluded_category(food):
                continue

            macros = extract_macros_per_100g(food)
            kcal = calc_kcal_per_100g(macros)
            if not self._has_calories(kcal):
                continue

            item = self._prepare_food(food)
            if item is not None:
                prepared.append(item)

        total_valid = len(prepared)
        logger.info("Filtered to %d valid USDA foods.", total_valid)

        if dry_run:
            return total_valid, 0

        # Second pass: batch insert products, then portions
        total_products = 0
        total_portions = 0

        for batch_start in range(0, total_valid, _BATCH_SIZE):
            batch = prepared[batch_start : batch_start + _BATCH_SIZE]

            # Batch upsert products
            product_rows = [
                (item["source_id"], item["name"], item["display_name"], item["category"])
                for item in batch
            ]
            await conn.executemany(
                """
                INSERT INTO catalog_products
                    (id, source, source_id, name, display_name, category,
                     created_at, updated_at)
                VALUES
                    (gen_random_uuid(), 'usda', $1, $2, $3, $4, now(), now())
                ON CONFLICT (source, source_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    display_name = EXCLUDED.display_name,
                    category = EXCLUDED.category,
                    updated_at = now()
                """,
                product_rows,
            )
            total_products += len(batch)

            # Fetch product IDs for this batch (needed for portions)
            source_ids = [item["source_id"] for item in batch]
            id_rows = await conn.fetch(
                """
                SELECT id, source_id FROM catalog_products
                WHERE source = 'usda' AND source_id = ANY($1::text[])
                """,
                source_ids,
            )
            id_map: dict[str, Any] = {row["source_id"]: row["id"] for row in id_rows}

            # Delete existing portions for this batch
            product_ids = list(id_map.values())
            await conn.execute(
                "DELETE FROM catalog_portions WHERE catalog_product_id = ANY($1::uuid[])",
                product_ids,
            )

            # Build all portion rows for this batch
            portion_rows: list[tuple[Any, ...]] = []
            for item in batch:
                product_id = id_map.get(item["source_id"])
                if product_id is None:
                    continue

                macros = item["macros"]

                # Default "100 g" portion
                portion_rows.append((
                    product_id,
                    "100 g",
                    100.0,
                    "g",
                    100.0,
                    item["kcal"],
                    round(macros["protein_g_100g"], 3) if macros["protein_g_100g"] is not None else None,
                    round(macros["carbs_g_100g"], 3) if macros["carbs_g_100g"] is not None else None,
                    round(macros["fat_g_100g"], 3) if macros["fat_g_100g"] is not None else None,
                    True,
                ))

                # Additional USDA portions
                for p in item["portions"]:
                    portion_rows.append((
                        product_id,
                        p["label"],
                        p["base_amount"],
                        p["base_unit"],
                        p["gram_weight"],
                        p["calories"],
                        p["protein"],
                        p["carbs"],
                        p["fat"],
                        False,
                    ))

            if portion_rows:
                await conn.executemany(
                    """
                    INSERT INTO catalog_portions
                        (id, catalog_product_id, label, base_amount, base_unit,
                         gram_weight, calories, protein, carbs, fat,
                         is_default, created_at, updated_at)
                    VALUES
                        (gen_random_uuid(), $1, $2, $3, $4,
                         $5, $6, $7, $8, $9, $10, now(), now())
                    """,
                    portion_rows,
                )
                total_portions += len(portion_rows)

            pct = min((batch_start + len(batch)) / total_valid * 100, 100.0)
            print(  # noqa: T201
                f"\rUSDA: {pct:.1f}% ({batch_start + len(batch)}/{total_valid}) — "
                f"{total_products} products, {total_portions} portions",
                end="", flush=True,
            )

        print()  # noqa: T201 — newline after progress
        logger.info(
            "USDA seed complete: %d products, %d portions.", total_products, total_portions,
        )
        return total_products, total_portions
