"""Tests for goal calculation service (BMR, TDEE, macros, BMI, weight range)."""

from datetime import date
from decimal import Decimal

import pytest

from app.schemas.enums import ActivityLevel, Gender, WeightChangePace, WeightGoalType
from app.services.goal_calculation import (
    ACTIVITY_MULTIPLIERS,
    BMI_CATEGORIES,
    DEFAULT_MACROS,
    DEFICIT_BY_PACE,
    MIN_CALORIES,
    calculate_age,
    calculate_bmi,
    calculate_bmr,
    calculate_full_goal,
    calculate_healthy_weight_range,
    calculate_macros,
    calculate_macros_for_manual,
    calculate_target_calories,
    calculate_tdee,
    calculate_water_intake,
)


class TestCalculateAge:
    """Tests for calculate_age function."""

    def test_age_calculation_birthday_passed_this_year(self):
        # Arrange
        today = date.today()
        birth_date = date(today.year - 30, 1, 1)

        # Act
        age = calculate_age(birth_date)

        # Assert
        assert age == 30

    def test_age_calculation_birthday_not_yet_this_year(self):
        # Arrange
        today = date.today()
        birth_date = date(today.year - 25, 12, 31)

        # Act
        age = calculate_age(birth_date)

        # Assert
        # If today is before Dec 31, age should be 24 (birthday hasn't happened)
        if (today.month, today.day) < (12, 31):
            assert age == 24
        else:
            assert age == 25

    def test_age_calculation_birthday_today(self):
        # Arrange
        today = date.today()
        birth_date = date(today.year - 40, today.month, today.day)

        # Act
        age = calculate_age(birth_date)

        # Assert
        assert age == 40

    def test_age_calculation_edge_case_leap_year(self):
        # Arrange
        # Born on Feb 29, 2000 (leap year)
        birth_date = date(2000, 2, 29)

        # Act
        age = calculate_age(birth_date)

        # Assert
        today = date.today()
        expected_age = today.year - 2000
        # Adjust if birthday hasn't occurred yet this year
        if (today.month, today.day) < (2, 29):
            expected_age -= 1
        assert age == expected_age

    def test_age_zero_born_this_year(self):
        # Arrange
        today = date.today()
        birth_date = date(today.year, 1, 1)

        # Act
        age = calculate_age(birth_date)

        # Assert
        assert age == 0


class TestCalculateBMR:
    """Tests for calculate_bmr function."""

    def test_bmr_male(self):
        # Arrange
        gender = Gender.male
        weight_kg = Decimal("80")
        height_cm = Decimal("180")
        birth_date = date(1990, 1, 1)

        # Act
        result = calculate_bmr(gender, weight_kg, height_cm, birth_date)

        # Assert
        # BMR = (10 * 80) + (6.25 * 180) - (5 * age) + 5
        # age ~= 36 (as of 2026)
        # BMR = 800 + 1125 - 180 + 5 = 1750
        assert result.bmr_kcal > 0
        assert result.age_years > 0
        assert isinstance(result.bmr_kcal, int)

    def test_bmr_female(self):
        # Arrange
        gender = Gender.female
        weight_kg = Decimal("65")
        height_cm = Decimal("165")
        birth_date = date(1995, 6, 15)

        # Act
        result = calculate_bmr(gender, weight_kg, height_cm, birth_date)

        # Assert
        # BMR = (10 * 65) + (6.25 * 165) - (5 * age) - 161
        # age ~= 30-31 (as of 2026)
        # BMR = 650 + 1031.25 - 155 - 161 = 1365
        assert result.bmr_kcal > 0
        assert result.age_years > 0
        assert isinstance(result.bmr_kcal, int)

    def test_bmr_male_higher_than_female_same_stats(self):
        # Arrange
        weight_kg = Decimal("70")
        height_cm = Decimal("170")
        birth_date = date(1990, 1, 1)

        # Act
        male_result = calculate_bmr(Gender.male, weight_kg, height_cm, birth_date)
        female_result = calculate_bmr(Gender.female, weight_kg, height_cm, birth_date)

        # Assert
        # Male formula adds 5, female subtracts 161 (difference of 166)
        assert male_result.bmr_kcal > female_result.bmr_kcal
        assert male_result.bmr_kcal - female_result.bmr_kcal == 166

    def test_bmr_young_person(self):
        # Arrange
        gender = Gender.male
        weight_kg = Decimal("70")
        height_cm = Decimal("175")
        birth_date = date(2006, 1, 1)  # ~20 years old

        # Act
        result = calculate_bmr(gender, weight_kg, height_cm, birth_date)

        # Assert
        assert result.bmr_kcal > 0
        assert result.age_years >= 18  # Assuming test runs after 2024

    def test_bmr_older_person(self):
        # Arrange
        gender = Gender.female
        weight_kg = Decimal("68")
        height_cm = Decimal("160")
        birth_date = date(1956, 1, 1)  # ~70 years old

        # Act
        result = calculate_bmr(gender, weight_kg, height_cm, birth_date)

        # Assert
        # Older age reduces BMR
        assert result.bmr_kcal > 0
        assert result.age_years >= 65


