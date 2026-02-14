"""Tests for calculation service (unit conversions and macro calculations)."""

from decimal import Decimal

import pytest

from app.schemas.enums import Unit
from app.services.calculation import (
    MacroTotals,
    calc_totals_for_entry,
    convert_unit,
)


class TestConvertUnit:
    """Tests for convert_unit function."""

    # Same unit conversions
    def test_same_unit_returns_original_amount(self):
        # Arrange
        amount = Decimal("100")
        unit = Unit.g

        # Act
        result = convert_unit(amount, unit, unit)

        # Assert
        assert result == amount

    # Mass conversions
    def test_grams_to_milligrams(self):
        # Arrange
        amount = Decimal("5")

        # Act
        result = convert_unit(amount, Unit.g, Unit.mg)

        # Assert
        assert result == Decimal("5000")

    def test_grams_to_kilograms(self):
        # Arrange
        amount = Decimal("1500")

        # Act
        result = convert_unit(amount, Unit.g, Unit.kg)

        # Assert
        assert result == Decimal("1.5")

    def test_kilograms_to_grams(self):
        # Arrange
        amount = Decimal("2.5")

        # Act
        result = convert_unit(amount, Unit.kg, Unit.g)

        # Assert
        assert result == Decimal("2500")

    def test_milligrams_to_kilograms(self):
        # Arrange
        amount = Decimal("2500000")

        # Act
        result = convert_unit(amount, Unit.mg, Unit.kg)

        # Assert
        assert result == Decimal("2.5")

    # Volume conversions
    def test_liters_to_milliliters(self):
        # Arrange
        amount = Decimal("2")

        # Act
        result = convert_unit(amount, Unit.l, Unit.ml)

        # Assert
        assert result == Decimal("2000")

    def test_milliliters_to_liters(self):
        # Arrange
        amount = Decimal("750")

        # Act
        result = convert_unit(amount, Unit.ml, Unit.l)

        # Assert
        assert result == Decimal("0.75")

    def test_teaspoons_to_milliliters(self):
        # Arrange
        amount = Decimal("3")

        # Act
        result = convert_unit(amount, Unit.tsp, Unit.ml)

        # Assert
        assert result == Decimal("15")

    def test_tablespoons_to_milliliters(self):
        # Arrange
        amount = Decimal("2")

        # Act
        result = convert_unit(amount, Unit.tbsp, Unit.ml)

        # Assert
        assert result == Decimal("30")

    def test_cups_to_milliliters(self):
        # Arrange
        amount = Decimal("1.5")

        # Act
        result = convert_unit(amount, Unit.cup, Unit.ml)

        # Assert
        assert result == Decimal("360")

    def test_tablespoons_to_teaspoons(self):
        # Arrange
        amount = Decimal("1")

        # Act
        result = convert_unit(amount, Unit.tbsp, Unit.tsp)

        # Assert
        assert result == Decimal("3")

    def test_cups_to_tablespoons(self):
        # Arrange
        amount = Decimal("1")

        # Act
        result = convert_unit(amount, Unit.cup, Unit.tbsp)

        # Assert
        assert result == Decimal("16")

    # Edge cases
    def test_zero_amount(self):
        # Arrange
        amount = Decimal("0")

        # Act
        result = convert_unit(amount, Unit.g, Unit.kg)

        # Assert
        assert result == Decimal("0")

    def test_decimal_precision(self):
        # Arrange
        amount = Decimal("1.23456789")

        # Act
        result = convert_unit(amount, Unit.kg, Unit.g)

        # Assert
        assert result == Decimal("1234.56789")

    # Error cases
    def test_incompatible_units_mass_to_volume_raises_error(self):
        # Arrange
        amount = Decimal("100")

        # Act & Assert
        with pytest.raises(ValueError, match="Incompatible units"):
            convert_unit(amount, Unit.g, Unit.ml)

    def test_incompatible_units_volume_to_mass_raises_error(self):
        # Arrange
        amount = Decimal("100")

        # Act & Assert
        with pytest.raises(ValueError, match="Incompatible units"):
            convert_unit(amount, Unit.ml, Unit.kg)


