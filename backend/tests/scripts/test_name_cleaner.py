"""Tests for USDA name normalization — clean_usda_name()."""

from __future__ import annotations

import pytest

from scripts.seeders.name_cleaner import clean_usda_name


class TestCleanUsdaName:
    """Parametrized test suite for the USDA name cleaner."""

    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            pytest.param(
                "Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised",
                "Chicken breast, braised",
                id="chicken_breast_braised",
            ),
            pytest.param(
                'Beef, loin, tenderloin roast, separable lean only, boneless, trimmed to 0" fat, select, cooked, roasted',
                "Beef tenderloin roast, roasted",
                id="beef_tenderloin_roasted",
            ),
            pytest.param(
                "Nuts, almonds, dry roasted, with salt added",
                "Almonds, dry roasted, salted",
                id="almonds_dry_roasted",
            ),
            pytest.param(
                "Beans, snap, green, canned, regular pack, drained solids",
                "Green snap beans, canned",
                id="green_snap_beans",
            ),
            pytest.param(
                "Tomatoes, grape, raw",
                "Grape tomatoes",
                id="grape_tomatoes",
            ),
            pytest.param(
                "Hummus, commercial",
                "Hummus",
                id="hummus_commercial",
            ),
            pytest.param(
                "Avocado",
                "Avocado",
                id="single_word",
            ),
            pytest.param(
                "",
                "",
                id="empty_string",
            ),
        ],
    )
    def test_expected_transformations(self, raw: str, expected: str) -> None:
        assert clean_usda_name(raw) == expected

    def test_truncation_at_60_chars(self) -> None:
        """Very long name after cleaning gets truncated to <=60 chars."""
        raw = (
            "Beef, round, top round steak, separable lean only, boneless, "
            "extra extra extra extra extra extra extra extra qualifier, roasted"
        )
        result = clean_usda_name(raw)
        assert len(result) <= 60

    def test_name_with_only_noise_segments(self) -> None:
        """A name where every segment after the first is noise."""
        raw = "Pork, boneless, separable lean only, raw"
        result = clean_usda_name(raw)
        assert result == "Pork"

    def test_multiple_cooking_methods_first_wins(self) -> None:
        """When multiple cooking methods are present, the first one is used."""
        raw = "Chicken, breast, baked, then fried"
        result = clean_usda_name(raw)
        assert "baked" in result.lower()
        assert "fried" not in result.lower()

    def test_result_is_capitalized(self) -> None:
        """Result should have first letter capitalized."""
        raw = "chicken, breast, grilled"
        result = clean_usda_name(raw)
        assert result[0].isupper()

    def test_no_trailing_comma_or_space(self) -> None:
        """Result should not end with a comma or space."""
        raw = "Turkey, breast, cooked,"
        result = clean_usda_name(raw)
        assert not result.endswith(",")
        assert not result.endswith(" ")