class TestCalculateTDEE:
    """Tests for calculate_tdee function."""

    @pytest.mark.parametrize(
        "activity_level,multiplier",
        [
            (ActivityLevel.sedentary, 1.2),
            (ActivityLevel.light, 1.375),
            (ActivityLevel.moderate, 1.55),
            (ActivityLevel.active, 1.725),
            (ActivityLevel.very_active, 1.9),
        ],
    )
    def test_tdee_calculation_for_all_activity_levels(self, activity_level, multiplier):
        # Arrange
        bmr = 1500

        # Act
        result = calculate_tdee(bmr, activity_level)

        # Assert
        expected_tdee = int(bmr * multiplier)
        assert result.tdee_kcal == expected_tdee
        assert result.multiplier == multiplier

    def test_tdee_sedentary(self):
        # Arrange
        bmr = 1600

        # Act
        result = calculate_tdee(bmr, ActivityLevel.sedentary)

        # Assert
        assert result.tdee_kcal == 1920  # 1600 * 1.2
        assert result.multiplier == 1.2

    def test_tdee_very_active(self):
        # Arrange
        bmr = 2000

        # Act
        result = calculate_tdee(bmr, ActivityLevel.very_active)

        # Assert
        assert result.tdee_kcal == 3800  # 2000 * 1.9
        assert result.multiplier == 1.9

    def test_tdee_returns_integer(self):
        # Arrange
        bmr = 1537  # Odd number that might result in decimal

        # Act
        result = calculate_tdee(bmr, ActivityLevel.moderate)

        # Assert
        assert isinstance(result.tdee_kcal, int)


