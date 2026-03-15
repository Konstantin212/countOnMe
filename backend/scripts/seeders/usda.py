"""USDA SR Legacy catalog seeder.

Reads the SR Legacy JSON bulk download and upserts products + portions
into ``catalog_products`` / ``catalog_portions``.
"""

from __future__ import annotations

import glob
import json
import logging
import os
import uuid
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
        logger.info("Found %d raw USDA foods.", len(foods))

        total_products = 0
        total_portions = 0

        for food in foods:
            if not self._is_valid_food(food):
                continue
            if not self._is_not_excluded_category(food):
                continue

            macros = extract_macros_per_100g(food)
            kcal = calc_kcal_per_100g(macros)

            if not self._has_calories(kcal):
                continue

            if dry_run:
                total_products += 1
                continue

            n_products, n_portions = await self._upsert_food(conn, food, macros, kcal)
            total_products += n_products
            total_portions += n_portions

            if total_products > 0 and total_products % 500 == 0:
                logger.info(
                    "USDA progress: %d products, %d portions seeded...",
                    total_products, total_portions,
                )

        logger.info(
            "USDA seed complete: %d products, %d portions.", total_products, total_portions,
        )
        return total_products, total_portions

    async def _upsert_food(
        self,
        conn: Any,
        food: dict[str, Any],
        macros: dict[str, float | None],
        kcal: float,
    ) -> tuple[int, int]:
        """Upsert a single USDA food and its portions. Returns (1, n_portions)."""
        fdc_id: int = food.get("fdcId") or food.get("fdc_id") or 0
        name: str = (food.get("description") or "").strip()
        category: str | None = (food.get("foodCategory") or {}).get("description")
        if isinstance(category, int):
            category = None

        display_name = clean_usda_name(name)
        source_id = str(fdc_id)

        # Upsert product
        row = await conn.fetchrow(
            """
            INSERT INTO catalog_products
                (id, source, source_id, name, display_name, category, created_at, updated_at)
            VALUES
                (gen_random_uuid(), 'usda', $1, $2, $3, $4, now(), now())
            ON CONFLICT (source, source_id) DO UPDATE SET
                name = EXCLUDED.name,
                display_name = EXCLUDED.display_name,
                category = EXCLUDED.category,
                updated_at = now()
            RETURNING id
            """,
            source_id, name, display_name, category,
        )
        catalog_product_id: uuid.UUID = row["id"]

        # Replace existing portions
        await conn.execute(
            "DELETE FROM catalog_portions WHERE catalog_product_id = $1",
            catalog_product_id,
        )

        portions_inserted = 0

        # Default "100 g" portion
        await conn.execute(
            """
            INSERT INTO catalog_portions
                (id, catalog_product_id, label, base_amount, base_unit,
                 gram_weight, calories, protein, carbs, fat, is_default, created_at, updated_at)
            VALUES
                (gen_random_uuid(), $1, '100 g', 100, 'g',
                 100, $2, $3, $4, $5, true, now(), now())
            """,
            catalog_product_id,
            round(kcal, 3),
            round(macros["protein_g_100g"], 3) if macros["protein_g_100g"] is not None else None,
            round(macros["carbs_g_100g"], 3) if macros["carbs_g_100g"] is not None else None,
            round(macros["fat_g_100g"], 3) if macros["fat_g_100g"] is not None else None,
        )
        portions_inserted += 1

        # USDA food portions
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

            await conn.execute(
                """
                INSERT INTO catalog_portions
                    (id, catalog_product_id, label, base_amount, base_unit,
                     gram_weight, calories, protein, carbs, fat, is_default,
                     created_at, updated_at)
                VALUES
                    (gen_random_uuid(), $1, $2, $3, $4,
                     $5, $6, $7, $8, $9, false, now(), now())
                """,
                catalog_product_id,
                label,
                round(float(amount_raw), 3),
                unit,
                round(gram_weight, 3),
                round(kcal * gram_weight / 100.0, 3),
                round(macros["protein_g_100g"] * gram_weight / 100.0, 3)
                if macros["protein_g_100g"] is not None else None,
                round(macros["carbs_g_100g"] * gram_weight / 100.0, 3)
                if macros["carbs_g_100g"] is not None else None,
                round(macros["fat_g_100g"] * gram_weight / 100.0, 3)
                if macros["fat_g_100g"] is not None else None,
            )
            portions_inserted += 1

        return 1, portions_inserted
