"""Tests for the USDA SR Legacy seeder — quality gates and unit normalization."""

from __future__ import annotations

import pytest

from scripts.seeders.base import normalize_unit
from scripts.seeders.usda import UsdaSeeder


class TestNormalizeUnit:
    """Verify normalize_unit handles the extended alias mappings."""

    def test_maps_each_to_pcs(self) -> None:
        assert normalize_unit("each", None) == "pcs"

    def test_maps_serving_to_serving(self) -> None:
        assert normalize_unit("serving", None) == "serving"

    def test_maps_slice_to_pcs(self) -> None:
        assert normalize_unit("slice", None) == "pcs"

    def test_maps_racc_to_serving(self) -> None:
        assert normalize_unit("RACC", None) == "serving"

    def test_returns_none_for_unknown(self) -> None:
        assert normalize_unit("bushel", None) is None

    def test_maps_g_to_g(self) -> None:
        assert normalize_unit("g", None) == "g"

    def test_maps_cup_to_cup(self) -> None:
        assert normalize_unit("cup", None) == "cup"

    def test_maps_name_fallback(self) -> None:
        """When abbreviation is None, falls back to name."""
        assert normalize_unit(None, "teaspoon") == "tsp"

    def test_maps_piece_to_pcs(self) -> None:
        assert normalize_unit("piece", None) == "pcs"

    def test_maps_container_to_serving(self) -> None:
        assert normalize_unit("container", None) == "serving"

    def test_maps_package_to_serving(self) -> None:
        assert normalize_unit("package", None) == "serving"


class TestUsdaSeederQualityGates:
    """Test quality gate methods in isolation (no DB)."""

    @pytest.fixture
    def seeder(self) -> UsdaSeeder:
        return UsdaSeeder(seeds_dir="/tmp/nonexistent")

    def test_is_valid_food_rejects_missing_fdc_id(self, seeder: UsdaSeeder) -> None:
        food = {"description": "Test food"}
        assert seeder._is_valid_food(food) is False

    def test_is_valid_food_rejects_zero_fdc_id(self, seeder: UsdaSeeder) -> None:
        food = {"fdcId": 0, "description": "Test food"}
        assert seeder._is_valid_food(food) is False

    def test_is_valid_food_rejects_empty_description(self, seeder: UsdaSeeder) -> None:
        food = {"fdcId": 12345, "description": ""}
        assert seeder._is_valid_food(food) is False

    def test_is_valid_food_rejects_no_description(self, seeder: UsdaSeeder) -> None:
        food = {"fdcId": 12345}
        assert seeder._is_valid_food(food) is False

    def test_is_valid_food_accepts_good_food(self, seeder: UsdaSeeder) -> None:
        food = {"fdcId": 12345, "description": "Chicken breast"}
        assert seeder._is_valid_food(food) is True

    def test_is_not_excluded_category_rejects_supplements(self, seeder: UsdaSeeder) -> None:
        food = {"foodCategory": {"description": "Supplements"}}
        assert seeder._is_not_excluded_category(food) is False

    def test_is_not_excluded_category_rejects_baby_foods(self, seeder: UsdaSeeder) -> None:
        food = {"foodCategory": {"description": "Baby Foods"}}
        assert seeder._is_not_excluded_category(food) is False

    def test_is_not_excluded_category_accepts_dairy(self, seeder: UsdaSeeder) -> None:
        food = {"foodCategory": {"description": "Dairy and Egg Products"}}
        assert seeder._is_not_excluded_category(food) is True

    def test_is_not_excluded_category_accepts_missing_category(self, seeder: UsdaSeeder) -> None:
        food: dict = {}
        assert seeder._is_not_excluded_category(food) is True

    def test_has_calories_rejects_zero(self, seeder: UsdaSeeder) -> None:
        assert seeder._has_calories(0.0) is False

    def test_has_calories_rejects_negative(self, seeder: UsdaSeeder) -> None:
        assert seeder._has_calories(-5.0) is False

    def test_has_calories_accepts_positive(self, seeder: UsdaSeeder) -> None:
        assert seeder._has_calories(150.0) is True