class TestCalculateTargetCalories:
    """Tests for calculate_target_calories function."""

    def test_maintain_goal_returns_tdee(self):
        # Arrange
        tdee = 2000

        # Act
        result = calculate_target_calories(tdee, WeightGoalType.maintain)

        # Assert
        assert result.daily_calories_kcal == tdee
        assert result.deficit_or_surplus == 0

    def test_lose_weight_slow_pace(self):
        # Arrange
        tdee = 2000

        # Act
        result = calculate_target_calories(
            tdee, WeightGoalType.lose, WeightChangePace.slow
        )

        # Assert
        expected_deficit = DEFICIT_BY_PACE[WeightChangePace.slow]
        assert result.daily_calories_kcal == tdee - expected_deficit
        assert result.deficit_or_surplus == -expected_deficit

    def test_lose_weight_moderate_pace(self):
        # Arrange
        tdee = 2200

        # Act
        result = calculate_target_calories(
            tdee, WeightGoalType.lose, WeightChangePace.moderate
        )

        # Assert
        assert result.daily_calories_kcal == 1700  # 2200 - 500
        assert result.deficit_or_surplus == -500

    def test_lose_weight_aggressive_pace(self):
        # Arrange
        tdee = 2500

        # Act
        result = calculate_target_calories(
            tdee, WeightGoalType.lose, WeightChangePace.aggressive
        )

        # Assert
        assert result.daily_calories_kcal == 1750  # 2500 - 750
        assert result.deficit_or_surplus == -750

    def test_lose_weight_default_pace_when_none(self):
        # Arrange
        tdee = 2000

        # Act
        result = calculate_target_calories(tdee, WeightGoalType.lose, None)

        # Assert
        # Should default to moderate pace
        assert result.daily_calories_kcal == 1500  # 2000 - 500
        assert result.deficit_or_surplus == -500

    def test_lose_weight_minimum_calories_enforced(self):
        # Arrange
        tdee = 1500  # Low TDEE

        # Act
        result = calculate_target_calories(
            tdee, WeightGoalType.lose, WeightChangePace.aggressive
        )

        # Assert
        # Should not go below MIN_CALORIES (1200)
        assert result.daily_calories_kcal == MIN_CALORIES
        assert result.deficit_or_surplus == -750

    def test_gain_weight_slow_pace(self):
        # Arrange
        tdee = 2000

        # Act
        result = calculate_target_calories(
            tdee, WeightGoalType.gain, WeightChangePace.slow
        )

        # Assert
        expected_surplus = DEFICIT_BY_PACE[WeightChangePace.slow]
        assert result.daily_calories_kcal == tdee + expected_surplus
        assert result.deficit_or_surplus == expected_surplus

    def test_gain_weight_moderate_pace(self):
        # Arrange
        tdee = 2200

        # Act
        result = calculate_target_calories(
            tdee, WeightGoalType.gain, WeightChangePace.moderate
        )

        # Assert
        assert result.daily_calories_kcal == 2700  # 2200 + 500
        assert result.deficit_or_surplus == 500

    def test_gain_weight_aggressive_pace(self):
        # Arrange
        tdee = 2500

        # Act
        result = calculate_target_calories(
            tdee, WeightGoalType.gain, WeightChangePace.aggressive
        )

        # Assert
        assert result.daily_calories_kcal == 3250  # 2500 + 750
        assert result.deficit_or_surplus == 750

    def test_gain_weight_default_pace_when_none(self):
        # Arrange
        tdee = 2000

        # Act
        result = calculate_target_calories(tdee, WeightGoalType.gain, None)

        # Assert
        # Should default to moderate pace
        assert result.daily_calories_kcal == 2500  # 2000 + 500
        assert result.deficit_or_surplus == 500


