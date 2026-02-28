"""Seed the catalog_products and catalog_portions tables from USDA FDC JSON files.

Usage (from backend/ directory):
    python -m scripts.seed_catalog [--seeds-dir PATH] [--dry-run]

Each JSON file must contain a top-level key ``FoundationFoods`` with a list of
USDA FDC food items.

The script uses psycopg (sync) directly — NOT asyncpg — so it can be run
without an async event loop and without importing from app.settings (which
requires DEVICE_TOKEN_PEPPER).
"""

from __future__ import annotations

import argparse
import glob
import json
import logging
import os
import re
import sys
import uuid
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supported Unit mappings (mirrors app/schemas/enums.py Unit enum)
# ---------------------------------------------------------------------------

SUPPORTED_UNITS = {"mg", "g", "kg", "ml", "l", "tsp", "tbsp", "cup"}

_UNIT_ALIASES: dict[str, str] = {
    "tablespoon": "tbsp",
    "teaspoon": "tsp",
    "milliliter": "ml",
    "millilitre": "ml",
    "liter": "l",
    "litre": "l",
    "gram": "g",
    "kilogram": "kg",
    "milligram": "mg",
    "ounce": "oz",
    "pound": "lb",
}

# ---------------------------------------------------------------------------
# USDA nutrient extraction (ported from original backend/main.py)
# ---------------------------------------------------------------------------

_TARGET_NUTRIENTS: dict[str, str] = {
    "Total lipid (fat)": "fat_g_100g",
    "Carbohydrate, by difference": "carbs_g_100g",
    "Protein": "protein_g_100g",
    "Energy": "kcal_100g",
}


def normalize_unit(abbr: str | None, name: str | None) -> str | None:
    """Return a supported unit string or None if unrecognised/unsupported."""
    for candidate in (abbr, name):
        if candidate is None:
            continue
        cleaned = candidate.strip().lower()
        mapped = _UNIT_ALIASES.get(cleaned, cleaned)
        if mapped in SUPPORTED_UNITS:
            return mapped
    return None


def extract_macros_per_100g(food: dict[str, Any]) -> dict[str, float | None]:
    """Extract macro nutrients from a USDA food item (per 100 g basis)."""
    macros: dict[str, float | None] = {
        "fat_g_100g": None,
        "carbs_g_100g": None,
        "protein_g_100g": None,
        "kcal_100g": None,
    }
    for fn in food.get("foodNutrients", []):
        nutrient_name: str | None = (fn.get("nutrient") or {}).get("name")
        amount = fn.get("amount")
        if nutrient_name in _TARGET_NUTRIENTS:
            key = _TARGET_NUTRIENTS[nutrient_name]
            macros[key] = float(amount) if amount is not None else None
    return macros


def calc_kcal_per_100g(macros: dict[str, float | None]) -> float:
    """Return kcal per 100 g using direct Energy value or Atwater formula."""
    if macros["kcal_100g"] is not None:
        return macros["kcal_100g"]
    p = macros["protein_g_100g"] or 0.0
    c = macros["carbs_g_100g"] or 0.0
    f = macros["fat_g_100g"] or 0.0
    return 4.0 * p + 4.0 * c + 9.0 * f


# ---------------------------------------------------------------------------
# Portion label builder
# ---------------------------------------------------------------------------

def _build_portion_label(portion: dict[str, Any]) -> str:
    """Build a human-readable label for a USDA food portion."""
    value = portion.get("value") or portion.get("amount") or 1
    measure_unit: dict[str, Any] = portion.get("measureUnit") or {}
    abbr: str | None = measure_unit.get("abbreviation")
    unit_name: str | None = measure_unit.get("name")
    unit_label = abbr or unit_name or "serving"
    modifier: str | None = portion.get("modifier")
    label = f"{value} {unit_label}"
    if modifier:
        label = f"{label}, {modifier}"
    return label


# ---------------------------------------------------------------------------
# Database URL conversion
# ---------------------------------------------------------------------------

def _sync_database_url(url: str) -> str:
    """Convert an async asyncpg DATABASE_URL to a psycopg sync URL."""
    # postgresql+asyncpg:// → postgresql://
    url = re.sub(r"^postgresql\+asyncpg://", "postgresql://", url)
    # Also handle postgres+asyncpg:// shorthand
    url = re.sub(r"^postgres\+asyncpg://", "postgresql://", url)
    return url


