from __future__ import annotations

from enum import StrEnum


class Unit(StrEnum):
    mg = "mg"
    g = "g"
    kg = "kg"
    ml = "ml"
    l = "l"
    tsp = "tsp"
    tbsp = "tbsp"
    cup = "cup"


class MealType(StrEnum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"
    snacks = "snacks"
    water = "water"