class TestCalculateMacros:
    """Tests for calculate_macros function."""

    def test_macros_with_default_percentages_lose(self):
        # Arrange
        calories = 2000

        # Act
        result = calculate_macros(calories, WeightGoalType.lose)

        # Assert
        defaults = DEFAULT_MACROS[WeightGoalType.lose]
        assert result.protein_percent == defaults["protein"]
        assert result.carbs_percent == defaults["carbs"]
        assert result.fat_percent == defaults["fat"]

        # Verify calculations (protein/carbs = 4 kcal/g, fat = 9 kcal/g)
        assert result.protein_grams == int((2000 * 30 / 100) / 4)  # 150g
        assert result.carbs_grams == int((2000 * 35 / 100) / 4)  # 175g
        assert result.fat_grams == int((2000 * 35 / 100) / 9)  # 77g

    def test_macros_with_default_percentages_maintain(self):
        # Arrange
        calories = 2000

        # Act
        result = calculate_macros(calories, WeightGoalType.maintain)

        # Assert
        defaults = DEFAULT_MACROS[WeightGoalType.maintain]
        assert result.protein_percent == defaults["protein"]
        assert result.carbs_percent == defaults["carbs"]
        assert result.fat_percent == defaults["fat"]

    def test_macros_with_default_percentages_gain(self):
        # Arrange
        calories = 2500

        # Act
        result = calculate_macros(calories, WeightGoalType.gain)

        # Assert
        defaults = DEFAULT_MACROS[WeightGoalType.gain]
        assert result.protein_percent == defaults["protein"]
        assert result.carbs_percent == defaults["carbs"]
        assert result.fat_percent == defaults["fat"]

    def test_macros_with_custom_percentages(self):
        # Arrange
        calories = 2000
        protein_percent = 40
        carbs_percent = 30
        fat_percent = 30

        # Act
        result = calculate_macros(
            calories,
            WeightGoalType.lose,
            protein_percent,
            carbs_percent,
            fat_percent,
        )

        # Assert
        assert result.protein_percent == 40
        assert result.carbs_percent == 30
        assert result.fat_percent == 30

        # Verify grams
        assert result.protein_grams == int((2000 * 40 / 100) / 4)  # 200g
        assert result.carbs_grams == int((2000 * 30 / 100) / 4)  # 150g
        assert result.fat_grams == int((2000 * 30 / 100) / 9)  # 66g

    def test_macros_with_partial_custom_percentages(self):
        # Arrange
        calories = 1800

        # Act
        result = calculate_macros(
            calories,
            WeightGoalType.maintain,
            protein_percent=35,
            carbs_percent=None,
            fat_percent=None,
        )

        # Assert
        defaults = DEFAULT_MACROS[WeightGoalType.maintain]
        assert result.protein_percent == 35
        assert result.carbs_percent == defaults["carbs"]
        assert result.fat_percent == defaults["fat"]

    def test_macros_calculation_precision(self):
        # Arrange
        calories = 2137  # Odd number

        # Act
        result = calculate_macros(calories, WeightGoalType.lose, 33, 40, 27)

        # Assert
        # All results should be integers
        assert isinstance(result.protein_grams, int)
        assert isinstance(result.carbs_grams, int)
        assert isinstance(result.fat_grams, int)

    def test_macros_zero_calories(self):
        # Arrange
        calories = 0

        # Act
        result = calculate_macros(calories, WeightGoalType.maintain)

        # Assert
        assert result.protein_grams == 0
        assert result.carbs_grams == 0
        assert result.fat_grams == 0


class TestCalculateMacrosForManual:
    """Tests for calculate_macros_for_manual function."""

    def test_manual_macros_calculation(self):
        # Arrange
        calories = 2000
        protein_percent = 30
        carbs_percent = 45
        fat_percent = 25

        # Act
        result = calculate_macros_for_manual(
            calories, protein_percent, carbs_percent, fat_percent
        )

        # Assert
        assert result.protein_percent == 30
        assert result.carbs_percent == 45
        assert result.fat_percent == 25

        assert result.protein_grams == int((2000 * 30 / 100) / 4)  # 150g
        assert result.carbs_grams == int((2000 * 45 / 100) / 4)  # 225g
        assert result.fat_grams == int((2000 * 25 / 100) / 9)  # 55g

    def test_manual_macros_with_odd_values(self):
        # Arrange
        calories = 1879
        protein_percent = 33
        carbs_percent = 37
        fat_percent = 30

        # Act
        result = calculate_macros_for_manual(
            calories, protein_percent, carbs_percent, fat_percent
        )

        # Assert
        assert isinstance(result.protein_grams, int)
        assert isinstance(result.carbs_grams, int)
        assert isinstance(result.fat_grams, int)


class TestCalculateWaterIntake:
    """Tests for calculate_water_intake function."""

    def test_water_intake_for_70kg(self):
        # Arrange
        weight_kg = Decimal("70")

        # Act
        result = calculate_water_intake(weight_kg)

        # Assert
        # 70 * 33 = 2310 ml
        assert result == 2310

    def test_water_intake_for_50kg(self):
        # Arrange
        weight_kg = Decimal("50")

        # Act
        result = calculate_water_intake(weight_kg)

        # Assert
        assert result == 1650  # 50 * 33

    def test_water_intake_for_100kg(self):
        # Arrange
        weight_kg = Decimal("100")

        # Act
        result = calculate_water_intake(weight_kg)

        # Assert
        assert result == 3300  # 100 * 33

    def test_water_intake_returns_integer(self):
        # Arrange
        weight_kg = Decimal("65.7")

        # Act
        result = calculate_water_intake(weight_kg)

        # Assert
        assert isinstance(result, int)