def _load_database_url() -> str:
    """Read DATABASE_URL from env or .env file at repo root."""
    url = os.environ.get("DATABASE_URL")
    if url:
        return _sync_database_url(url)

    # Try .env at repo root (two levels up from backend/)
    repo_root = Path(__file__).resolve().parent.parent.parent
    env_file = repo_root / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                _, _, raw = line.partition("=")
                return _sync_database_url(raw.strip())

    raise RuntimeError(
        "DATABASE_URL not set. "
        "Set it as an environment variable or add DATABASE_URL= to .env at repo root."
    )


# ---------------------------------------------------------------------------
# Seed logic
# ---------------------------------------------------------------------------

def _process_food(
    food: dict[str, Any],
    *,
    cursor: Any,
    dry_run: bool,
) -> tuple[int, int]:
    """Process a single USDA food item.

    Returns (products_seeded, portions_seeded).
    """
    fdc_id: int = food.get("fdcId") or food.get("fdc_id") or 0
    if not fdc_id:
        logger.warning("Skipping food with no fdcId: %s", food.get("description", "?"))
        return 0, 0

    name: str = (food.get("description") or "").strip()
    if not name:
        logger.warning("Skipping fdcId=%s: empty description", fdc_id)
        return 0, 0

    category: str | None = (
        (food.get("foodCategory") or {}).get("description")
        or food.get("foodCategoryId")
    )
    if isinstance(category, int):
        category = None  # numeric id is not useful as display label

    macros = extract_macros_per_100g(food)
    kcal_per_100g = calc_kcal_per_100g(macros)

    if kcal_per_100g <= 0:
        logger.warning("Skipping fdcId=%s ('%s'): kcal_per_100g=%s", fdc_id, name, kcal_per_100g)
        return 0, 0

    if dry_run:
        logger.info("[dry-run] Would upsert product fdcId=%s '%s'", fdc_id, name)
        return 1, 0

    # Upsert catalog_product
    cursor.execute(
        """
        INSERT INTO catalog_products (id, fdc_id, name, category, created_at, updated_at)
        VALUES (gen_random_uuid(), %s, %s, %s, now(), now())
        ON CONFLICT (fdc_id) DO UPDATE
            SET name = EXCLUDED.name,
                category = EXCLUDED.category,
                updated_at = now()
        RETURNING id
        """,
        (fdc_id, name, category),
    )
    row = cursor.fetchone()
    catalog_product_id: uuid.UUID = row[0]

    # Delete existing portions to replace them
    cursor.execute(
        "DELETE FROM catalog_portions WHERE catalog_product_id = %s",
        (catalog_product_id,),
    )

    portions_inserted = 0

    # Insert synthetic "100 g" default portion
    cursor.execute(
        """
        INSERT INTO catalog_portions
            (id, catalog_product_id, label, base_amount, base_unit,
             gram_weight, calories, protein, carbs, fat, is_default, created_at, updated_at)
        VALUES
            (gen_random_uuid(), %s, '100 g', 100, 'g',
             100, %s, %s, %s, %s, true, now(), now())
        """,
        (
            catalog_product_id,
            round(kcal_per_100g, 3),
            round(macros["protein_g_100g"], 3) if macros["protein_g_100g"] is not None else None,
            round(macros["carbs_g_100g"], 3) if macros["carbs_g_100g"] is not None else None,
            round(macros["fat_g_100g"], 3) if macros["fat_g_100g"] is not None else None,
        ),
    )
    portions_inserted += 1

    # Insert USDA food portions
    for portion in food.get("foodPortions", []):
        gram_weight_raw = portion.get("gramWeight")
        if gram_weight_raw is None:
            logger.debug(
                "Skipping portion for fdcId=%s: no gramWeight in %s",
                fdc_id, portion
            )
            continue

        gram_weight = float(gram_weight_raw)

        measure_unit: dict[str, Any] = portion.get("measureUnit") or {}
        abbr: str | None = measure_unit.get("abbreviation")
        unit_name: str | None = measure_unit.get("name")
        unit = normalize_unit(abbr, unit_name)

        if unit is None:
            logger.debug(
                "Skipping portion for fdcId=%s: unsupported unit abbr=%r name=%r",
                fdc_id, abbr, unit_name
            )
            continue

        label = _build_portion_label(portion)
        amount_raw = portion.get("value") or portion.get("amount") or 1.0
        calories_portion = round(kcal_per_100g * gram_weight / 100.0, 3)

        cursor.execute(
            """
            INSERT INTO catalog_portions
                (id, catalog_product_id, label, base_amount, base_unit,
                 gram_weight, calories, protein, carbs, fat, is_default, created_at, updated_at)
            VALUES
                (gen_random_uuid(), %s, %s, %s, %s,
                 %s, %s, %s, %s, %s, false, now(), now())
            """,
            (
                catalog_product_id,
                label,
                round(float(amount_raw), 3),
                unit,
                round(gram_weight, 3),
                calories_portion,
                round(macros["protein_g_100g"] * gram_weight / 100.0, 3)
                if macros["protein_g_100g"] is not None else None,
                round(macros["carbs_g_100g"] * gram_weight / 100.0, 3)
                if macros["carbs_g_100g"] is not None else None,
                round(macros["fat_g_100g"] * gram_weight / 100.0, 3)
                if macros["fat_g_100g"] is not None else None,
            ),
        )
        portions_inserted += 1

    return 1, portions_inserted


