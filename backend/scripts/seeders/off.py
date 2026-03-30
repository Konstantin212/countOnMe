"""Open Food Facts catalog seeder.

Reads a pre-filtered CSV (produced by ``scripts/prepare_off_data.py``) and
upserts branded/packaged products into ``catalog_products`` / ``catalog_portions``.

Uses batch inserts (``executemany``) for dramatically faster seeding
over network connections.  Deduplication against USDA names is done
in-memory (one query up front) instead of per-row.
"""

from __future__ import annotations

import csv
import logging
import os
import re
from typing import Any

from scripts.seeders.base import AbstractSeeder

logger = logging.getLogger(__name__)

_BATCH_SIZE = 100

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

        # Read all rows into memory for batch processing
        rows: list[dict[str, str]] = []
        with open(csv_path, encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)

        total_rows = len(rows)
        logger.info("Found %d OFF rows.", total_rows)

        # First pass: filter rows in memory (valid name, barcode, kcal)
        valid_rows: list[dict[str, Any]] = []
        for row in rows:
            product_name = (row.get("product_name") or "").strip()
            barcode = (row.get("code") or "").strip()
            brand = (row.get("brands") or "").strip() or None

            if not product_name or not barcode:
                continue

            kcal = _safe_float(row.get("energy-kcal_100g") or row.get("energy_kcal_100g"))
            if kcal is None or kcal <= 0:
                continue

            protein = _safe_float(row.get("proteins_100g"))
            carbs = _safe_float(row.get("carbohydrates_100g"))
            fat = _safe_float(row.get("fat_100g"))

            # Parse serving size
            serving_raw = (row.get("serving_size") or "").strip()
            serving_label: str | None = None
            serving_gram_weight: float | None = None
            if serving_raw:
                label, gram_weight = parse_serving_size(serving_raw)
                if gram_weight is not None and gram_weight > 0:
                    serving_label = label
                    serving_gram_weight = gram_weight

            valid_rows.append({
                "product_name": product_name,
                "barcode": barcode,
                "brand": brand,
                "kcal": kcal,
                "protein": protein,
                "carbs": carbs,
                "fat": fat,
                "serving_label": serving_label,
                "serving_gram_weight": serving_gram_weight,
            })

        logger.info("Filtered to %d valid OFF rows.", len(valid_rows))

        if dry_run:
            return len(valid_rows), 0

        # Load all USDA display names into a set for in-memory dedup
        usda_names_rows = await conn.fetch(
            "SELECT lower(trim(display_name)) AS dn FROM catalog_products WHERE source = 'usda'",
        )
        usda_names: frozenset[str] = frozenset(row["dn"] for row in usda_names_rows)
        logger.info("Loaded %d USDA display names for dedup.", len(usda_names))

        # Filter out rows whose product_name matches a USDA display_name
        deduped_rows: list[dict[str, Any]] = []
        skipped_dedup = 0
        for item in valid_rows:
            if item["product_name"].lower().strip() in usda_names:
                skipped_dedup += 1
            else:
                deduped_rows.append(item)

        total_valid = len(deduped_rows)
        logger.info(
            "After dedup: %d rows to seed (%d skipped as USDA duplicates).",
            total_valid, skipped_dedup,
        )

        # Batch insert products and portions
        total_products = 0
        total_portions = 0

        for batch_start in range(0, total_valid, _BATCH_SIZE):
            batch = deduped_rows[batch_start : batch_start + _BATCH_SIZE]

            # Batch upsert products
            product_rows = [
                (item["barcode"], item["product_name"], item["brand"], item["barcode"])
                for item in batch
            ]
            await conn.executemany(
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
                """,
                product_rows,
            )
            total_products += len(batch)

            # Fetch product IDs for this batch
            barcodes = [item["barcode"] for item in batch]
            id_rows = await conn.fetch(
                """
                SELECT id, source_id FROM catalog_products
                WHERE source = 'off' AND source_id = ANY($1::text[])
                """,
                barcodes,
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
                product_id = id_map.get(item["barcode"])
                if product_id is None:
                    continue

                # Default "100 g" portion
                portion_rows.append((
                    product_id,
                    "100 g",
                    100.0,
                    "g",
                    100.0,
                    round(item["kcal"], 3),
                    round(item["protein"], 3) if item["protein"] is not None else None,
                    round(item["carbs"], 3) if item["carbs"] is not None else None,
                    round(item["fat"], 3) if item["fat"] is not None else None,
                    True,
                ))

                # Optional serving portion
                if item["serving_gram_weight"] is not None:
                    scale = item["serving_gram_weight"] / 100.0
                    portion_rows.append((
                        product_id,
                        item["serving_label"],
                        1.0,
                        "serving",
                        round(item["serving_gram_weight"], 3),
                        round(item["kcal"] * scale, 3),
                        round(item["protein"] * scale, 3) if item["protein"] is not None else None,
                        round(item["carbs"] * scale, 3) if item["carbs"] is not None else None,
                        round(item["fat"] * scale, 3) if item["fat"] is not None else None,
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

            pct = min((batch_start + len(batch)) / total_valid * 100, 100.0) if total_valid > 0 else 100.0
            print(  # noqa: T201
                f"\rOFF: {pct:.1f}% ({batch_start + len(batch)}/{total_valid}) — "
                f"{total_products} products, {total_portions} portions, "
                f"{skipped_dedup} deduped",
                end="", flush=True,
            )

        print()  # noqa: T201 — newline after progress
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
