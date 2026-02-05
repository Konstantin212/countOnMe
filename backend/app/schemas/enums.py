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


class GoalType(StrEnum):
    """Type of goal - calculated from body metrics or manually entered."""

    calculated = "calculated"
    manual = "manual"


class Gender(StrEnum):
    """Biological gender for BMR calculation."""

    male = "male"
    female = "female"


class ActivityLevel(StrEnum):
    """Activity level for TDEE calculation."""

    sedentary = "sedentary"  # Little or no exercise (multiplier: 1.2)
    light = "light"  # Light exercise 1-3 days/week (multiplier: 1.375)
    moderate = "moderate"  # Moderate exercise 3-5 days/week (multiplier: 1.55)
    active = "active"  # Hard exercise 6-7 days/week (multiplier: 1.725)
    very_active = "very_active"  # Very intense exercise + physical job (multiplier: 1.9)


class WeightGoalType(StrEnum):
    """Weight goal direction."""

    lose = "lose"
    maintain = "maintain"
    gain = "gain"


class WeightChangePace(StrEnum):
    """Pace of weight change."""

    slow = "slow"  # ~0.25 kg/week (-250 kcal/day)
    moderate = "moderate"  # ~0.5 kg/week (-500 kcal/day)
    aggressive = "aggressive"  # ~0.75 kg/week (-750 kcal/day)

