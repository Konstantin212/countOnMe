"""Test FoodEntryCreateRequest XOR validation (ADR-010)."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.features.meals.schemas import FoodEntryCreateRequest


def test_create_request_private_path_valid():
    """product_id + portion_id (no catalog) is valid."""
    req = FoodEntryCreateRequest(
        product_id=uuid.uuid4(),
        portion_id=uuid.uuid4(),
        day=date.today(),
        meal_type="breakfast",
        amount=Decimal("100"),
        unit="g",
    )
    assert req.product_id is not None
    assert req.portion_id is not None
    assert req.catalog_portion_id is None


def test_create_request_catalog_path_valid():
    """catalog_portion_id alone (no product/portion) is valid."""
    req = FoodEntryCreateRequest(
        catalog_portion_id=uuid.uuid4(),
        day=date.today(),
        meal_type="lunch",
        amount=Decimal("50"),
        unit="g",
    )
    assert req.catalog_portion_id is not None
    assert req.product_id is None
    assert req.portion_id is None


def test_create_request_both_paths_invalid():
    """Providing both product_id+portion_id AND catalog_portion_id fails."""
    with pytest.raises(ValidationError, match="Provide either"):
        FoodEntryCreateRequest(
            product_id=uuid.uuid4(),
            portion_id=uuid.uuid4(),
            catalog_portion_id=uuid.uuid4(),
            day=date.today(),
            meal_type="breakfast",
            amount=Decimal("100"),
            unit="g",
        )


def test_create_request_neither_path_invalid():
    """Providing neither product_id+portion_id nor catalog_portion_id fails."""
    with pytest.raises(ValidationError, match="Provide either"):
        FoodEntryCreateRequest(
            day=date.today(),
            meal_type="breakfast",
            amount=Decimal("100"),
            unit="g",
        )


def test_create_request_only_product_id_invalid():
    """Providing only product_id (no portion_id, no catalog) fails."""
    with pytest.raises(ValidationError, match="Provide either"):
        FoodEntryCreateRequest(
            product_id=uuid.uuid4(),
            day=date.today(),
            meal_type="breakfast",
            amount=Decimal("100"),
            unit="g",
        )


def test_create_request_only_portion_id_invalid():
    """Providing only portion_id (no product_id, no catalog) fails."""
    with pytest.raises(ValidationError, match="Provide either"):
        FoodEntryCreateRequest(
            portion_id=uuid.uuid4(),
            day=date.today(),
            meal_type="breakfast",
            amount=Decimal("100"),
            unit="g",
        )