class TestCalculateHealthyWeightRange:
    """Tests for calculate_healthy_weight_range function."""

    def test_healthy_weight_range_for_180cm(self):
        # Arrange
        height_cm = Decimal("180")

        # Act
        min_kg, max_kg = calculate_healthy_weight_range(height_cm)

        # Assert
        # BMI 18.5-24.9 for 1.8m
        # min = 18.5 * (1.8^2) = 18.5 * 3.24 = 59.94 -> 59.9
        # max = 24.9 * (1.8^2) = 24.9 * 3.24 = 80.676 -> 80.7
        assert min_kg == pytest.approx(59.9, abs=0.1)
        assert max_kg == pytest.approx(80.7, abs=0.1)

    def test_healthy_weight_range_for_165cm(self):
        # Arrange
        height_cm = Decimal("165")

        # Act
        min_kg, max_kg = calculate_healthy_weight_range(height_cm)

        # Assert
        # BMI 18.5-24.9 for 1.65m
        # min = 18.5 * (1.65^2) = 18.5 * 2.7225 = 50.36625 -> 50.4
        # max = 24.9 * (1.65^2) = 24.9 * 2.7225 = 67.79025 -> 67.8
        assert min_kg == pytest.approx(50.4, abs=0.1)
        assert max_kg == pytest.approx(67.8, abs=0.1)

    def test_healthy_weight_range_returns_floats(self):
        # Arrange
        height_cm = Decimal("170")

        # Act
        min_kg, max_kg = calculate_healthy_weight_range(height_cm)

        # Assert
        assert isinstance(min_kg, float)
        assert isinstance(max_kg, float)

    def test_healthy_weight_range_min_less_than_max(self):
        # Arrange
        height_cm = Decimal("175")

        # Act
        min_kg, max_kg = calculate_healthy_weight_range(height_cm)

        # Assert
        assert min_kg < max_kg


class TestCalculateBMI:
    """Tests for calculate_bmi function."""

    def test_bmi_normal_weight(self):
        # Arrange
        weight_kg = Decimal("70")
        height_cm = Decimal("175")

        # Act
        bmi, category = calculate_bmi(weight_kg, height_cm)

        # Assert
        # BMI = 70 / (1.75^2) = 70 / 3.0625 = 22.857 -> 22.9
        assert bmi == pytest.approx(22.9, abs=0.1)
        assert category == "normal"

    def test_bmi_underweight(self):
        # Arrange
        weight_kg = Decimal("50")
        height_cm = Decimal("175")

        # Act
        bmi, category = calculate_bmi(weight_kg, height_cm)

        # Assert
        # BMI = 50 / (1.75^2) = 16.3
        assert bmi < 18.5
        assert category == "underweight"

    def test_bmi_overweight(self):
        # Arrange
        weight_kg = Decimal("85")
        height_cm = Decimal("170")

        # Act
        bmi, category = calculate_bmi(weight_kg, height_cm)

        # Assert
        # BMI = 85 / (1.7^2) = 29.4
        assert 25 <= bmi < 30
        assert category == "overweight"

    def test_bmi_obese(self):
        # Arrange
        weight_kg = Decimal("100")
        height_cm = Decimal("165")

        # Act
        bmi, category = calculate_bmi(weight_kg, height_cm)

        # Assert
        # BMI = 100 / (1.65^2) = 36.7
        assert bmi >= 30
        assert category == "obese"

    def test_bmi_edge_case_boundary_normal_overweight(self):
        # Arrange
        height_cm = Decimal("180")
        # Calculate weight for BMI exactly 25.0
        weight_kg = Decimal("81")  # 81 / (1.8^2) = 25.0

        # Act
        bmi, category = calculate_bmi(weight_kg, height_cm)

        # Assert
        assert bmi == pytest.approx(25.0, abs=0.1)
        assert category == "overweight"

    def test_bmi_rounded_to_one_decimal(self):
        # Arrange
        weight_kg = Decimal("73.456")
        height_cm = Decimal("178.9")

        # Act
        bmi, _category = calculate_bmi(weight_kg, height_cm)

        # Assert
        # Should be rounded to 1 decimal place
        assert isinstance(bmi, float)
        assert bmi == round(bmi, 1)


