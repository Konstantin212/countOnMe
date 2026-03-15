"""Open Food Facts catalog seeder.

Reads a pre-filtered CSV (produced by ``scripts/prepare_off_data.py``) and
upserts branded/packaged products into ``catalog_products`` / ``catalog_portions``.
"""

from __future__ import annotations

import csv
import logging
import os
import re
import uuid
from typing import Any

from scripts.seeders.base import AbstractSeeder

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Serving-size parsing
# ---------------------------------------------------------------------------

# Patterns tried in order — first match wins.
_SERVING_PATTERNS: list[re.Pattern[str]] = [
    # Parenthesised gram weight: "1 bar (40g)" -> 40
    re.compile(r"\((\d+\.?\d*)\s*g\)"),
    # Standalone grams: "30g" or "30 g"
    re.compile(r"(\d+\.?\d*)\s*g\b"),
    # Millilitres (assume density ~1): "250ml" or "250 ml"
    re.compile(r"(\d+\.?\d*)\s*ml\b"),
]


def parse_serving_size(raw: str) -> tuple[str, float | None]:
    """Extract a gram weight from a serving-size string.

    Returns:
        ``(raw_label, gram_weight)`` — ``gram_weight`` is ``None``
        when the string cannot be parsed.
    """
    if not raw:
        return (raw, None)

    for pattern in _SERVING_PATTERNS:
        match = pattern.search(raw)
        if match:
            return (raw, float(match.group(1)))

    return (raw, None)


# ---------------------------------------------------------------------------
# OFF Seeder
# ---------------------------------------------------------------------------


class OffSeeder(AbstractSeeder):
    """Seed catalog from the pre-filtered Open Food Facts CSV."""

    _CSV_FILENAME = "off_products_filtered.csv"

    async def run(self, conn: Any, *, dry_run: bool = False) -> tuple[int, int]:
        """Seed OFF products and portions.

        Returns:
            ``(products_seeded, portions_seeded)`` counts.
        """
        csv_path = os.path.join(self.seeds_dir, self._CSV_FILENAME)
        if not os.path.isfile(csv_path):
            logger.warning(
                "OFF CSV not found at %s — skipping OFF seed. "
                "Run `python -m scripts.prepare_off_data` first.",
                csv_path,
            )
            return 0, 0

        logger.info("Loading OFF data from %s ...", csv_path)

        total_products = 0
        total_portions = 0
        skipped_dedup = 0

        with open(csv_path, encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                product_name = (row.get("product_name") or "").strip()
                barcode = (row.get("code") or "").strip()
                brand = (row.get("brands") or "").strip() or None

                if not product_name or not barcode:
                    continue

                # Macros from CSV
                kcal = _safe_float(row.get("energy-kcal_100g") or row.get("energy_kcal_100g"))
                if kcal is None or kcal <= 0:
                    continue

                if dry_run:
                    total_products += 1
                    continue

                # Dedup check: skip if display_name already exists as USDA
                existing = await conn.fetchval(
                    """
                    SELECT 1 FROM catalog_products
                    WHERE source = 'usda'
                      AND lower(trim(display_name)) = lower(trim($1))
                    LIMIT 1
                    """,
                    product_name,
                )
                if existing:
                    skipped_dedup += 1
                    continue

                protein = _safe_float(row.get("proteins_100g"))
                carbs = _safe_float(row.get("carbohydrates_100g"))
                fat = _safe_float(row.get("fat_100g"))

                # Upsert product
                catalog_row = await conn.fetchrow(
                    """
                    INSERT INTO catalog_products
                        (id, source, source_id, name, display_name, brand, barcode,
                         category, created_at, updated_at)
                    VALUES
                        (gen_random_uuid(), 'off', $1, $2, $2, $3, $4,
                         NULL, now(), now())
                    ON CONFLICT (source, source_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        display_name = EXCLUDED.display_name,
                        brand = EXCLUDED.brand,
                        barcode = EXCLUDED.barcode,
                        updated_at = now()
                    RETURNING id
                    """,
                    barcode, product_name, brand, barcode,
                )
                catalog_product_id: uuid.UUID = catalog_row["id"]

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
                         gram_weight, calories, protein, carbs, fat,
                         is_default, created_at, updated_at)
                    VALUES
                        (gen_random_uuid(), $1, '100 g', 100, 'g',
                         100, $2, $3, $4, $5, true, now(), now())
                    """,
                    catalog_product_id,
                    round(kcal, 3),
                    round(protein, 3) if protein is not None else None,
                    round(carbs, 3) if carbs is not None else None,
                    round(fat, 3) if fat is not None else None,
                )
                portions_inserted += 1

                # Optional serving portion
                serving_raw = (row.get("serving_size") or "").strip()
                if serving_raw:
                    label, gram_weight = parse_serving_size(serving_raw)
                    if gram_weight is not None and gram_weight > 0:
                        scale = gram_weight / 100.0
                        await conn.execute(
                            """
                            INSERT INTO catalog_portions
                                (id, catalog_product_id, label, base_amount, base_unit,
                                 gram_weight, calories, protein, carbs, fat,
                                 is_default, created_at, updated_at)
                            VALUES
                                (gen_random_uuid(), $1, $2, 1, 'serving',
                                 $3, $4, $5, $6, $7, false, now(), now())
                            """,
                            catalog_product_id,
                            label,
                            round(gram_weight, 3),
                            round(kcal * scale, 3),
                            round(protein * scale, 3) if protein is not None else None,
                            round(carbs * scale, 3) if carbs is not None else None,
                            round(fat * scale, 3) if fat is not None else None,
                        )
                        portions_inserted += 1

                total_products += 1
                total_portions += portions_inserted

                if total_products > 0 and total_products % 500 == 0:
                    logger.info(
                        "OFF progress: %d products, %d portions seeded...",
                        total_products, total_portions,
                    )

        if skipped_dedup:
            logger.info("OFF dedup: skipped %d products matching existing USDA names.", skipped_dedup)

        logger.info(
            "OFF seed complete: %d products, %d portions.", total_products, total_portions,
        )
        return total_products, total_portions


def _safe_float(value: str | float | None) -> float | None:
    """Convert a CSV value to float, returning None on failure."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None
