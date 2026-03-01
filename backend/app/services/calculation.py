from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from app.schemas.enums import Unit

_MASS_TO_G: dict[Unit, Decimal] = {
    Unit.mg: Decimal("0.001"),
    Unit.g: Decimal("1"),
    Unit.kg: Decimal("1000"),
}

_VOLUME_TO_ML: dict[Unit, Decimal] = {
    Unit.ml: Decimal("1"),
    Unit.l: Decimal("1000"),
    Unit.tsp: Decimal("5"),
    Unit.tbsp: Decimal("15"),
    Unit.cup: Decimal("240"),
}


def _is_mass(u: Unit) -> bool:
    return u in _MASS_TO_G


def _is_volume(u: Unit) -> bool:
    return u in _VOLUME_TO_ML


def convert_unit(amount: Decimal, from_unit: Unit, to_unit: Unit) -> Decimal:
    """Convert between compatible units (mass<->mass or volume<->volume)."""
    if from_unit == to_unit:
        return amount

    if _is_mass(from_unit) and _is_mass(to_unit):
        in_g = amount * _MASS_TO_G[from_unit]
        return in_g / _MASS_TO_G[to_unit]

    if _is_volume(from_unit) and _is_volume(to_unit):
        in_ml = amount * _VOLUME_TO_ML[from_unit]
        return in_ml / _VOLUME_TO_ML[to_unit]

    raise ValueError(f"Incompatible units: {from_unit} -> {to_unit}")


@dataclass(frozen=True)
class MacroTotals:
    calories: Decimal
    protein: Decimal
    carbs: Decimal
    fat: Decimal


def calc_totals_for_entry(
    *,
    entry_amount: Decimal,
    entry_unit: Unit,
    portion_base_amount: Decimal,
    portion_base_unit: Unit,
    portion_calories: Decimal,
    portion_protein: Decimal | None,
    portion_carbs: Decimal | None,
    portion_fat: Decimal | None,
) -> MacroTotals:
    consumed_in_portion_unit = convert_unit(entry_amount, entry_unit, portion_base_unit)
    factor = consumed_in_portion_unit / portion_base_amount

    protein = (portion_protein or Decimal("0")) * factor
    carbs = (portion_carbs or Decimal("0")) * factor
    fat = (portion_fat or Decimal("0")) * factor
    calories = portion_calories * factor

    return MacroTotals(
        calories=calories,
        protein=protein,
        carbs=carbs,
        fat=fat,
    )