def seed(seeds_dir: str, *, dry_run: bool) -> None:
    """Main seeding routine."""
    import psycopg  # type: ignore[import-untyped]

    database_url = _load_database_url()
    json_files = sorted(glob.glob(os.path.join(seeds_dir, "*.json")))

    if not json_files:
        logger.warning("No *.json files found in %s — nothing to seed.", seeds_dir)
        return

    total_products = 0
    total_portions = 0
    total_files = len(json_files)

    logger.info(
        "Starting catalog seed: %d file(s) from %s (dry_run=%s)",
        total_files, seeds_dir, dry_run,
    )

    if dry_run:
        # Dry run: parse and validate without touching DB
        for json_path in json_files:
            with open(json_path, encoding="utf-8") as f:
                data = json.load(f)
            foods: list[dict[str, Any]] = data.get("FoundationFoods", [])
            logger.info("[dry-run] %s: %d foods", json_path, len(foods))
            for food in foods:
                fdc_id = food.get("fdcId", 0)
                name = (food.get("description") or "").strip()
                macros = extract_macros_per_100g(food)
                kcal = calc_kcal_per_100g(macros)
                if kcal <= 0:
                    logger.warning("[dry-run] Skipping fdcId=%s '%s': kcal=%s", fdc_id, name, kcal)
                    continue
                logger.info("[dry-run] fdcId=%s '%s' kcal/100g=%.1f", fdc_id, name, kcal)
                total_products += 1
        print(f"[dry-run] Would seed {total_products} products from {total_files} file(s).")  # noqa: T201
        return

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cursor:
            try:
                for file_idx, json_path in enumerate(json_files, 1):
                    logger.info("Processing file %d/%d: %s", file_idx, total_files, json_path)
                    with open(json_path, encoding="utf-8") as f:
                        data = json.load(f)

                    foods: list[dict[str, Any]] = data.get("FoundationFoods", [])
                    for food in foods:
                        n_products, n_portions = _process_food(
                            food, cursor=cursor, dry_run=False
                        )
                        total_products += n_products
                        total_portions += n_portions

                        if total_products > 0 and total_products % 100 == 0:
                            logger.info(
                                "Progress: %d products, %d portions seeded so far...",
                                total_products, total_portions,
                            )

                conn.commit()
            except Exception:
                conn.rollback()
                logger.exception("Seed failed — rolled back all changes.")
                sys.exit(1)

    print(  # noqa: T201
        f"Seeded {total_products} products, {total_portions} portions "
        f"from {total_files} file(s)."
    )


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed the CountOnMe catalog from USDA FDC JSON files."
    )
    parser.add_argument(
        "--seeds-dir",
        default=str(Path(__file__).resolve().parent.parent / "seeds"),
        help="Directory containing USDA FoundationFoods *.json files (default: backend/seeds/)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and validate without writing to the database.",
    )
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = _parse_args()
    seed(args.seeds_dir, dry_run=args.dry_run)
