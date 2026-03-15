"""Tests for the Open Food Facts seeder — serving size parsing."""

from __future__ import annotations

import pytest

from scripts.seeders.off import OffSeeder, parse_serving_size


class TestParseServingSize:
    """Verify parse_serving_size extracts gram weight from common patterns."""

    def test_simple_grams(self) -> None:
        label, weight = parse_serving_size("30g")
        assert label == "30g"
        assert weight == pytest.approx(30.0)

    def test_with_parens(self) -> None:
        label, weight = parse_serving_size("1 bar (40g)")
        assert label == "1 bar (40g)"
        assert weight == pytest.approx(40.0)

    def test_ml(self) -> None:
        label, weight = parse_serving_size("250ml")
        assert label == "250ml"
        assert weight == pytest.approx(250.0)

    def test_unparseable(self) -> None:
        label, weight = parse_serving_size("a handful")
        assert label == "a handful"
        assert weight is None

    def test_with_spaces(self) -> None:
        label, weight = parse_serving_size("30 g")
        assert label == "30 g"
        assert weight == pytest.approx(30.0)

    def test_empty_string(self) -> None:
        label, weight = parse_serving_size("")
        assert label == ""
        assert weight is None

    def test_decimal_grams(self) -> None:
        label, weight = parse_serving_size("28.3g")
        assert label == "28.3g"
        assert weight == pytest.approx(28.3)

    def test_ml_with_space(self) -> None:
        label, weight = parse_serving_size("250 ml")
        assert label == "250 ml"
        assert weight == pytest.approx(250.0)

    def test_parens_with_decimal(self) -> None:
        label, weight = parse_serving_size("2 cookies (30.5g)")
        assert label == "2 cookies (30.5g)"
        assert weight == pytest.approx(30.5)


class TestOffSeederInit:
    """Verify OFF seeder can be instantiated."""

    def test_creates_with_seeds_dir(self) -> None:
        seeder = OffSeeder(seeds_dir="/tmp/nonexistent")
        assert seeder.seeds_dir == "/tmp/nonexistent"