class TestCalculateFullGoal:
    """Tests for calculate_full_goal function."""

    def test_full_goal_calculation_lose_weight(self):
        # Arrange
        gender = Gender.male
        birth_date = date(1990, 1, 1)
        height_cm = Decimal("180")
        current_weight_kg = Decimal("85")
        activity_level = ActivityLevel.moderate
        weight_goal_type = WeightGoalType.lose
        weight_change_pace = WeightChangePace.moderate

        # Act
        result = calculate_full_goal(
            gender=gender,
            birth_date=birth_date,
            height_cm=height_cm,
            current_weight_kg=current_weight_kg,
            activity_level=activity_level,
            weight_goal_type=weight_goal_type,
            weight_change_pace=weight_change_pace,
        )

        # Assert
        assert result.bmr_kcal > 0
        assert result.tdee_kcal > result.bmr_kcal
        assert result.daily_calories_kcal < result.tdee_kcal  # Deficit for weight loss
        assert result.protein_percent + result.carbs_percent + result.fat_percent <= 100
        assert result.protein_grams > 0
        assert result.carbs_grams > 0
        assert result.fat_grams > 0
        assert result.water_ml > 0
        assert result.healthy_weight_min_kg < result.healthy_weight_max_kg
        assert result.current_bmi > 0
        assert result.bmi_category in ["underweight", "normal", "overweight", "obese"]

    def test_full_goal_calculation_maintain_weight(self):
        # Arrange
        gender = Gender.female
        birth_date = date(1995, 6, 15)
        height_cm = Decimal("165")
        current_weight_kg = Decimal("60")
        activity_level = ActivityLevel.light
        weight_goal_type = WeightGoalType.maintain

        # Act
        result = calculate_full_goal(
            gender=gender,
            birth_date=birth_date,
            height_cm=height_cm,
            current_weight_kg=current_weight_kg,
            activity_level=activity_level,
            weight_goal_type=weight_goal_type,
        )

        # Assert
        assert result.daily_calories_kcal == result.tdee_kcal  # No deficit/surplus

    def test_full_goal_calculation_gain_weight(self):
        # Arrange
        gender = Gender.male
        birth_date = date(2000, 1, 1)
        height_cm = Decimal("175")
        current_weight_kg = Decimal("65")
        activity_level = ActivityLevel.active
        weight_goal_type = WeightGoalType.gain
        weight_change_pace = WeightChangePace.slow

        # Act
        result = calculate_full_goal(
            gender=gender,
            birth_date=birth_date,
            height_cm=height_cm,
            current_weight_kg=current_weight_kg,
            activity_level=activity_level,
            weight_goal_type=weight_goal_type,
            weight_change_pace=weight_change_pace,
        )

        # Assert
        assert result.daily_calories_kcal > result.tdee_kcal  # Surplus for weight gain

    def test_full_goal_with_custom_macros(self):
        # Arrange
        gender = Gender.male
        birth_date = date(1990, 1, 1)
        height_cm = Decimal("180")
        current_weight_kg = Decimal("80")
        activity_level = ActivityLevel.moderate
        weight_goal_type = WeightGoalType.lose
        protein_percent = 40
        carbs_percent = 35
        fat_percent = 25

        # Act
        result = calculate_full_goal(
            gender=gender,
            birth_date=birth_date,
            height_cm=height_cm,
            current_weight_kg=current_weight_kg,
            activity_level=activity_level,
            weight_goal_type=weight_goal_type,
            protein_percent=protein_percent,
            carbs_percent=carbs_percent,
            fat_percent=fat_percent,
        )

        # Assert
        assert result.protein_percent == 40
        assert result.carbs_percent == 35
        assert result.fat_percent == 25

    def test_full_goal_with_custom_water(self):
        # Arrange
        gender = Gender.female
        birth_date = date(1990, 1, 1)
        height_cm = Decimal("165")
        current_weight_kg = Decimal("60")
        activity_level = ActivityLevel.moderate
        weight_goal_type = WeightGoalType.maintain
        custom_water = 3000

        # Act
        result = calculate_full_goal(
            gender=gender,
            birth_date=birth_date,
            height_cm=height_cm,
            current_weight_kg=current_weight_kg,
            activity_level=activity_level,
            weight_goal_type=weight_goal_type,
            water_ml=custom_water,
        )

        # Assert
        assert result.water_ml == custom_water

    def test_full_goal_default_water_when_none(self):
        # Arrange
        gender = Gender.male
        birth_date = date(1990, 1, 1)
        height_cm = Decimal("180")
        current_weight_kg = Decimal("80")
        activity_level = ActivityLevel.moderate
        weight_goal_type = WeightGoalType.maintain

        # Act
        result = calculate_full_goal(
            gender=gender,
            birth_date=birth_date,
            height_cm=height_cm,
            current_weight_kg=current_weight_kg,
            activity_level=activity_level,
            weight_goal_type=weight_goal_type,
            water_ml=None,
        )

        # Assert
        # Should use calculated water (weight * 33)
        expected_water = int(float(current_weight_kg) * 33)
        assert result.water_ml == expected_water

    def test_full_goal_very_active_person(self):
        # Arrange
        gender = Gender.male
        birth_date = date(1985, 1, 1)
        height_cm = Decimal("185")
        current_weight_kg = Decimal("90")
        activity_level = ActivityLevel.very_active
        weight_goal_type = WeightGoalType.gain

        # Act
        result = calculate_full_goal(
            gender=gender,
            birth_date=birth_date,
            height_cm=height_cm,
            current_weight_kg=current_weight_kg,
            activity_level=activity_level,
            weight_goal_type=weight_goal_type,
            weight_change_pace=WeightChangePace.aggressive,
        )

        # Assert
        # Very active should have high TDEE
        assert result.tdee_kcal > 3000
        assert result.daily_calories_kcal > result.tdee_kcal  # Surplus for gain


