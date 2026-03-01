"""Goal calculation service - BMR, TDEE, macros, and weight range calculations."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.schemas.enums import (
    ActivityLevel,
    Gender,
    WeightChangePace,
    WeightGoalType,
)

# Activity level multipliers for TDEE calculation
ACTIVITY_MULTIPLIERS: dict[ActivityLevel, float] = {
    ActivityLevel.sedentary: 1.2,  # Little or no exercise
    ActivityLevel.light: 1.375,  # Light exercise 1-3 days/week
    ActivityLevel.moderate: 1.55,  # Moderate exercise 3-5 days/week
    ActivityLevel.active: 1.725,  # Hard exercise 6-7 days/week
    ActivityLevel.very_active: 1.9,  # Very intense exercise + physical job
}

# Calorie deficit/surplus by weight change pace
DEFICIT_BY_PACE: dict[WeightChangePace, int] = {
    WeightChangePace.slow: 250,  # ~0.25 kg/week
    WeightChangePace.moderate: 500,  # ~0.5 kg/week
    WeightChangePace.aggressive: 750,  # ~0.75 kg/week
}

# Default macro distributions by goal type
DEFAULT_MACROS: dict[WeightGoalType, dict[str, int]] = {
    WeightGoalType.lose: {"protein": 30, "carbs": 35, "fat": 35},
    WeightGoalType.maintain: {"protein": 25, "carbs": 45, "fat": 30},
    WeightGoalType.gain: {"protein": 30, "carbs": 45, "fat": 25},
}

# BMI categories
BMI_CATEGORIES = {
    "underweight": (0, 18.5),
    "normal": (18.5, 25.0),
    "overweight": (25.0, 30.0),
    "obese": (30.0, float("inf")),
}

# Minimum safe calorie intake
MIN_CALORIES = 1200


@dataclass
class BMRResult:
    """Result of BMR calculation."""

    bmr_kcal: int
    age_years: int


@dataclass
class TDEEResult:
    """Result of TDEE calculation."""

    tdee_kcal: int
    multiplier: float


@dataclass
class TargetCaloriesResult:
    """Result of target calories calculation."""

    daily_calories_kcal: int
    deficit_or_surplus: int


@dataclass
class MacrosResult:
    """Result of macro calculation."""

    protein_percent: int
    carbs_percent: int
    fat_percent: int
    protein_grams: int
    carbs_grams: int
    fat_grams: int


@dataclass
class WeightRangeResult:
    """Result of healthy weight range calculation."""

    min_kg: float
    max_kg: float
    current_bmi: float
    bmi_category: str


@dataclass
class FullCalculationResult:
    """Complete calculation result."""

    bmr_kcal: int
    tdee_kcal: int
    daily_calories_kcal: int
    protein_percent: int
    carbs_percent: int
    fat_percent: int
    protein_grams: int
    carbs_grams: int
    fat_grams: int
    water_ml: int
    healthy_weight_min_kg: float
    healthy_weight_max_kg: float
    current_bmi: float
    bmi_category: str


def calculate_age(birth_date: date) -> int:
    """Calculate age in years from birth date."""
    today = date.today()
    age = today.year - birth_date.year
    # Adjust if birthday hasn't occurred yet this year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


def calculate_bmr(
    gender: Gender,
    weight_kg: Decimal,
    height_cm: Decimal,
    birth_date: date,
) -> BMRResult:
    """
    Calculate Basal Metabolic Rate using Mifflin-St Jeor equation.

    This is considered the most accurate formula for general population.

    Formula:
    - Male: BMR = (10 × weight in kg) + (6.25 × height in cm) − (5 × age) + 5
    - Female: BMR = (10 × weight in kg) + (6.25 × height in cm) − (5 × age) − 161
    """
    age = calculate_age(birth_date)
    weight = float(weight_kg)
    height = float(height_cm)

    base = (10 * weight) + (6.25 * height) - (5 * age)

    if gender == Gender.male:
        bmr = int(base + 5)
    else:
        bmr = int(base - 161)

    return BMRResult(bmr_kcal=bmr, age_years=age)


def calculate_tdee(bmr: int, activity_level: ActivityLevel) -> TDEEResult:
    """
    Calculate Total Daily Energy Expenditure.

    TDEE = BMR × Activity Multiplier
    """
    multiplier = ACTIVITY_MULTIPLIERS[activity_level]
    tdee = int(bmr * multiplier)

    return TDEEResult(tdee_kcal=tdee, multiplier=multiplier)


def calculate_target_calories(
    tdee: int,
    weight_goal_type: WeightGoalType,
    weight_change_pace: WeightChangePace | None = None,
) -> TargetCaloriesResult:
    """
    Calculate daily calorie target based on goal.

    - Lose: TDEE - deficit (based on pace)
    - Maintain: TDEE
    - Gain: TDEE + surplus (based on pace)
    """
    if weight_goal_type == WeightGoalType.maintain:
        return TargetCaloriesResult(daily_calories_kcal=tdee, deficit_or_surplus=0)

    if weight_change_pace is None:
        weight_change_pace = WeightChangePace.moderate

    adjustment = DEFICIT_BY_PACE[weight_change_pace]

    if weight_goal_type == WeightGoalType.lose:
        calories = max(MIN_CALORIES, tdee - adjustment)
        return TargetCaloriesResult(
            daily_calories_kcal=calories,
            deficit_or_surplus=-adjustment,
        )
    else:  # gain
        return TargetCaloriesResult(
            daily_calories_kcal=tdee + adjustment,
            deficit_or_surplus=adjustment,
        )


def calculate_macros(
    calories: int,
    weight_goal_type: WeightGoalType,
    protein_percent: int | None = None,
    carbs_percent: int | None = None,
    fat_percent: int | None = None,
) -> MacrosResult:
    """
    Calculate macro grams from calories and percentages.

    Calorie values:
    - Protein: 4 kcal/gram
    - Carbs: 4 kcal/gram
    - Fat: 9 kcal/gram

    If percentages not provided, uses defaults based on goal type.
    """
    defaults = DEFAULT_MACROS[weight_goal_type]

    protein_pct = protein_percent if protein_percent is not None else defaults["protein"]
    carbs_pct = carbs_percent if carbs_percent is not None else defaults["carbs"]
    fat_pct = fat_percent if fat_percent is not None else defaults["fat"]

    protein_kcal = calories * protein_pct / 100
    carbs_kcal = calories * carbs_pct / 100
    fat_kcal = calories * fat_pct / 100

    return MacrosResult(
        protein_percent=protein_pct,
        carbs_percent=carbs_pct,
        fat_percent=fat_pct,
        protein_grams=int(protein_kcal / 4),
        carbs_grams=int(carbs_kcal / 4),
        fat_grams=int(fat_kcal / 9),
    )


def calculate_water_intake(weight_kg: Decimal) -> int:
    """
    Calculate recommended daily water intake.

    General guideline: 30-35 ml per kg of body weight.
    Using 33 ml/kg as middle ground.
    """
    return int(float(weight_kg) * 33)


def calculate_healthy_weight_range(height_cm: Decimal) -> tuple[float, float]:
    """
    Calculate healthy weight range based on BMI 18.5-24.9.

    BMI = weight (kg) / height (m)²
    Therefore: weight = BMI × height (m)²
    """
    height_m = float(height_cm) / 100
    height_m_sq = height_m**2

    min_kg = round(18.5 * height_m_sq, 1)
    max_kg = round(24.9 * height_m_sq, 1)

    return min_kg, max_kg


def calculate_bmi(weight_kg: Decimal, height_cm: Decimal) -> tuple[float, str]:
    """
    Calculate BMI and category.

    BMI Categories (WHO):
    - Underweight: < 18.5
    - Normal: 18.5 - 24.9
    - Overweight: 25 - 29.9
    - Obese: >= 30
    """
    height_m = float(height_cm) / 100
    bmi = float(weight_kg) / (height_m**2)
    bmi = round(bmi, 1)

    category = "normal"
    for cat, (low, high) in BMI_CATEGORIES.items():
        if low <= bmi < high:
            category = cat
            break

    return bmi, category


def calculate_full_goal(
    gender: Gender,
    birth_date: date,
    height_cm: Decimal,
    current_weight_kg: Decimal,
    activity_level: ActivityLevel,
    weight_goal_type: WeightGoalType,
    weight_change_pace: WeightChangePace | None = None,
    protein_percent: int | None = None,
    carbs_percent: int | None = None,
    fat_percent: int | None = None,
    water_ml: int | None = None,
) -> FullCalculationResult:
    """
    Perform full goal calculation.

    This combines all individual calculations into a single result.
    """
    # BMR
    bmr_result = calculate_bmr(gender, current_weight_kg, height_cm, birth_date)

    # TDEE
    tdee_result = calculate_tdee(bmr_result.bmr_kcal, activity_level)

    # Target calories
    calories_result = calculate_target_calories(
        tdee_result.tdee_kcal, weight_goal_type, weight_change_pace
    )

    # Macros
    macros_result = calculate_macros(
        calories_result.daily_calories_kcal,
        weight_goal_type,
        protein_percent,
        carbs_percent,
        fat_percent,
    )

    # Water
    calculated_water = calculate_water_intake(current_weight_kg)
    final_water = water_ml if water_ml is not None else calculated_water

    # Weight range
    min_weight, max_weight = calculate_healthy_weight_range(height_cm)
    bmi, bmi_category = calculate_bmi(current_weight_kg, height_cm)

    return FullCalculationResult(
        bmr_kcal=bmr_result.bmr_kcal,
        tdee_kcal=tdee_result.tdee_kcal,
        daily_calories_kcal=calories_result.daily_calories_kcal,
        protein_percent=macros_result.protein_percent,
        carbs_percent=macros_result.carbs_percent,
        fat_percent=macros_result.fat_percent,
        protein_grams=macros_result.protein_grams,
        carbs_grams=macros_result.carbs_grams,
        fat_grams=macros_result.fat_grams,
        water_ml=final_water,
        healthy_weight_min_kg=min_weight,
        healthy_weight_max_kg=max_weight,
        current_bmi=bmi,
        bmi_category=bmi_category,
    )


def calculate_macros_for_manual(
    daily_calories_kcal: int,
    protein_percent: int,
    carbs_percent: int,
    fat_percent: int,
) -> MacrosResult:
    """
    Calculate macro grams for manual goal.

    Same as calculate_macros but without defaults.
    """
    protein_kcal = daily_calories_kcal * protein_percent / 100
    carbs_kcal = daily_calories_kcal * carbs_percent / 100
    fat_kcal = daily_calories_kcal * fat_percent / 100

    return MacrosResult(
        protein_percent=protein_percent,
        carbs_percent=carbs_percent,
        fat_percent=fat_percent,
        protein_grams=int(protein_kcal / 4),
        carbs_grams=int(carbs_kcal / 4),
        fat_grams=int(fat_kcal / 9),
    )
