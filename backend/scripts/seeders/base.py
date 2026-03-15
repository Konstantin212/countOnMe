"""Abstract base seeder and shared utility functions.

All seeders inherit from ``AbstractSeeder`` and implement ``run()``.
Shared helpers (unit normalisation, macro extraction, portion labels)
are defined here so both USDA and OFF seeders can reuse them.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

# ---------------------------------------------------------------------------
# Supported Unit mappings (mirrors app/core/enums.py Unit enum)
# ---------------------------------------------------------------------------

SUPPORTED_UNITS: frozenset[str] = frozenset({
    "mg", "g", "kg", "ml", "l", "tsp", "tbsp", "cup", "pcs", "serving",
})

_UNIT_ALIASES: dict[str, str] = {
    # Volume / weight aliases
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
    # Countable -> pcs
    "each": "pcs",
    "slice": "pcs",
    "piece": "pcs",
    "pieces": "pcs",
    "link": "pcs",
    "egg": "pcs",
    "fruit": "pcs",
    "fillet": "pcs",
    "drumstick": "pcs",
    "steak": "pcs",
    "wedge": "pcs",
    "spear": "pcs",
    "olive": "pcs",
    "cookie": "pcs",
    # Serving-like -> serving
    "serving": "serving",
    "racc": "serving",
    "container": "serving",
    "order": "serving",
    "package": "serving",
}

# ---------------------------------------------------------------------------
# USDA nutrient extraction
# ---------------------------------------------------------------------------

_TARGET_NUTRIENTS: dict[str, str] = {
    "Total lipid (fat)": "fat_g_100g",
    "Carbohydrate, by difference": "carbs_g_100g",
    "Protein": "protein_g_100g",
    "Energy": "kcal_100g",
}


def normalize_unit(abbr: str | None, name: str | None) -> str | None:
    """Return a supported unit string or ``None`` if unrecognised."""
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


def build_portion_label(portion: dict[str, Any]) -> str:
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
# Abstract base
# ---------------------------------------------------------------------------


class AbstractSeeder(ABC):
    """Base class for all catalog seeders."""

    def __init__(self, seeds_dir: str) -> None:
        self.seeds_dir = seeds_dir

    @abstractmethod
    async def run(self, conn: Any, *, dry_run: bool = False) -> tuple[int, int]:
        """Run the seeder.

        Returns:
            A ``(products_seeded, portions_seeded)`` tuple.
        """
        ...