class TestConstants:
    """Tests for module constants."""

    def test_activity_multipliers_cover_all_levels(self):
        # Assert
        assert len(ACTIVITY_MULTIPLIERS) == 5
        assert ActivityLevel.sedentary in ACTIVITY_MULTIPLIERS
        assert ActivityLevel.light in ACTIVITY_MULTIPLIERS
        assert ActivityLevel.moderate in ACTIVITY_MULTIPLIERS
        assert ActivityLevel.active in ACTIVITY_MULTIPLIERS
        assert ActivityLevel.very_active in ACTIVITY_MULTIPLIERS

    def test_deficit_by_pace_cover_all_paces(self):
        # Assert
        assert len(DEFICIT_BY_PACE) == 3
        assert WeightChangePace.slow in DEFICIT_BY_PACE
        assert WeightChangePace.moderate in DEFICIT_BY_PACE
        assert WeightChangePace.aggressive in DEFICIT_BY_PACE

    def test_default_macros_cover_all_goal_types(self):
        # Assert
        assert len(DEFAULT_MACROS) == 3
        assert WeightGoalType.lose in DEFAULT_MACROS
        assert WeightGoalType.maintain in DEFAULT_MACROS
        assert WeightGoalType.gain in DEFAULT_MACROS

    def test_default_macros_sum_to_100(self):
        # Assert
        for goal_type, macros in DEFAULT_MACROS.items():
            total = macros["protein"] + macros["carbs"] + macros["fat"]
            assert total == 100, f"{goal_type} macros sum to {total}, not 100"

    def test_bmi_categories_defined(self):
        # Assert
        assert "underweight" in BMI_CATEGORIES
        assert "normal" in BMI_CATEGORIES
        assert "overweight" in BMI_CATEGORIES
        assert "obese" in BMI_CATEGORIES

    def test_min_calories_defined(self):
        # Assert
        assert MIN_CALORIES == 1200