class TestCalcTotalsForEntry:
    """Tests for calc_totals_for_entry function."""

    def test_basic_calculation_same_unit(self):
        # Arrange
        entry_amount = Decimal("150")
        entry_unit = Unit.g
        portion_base_amount = Decimal("100")
        portion_base_unit = Unit.g
        portion_calories = Decimal("200")
        portion_protein = Decimal("20")
        portion_carbs = Decimal("30")
        portion_fat = Decimal("10")

        # Act
        result = calc_totals_for_entry(
            entry_amount=entry_amount,
            entry_unit=entry_unit,
            portion_base_amount=portion_base_amount,
            portion_base_unit=portion_base_unit,
            portion_calories=portion_calories,
            portion_protein=portion_protein,
            portion_carbs=portion_carbs,
            portion_fat=portion_fat,
        )

        # Assert
        assert result.calories == Decimal("300")  # 200 * 1.5
        assert result.protein == Decimal("30")  # 20 * 1.5
        assert result.carbs == Decimal("45")  # 30 * 1.5
        assert result.fat == Decimal("15")  # 10 * 1.5

    def test_calculation_with_unit_conversion(self):
        # Arrange
        entry_amount = Decimal("1")  # 1 kg
        entry_unit = Unit.kg
        portion_base_amount = Decimal("100")  # per 100g
        portion_base_unit = Unit.g
        portion_calories = Decimal("50")
        portion_protein = Decimal("5")
        portion_carbs = Decimal("10")
        portion_fat = Decimal("2")

        # Act
        result = calc_totals_for_entry(
            entry_amount=entry_amount,
            entry_unit=entry_unit,
            portion_base_amount=portion_base_amount,
            portion_base_unit=portion_base_unit,
            portion_calories=portion_calories,
            portion_protein=portion_protein,
            portion_carbs=portion_carbs,
            portion_fat=portion_fat,
        )

        # Assert
        # 1 kg = 1000g, factor = 1000/100 = 10
        assert result.calories == Decimal("500")  # 50 * 10
        assert result.protein == Decimal("50")  # 5 * 10
        assert result.carbs == Decimal("100")  # 10 * 10
        assert result.fat == Decimal("20")  # 2 * 10

    def test_calculation_with_none_macros(self):
        # Arrange
        entry_amount = Decimal("200")
        entry_unit = Unit.g
        portion_base_amount = Decimal("100")
        portion_base_unit = Unit.g
        portion_calories = Decimal("100")
        portion_protein = None
        portion_carbs = None
        portion_fat = None

        # Act
        result = calc_totals_for_entry(
            entry_amount=entry_amount,
            entry_unit=entry_unit,
            portion_base_amount=portion_base_amount,
            portion_base_unit=portion_base_unit,
            portion_calories=portion_calories,
            portion_protein=portion_protein,
            portion_carbs=portion_carbs,
            portion_fat=portion_fat,
        )

        # Assert
        assert result.calories == Decimal("200")
        assert result.protein == Decimal("0")
        assert result.carbs == Decimal("0")
        assert result.fat == Decimal("0")

    def test_calculation_with_some_none_macros(self):
        # Arrange
        entry_amount = Decimal("100")
        entry_unit = Unit.g
        portion_base_amount = Decimal("100")
        portion_base_unit = Unit.g
        portion_calories = Decimal("100")
        portion_protein = Decimal("10")
        portion_carbs = None
        portion_fat = Decimal("5")

        # Act
        result = calc_totals_for_entry(
            entry_amount=entry_amount,
            entry_unit=entry_unit,
            portion_base_amount=portion_base_amount,
            portion_base_unit=portion_base_unit,
            portion_calories=portion_calories,
            portion_protein=portion_protein,
            portion_carbs=portion_carbs,
            portion_fat=portion_fat,
        )

        # Assert
        assert result.calories == Decimal("100")
        assert result.protein == Decimal("10")
        assert result.carbs == Decimal("0")
        assert result.fat == Decimal("5")

    def test_calculation_with_volume_units(self):
        # Arrange
        entry_amount = Decimal("2")  # 2 cups
        entry_unit = Unit.cup
        portion_base_amount = Decimal("100")  # per 100ml
        portion_base_unit = Unit.ml
        portion_calories = Decimal("50")
        portion_protein = Decimal("3")
        portion_carbs = Decimal("8")
        portion_fat = Decimal("1")

        # Act
        result = calc_totals_for_entry(
            entry_amount=entry_amount,
            entry_unit=entry_unit,
            portion_base_amount=portion_base_amount,
            portion_base_unit=portion_base_unit,
            portion_calories=portion_calories,
            portion_protein=portion_protein,
            portion_carbs=portion_carbs,
            portion_fat=portion_fat,
        )

        # Assert
        # 2 cups = 480ml, factor = 480/100 = 4.8
        assert result.calories == Decimal("240")  # 50 * 4.8
        assert result.protein == Decimal("14.4")  # 3 * 4.8
        assert result.carbs == Decimal("38.4")  # 8 * 4.8
        assert result.fat == Decimal("4.8")  # 1 * 4.8

    def test_calculation_with_fractional_entry(self):
        # Arrange
        entry_amount = Decimal("0.5")
        entry_unit = Unit.kg
        portion_base_amount = Decimal("100")
        portion_base_unit = Unit.g
        portion_calories = Decimal("100")
        portion_protein = Decimal("10")
        portion_carbs = Decimal("20")
        portion_fat = Decimal("5")

        # Act
        result = calc_totals_for_entry(
            entry_amount=entry_amount,
            entry_unit=entry_unit,
            portion_base_amount=portion_base_amount,
            portion_base_unit=portion_base_unit,
            portion_calories=portion_calories,
            portion_protein=portion_protein,
            portion_carbs=portion_carbs,
            portion_fat=portion_fat,
        )

        # Assert
        # 0.5 kg = 500g, factor = 500/100 = 5
        assert result.calories == Decimal("500")
        assert result.protein == Decimal("50")
        assert result.carbs == Decimal("100")
        assert result.fat == Decimal("25")

    def test_macro_totals_dataclass_is_frozen(self):
        # Arrange
        totals = MacroTotals(
            calories=Decimal("100"),
            protein=Decimal("10"),
            carbs=Decimal("20"),
            fat=Decimal("5"),
        )

        # Act & Assert
        with pytest.raises((AttributeError, Exception)):  # FrozenInstanceError varies by version
            totals.calories = Decimal("200")

    def test_zero_entry_amount(self):
        # Arrange
        entry_amount = Decimal("0")
        entry_unit = Unit.g
        portion_base_amount = Decimal("100")
        portion_base_unit = Unit.g
        portion_calories = Decimal("200")
        portion_protein = Decimal("20")
        portion_carbs = Decimal("30")
        portion_fat = Decimal("10")

        # Act
        result = calc_totals_for_entry(
            entry_amount=entry_amount,
            entry_unit=entry_unit,
            portion_base_amount=portion_base_amount,
            portion_base_unit=portion_base_unit,
            portion_calories=portion_calories,
            portion_protein=portion_protein,
            portion_carbs=portion_carbs,
            portion_fat=portion_fat,
        )

        # Assert
        assert result.calories == Decimal("0")
        assert result.protein == Decimal("0")
        assert result.carbs == Decimal("0")
        assert result.fat == Decimal("0")

    def test_precise_decimal_calculation(self):
        # Arrange
        entry_amount = Decimal("123.456")
        entry_unit = Unit.g
        portion_base_amount = Decimal("100")
        portion_base_unit = Unit.g
        portion_calories = Decimal("200.5")
        portion_protein = Decimal("20.25")
        portion_carbs = Decimal("30.75")
        portion_fat = Decimal("10.5")

        # Act
        result = calc_totals_for_entry(
            entry_amount=entry_amount,
            entry_unit=entry_unit,
            portion_base_amount=portion_base_amount,
            portion_base_unit=portion_base_unit,
            portion_calories=portion_calories,
            portion_protein=portion_protein,
            portion_carbs=portion_carbs,
            portion_fat=portion_fat,
        )

        # Assert
        factor = Decimal("123.456") / Decimal("100")
        assert result.calories == Decimal("200.5") * factor
        assert result.protein == Decimal("20.25") * factor
        assert result.carbs == Decimal("30.75") * factor
        assert result.fat == Decimal("10.5") * factor
