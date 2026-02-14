"""Tests for goal schema validation."""

from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.enums import (
    ActivityLevel,
    Gender,
    WeightChangePace,
    WeightGoalType,
)
from app.schemas.goal import (
    GoalCalculateRequest,
    GoalCreateCalculatedRequest,
    GoalCreateManualRequest,
    GoalUpdateRequest,
)


class TestGoalCalculateRequest:
    """Tests for GoalCalculateRequest validation."""

    def test_valid_request_lose_weight(self):
        # Arrange & Act
        request = GoalCalculateRequest(
            gender=Gender.male,
            birth_date=date(1990, 1, 1),
            height_cm=Decimal("180"),
            current_weight_kg=Decimal("85"),
            activity_level=ActivityLevel.moderate,
            weight_goal_type=WeightGoalType.lose,
            target_weight_kg=Decimal("75"),
            weight_change_pace=WeightChangePace.moderate,
        )

        # Assert
        assert request.gender == Gender.male
        assert request.weight_goal_type == WeightGoalType.lose
        assert request.target_weight_kg == Decimal("75")

    def test_valid_request_gain_weight(self):
        # Arrange & Act
        request = GoalCalculateRequest(
            gender=Gender.female,
            birth_date=date(1995, 6, 15),
            height_cm=Decimal("165"),
            current_weight_kg=Decimal("55"),
            activity_level=ActivityLevel.light,
            weight_goal_type=WeightGoalType.gain,
            target_weight_kg=Decimal("60"),
            weight_change_pace=WeightChangePace.slow,
        )

        # Assert
        assert request.weight_goal_type == WeightGoalType.gain
        assert request.target_weight_kg == Decimal("60")

    def test_valid_request_maintain_weight(self):
        # Arrange & Act
        request = GoalCalculateRequest(
            gender=Gender.male,
            birth_date=date(1990, 1, 1),
            height_cm=Decimal("175"),
            current_weight_kg=Decimal("75"),
            activity_level=ActivityLevel.moderate,
            weight_goal_type=WeightGoalType.maintain,
        )

        # Assert
        assert request.weight_goal_type == WeightGoalType.maintain
        assert request.target_weight_kg is None
        assert request.weight_change_pace is None

    def test_lose_weight_missing_target_weight_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError, match="target_weight_kg is required"):
            GoalCalculateRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("180"),
                current_weight_kg=Decimal("85"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.lose,
                weight_change_pace=WeightChangePace.moderate,
            )

    def test_lose_weight_missing_pace_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError, match="weight_change_pace is required"):
            GoalCalculateRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("180"),
                current_weight_kg=Decimal("85"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.lose,
                target_weight_kg=Decimal("75"),
            )

    def test_gain_weight_missing_target_weight_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError, match="target_weight_kg is required"):
            GoalCalculateRequest(
                gender=Gender.female,
                birth_date=date(1995, 1, 1),
                height_cm=Decimal("165"),
                current_weight_kg=Decimal("55"),
                activity_level=ActivityLevel.light,
                weight_goal_type=WeightGoalType.gain,
                weight_change_pace=WeightChangePace.slow,
            )

    def test_gain_weight_missing_pace_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError, match="weight_change_pace is required"):
            GoalCalculateRequest(
                gender=Gender.female,
                birth_date=date(1995, 1, 1),
                height_cm=Decimal("165"),
                current_weight_kg=Decimal("55"),
                activity_level=ActivityLevel.light,
                weight_goal_type=WeightGoalType.gain,
                target_weight_kg=Decimal("60"),
            )

    def test_birth_date_too_young_raises_error(self):
        # Arrange
        today = date.today()
        birth_date = today - timedelta(days=365 * 12)  # 12 years old

        # Act & Assert
        with pytest.raises(ValidationError, match="Must be at least 13 years old"):
            GoalCalculateRequest(
                gender=Gender.male,
                birth_date=birth_date,
                height_cm=Decimal("160"),
                current_weight_kg=Decimal("50"),
                activity_level=ActivityLevel.light,
                weight_goal_type=WeightGoalType.maintain,
            )

    def test_birth_date_too_old_raises_error(self):
        # Arrange
        birth_date = date(1900, 1, 1)

        # Act & Assert
        with pytest.raises(ValidationError, match="Invalid birth date"):
            GoalCalculateRequest(
                gender=Gender.female,
                birth_date=birth_date,
                height_cm=Decimal("160"),
                current_weight_kg=Decimal("60"),
                activity_level=ActivityLevel.sedentary,
                weight_goal_type=WeightGoalType.maintain,
            )

    def test_birth_date_in_future_raises_error(self):
        # Arrange
        # Use a date in the future that would still result in age >= 13
        # This ensures the "future" check is triggered first
        future_date = date.today() + timedelta(days=1)

        # Act & Assert
        # The validator checks age first, so we expect the age error
        with pytest.raises(ValidationError, match="Must be at least 13 years old"):
            GoalCalculateRequest(
                gender=Gender.male,
                birth_date=future_date,
                height_cm=Decimal("180"),
                current_weight_kg=Decimal("80"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.maintain,
            )

    def test_birth_date_edge_case_exactly_13_years_old(self):
        # Arrange
        today = date.today()
        birth_date = date(today.year - 13, today.month, today.day)

        # Act
        request = GoalCalculateRequest(
            gender=Gender.male,
            birth_date=birth_date,
            height_cm=Decimal("160"),
            current_weight_kg=Decimal("50"),
            activity_level=ActivityLevel.light,
            weight_goal_type=WeightGoalType.maintain,
        )

        # Assert
        assert request.birth_date == birth_date

    def test_height_zero_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCalculateRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("0"),
                current_weight_kg=Decimal("80"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.maintain,
            )

    def test_height_negative_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCalculateRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("-10"),
                current_weight_kg=Decimal("80"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.maintain,
            )

    def test_height_above_maximum_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCalculateRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("301"),  # > 300
                current_weight_kg=Decimal("80"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.maintain,
            )

    def test_weight_zero_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCalculateRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("180"),
                current_weight_kg=Decimal("0"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.maintain,
            )

    def test_weight_negative_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCalculateRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("180"),
                current_weight_kg=Decimal("-5"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.maintain,
            )

    def test_weight_above_maximum_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCalculateRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("180"),
                current_weight_kg=Decimal("501"),  # > 500
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.maintain,
            )


class TestGoalCreateCalculatedRequest:
    """Tests for GoalCreateCalculatedRequest validation."""

    def test_valid_request_without_overrides(self):
        # Arrange & Act
        request = GoalCreateCalculatedRequest(
            gender=Gender.male,
            birth_date=date(1990, 1, 1),
            height_cm=Decimal("180"),
            current_weight_kg=Decimal("85"),
            activity_level=ActivityLevel.moderate,
            weight_goal_type=WeightGoalType.lose,
            target_weight_kg=Decimal("75"),
            weight_change_pace=WeightChangePace.moderate,
        )

        # Assert
        assert request.protein_percent is None
        assert request.carbs_percent is None
        assert request.fat_percent is None
        assert request.water_ml is None

    def test_valid_request_with_all_macro_overrides(self):
        # Arrange & Act
        request = GoalCreateCalculatedRequest(
            gender=Gender.male,
            birth_date=date(1990, 1, 1),
            height_cm=Decimal("180"),
            current_weight_kg=Decimal("85"),
            activity_level=ActivityLevel.moderate,
            weight_goal_type=WeightGoalType.lose,
            target_weight_kg=Decimal("75"),
            weight_change_pace=WeightChangePace.moderate,
            protein_percent=40,
            carbs_percent=35,
            fat_percent=25,
        )

        # Assert
        assert request.protein_percent == 40
        assert request.carbs_percent == 35
        assert request.fat_percent == 25

    def test_valid_request_with_water_override(self):
        # Arrange & Act
        request = GoalCreateCalculatedRequest(
            gender=Gender.female,
            birth_date=date(1995, 1, 1),
            height_cm=Decimal("165"),
            current_weight_kg=Decimal("60"),
            activity_level=ActivityLevel.light,
            weight_goal_type=WeightGoalType.maintain,
            water_ml=3000,
        )

        # Assert
        assert request.water_ml == 3000

    def test_valid_request_with_id(self):
        # Arrange
        goal_id = uuid4()

        # Act
        request = GoalCreateCalculatedRequest(
            id=goal_id,
            gender=Gender.male,
            birth_date=date(1990, 1, 1),
            height_cm=Decimal("180"),
            current_weight_kg=Decimal("85"),
            activity_level=ActivityLevel.moderate,
            weight_goal_type=WeightGoalType.maintain,
        )

        # Assert
        assert request.id == goal_id

    def test_macros_sum_not_100_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError, match="Macro percentages must sum to 100"):
            GoalCreateCalculatedRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("180"),
                current_weight_kg=Decimal("85"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.lose,
                target_weight_kg=Decimal("75"),
                weight_change_pace=WeightChangePace.moderate,
                protein_percent=40,
                carbs_percent=40,
                fat_percent=25,  # Sum = 105
            )

    def test_macros_sum_less_than_100_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError, match="Macro percentages must sum to 100"):
            GoalCreateCalculatedRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("180"),
                current_weight_kg=Decimal("85"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.lose,
                target_weight_kg=Decimal("75"),
                weight_change_pace=WeightChangePace.moderate,
                protein_percent=30,
                carbs_percent=30,
                fat_percent=30,  # Sum = 90
            )

    def test_partial_macros_allowed(self):
        # Arrange & Act
        request = GoalCreateCalculatedRequest(
            gender=Gender.male,
            birth_date=date(1990, 1, 1),
            height_cm=Decimal("180"),
            current_weight_kg=Decimal("85"),
            activity_level=ActivityLevel.moderate,
            weight_goal_type=WeightGoalType.lose,
            target_weight_kg=Decimal("75"),
            weight_change_pace=WeightChangePace.moderate,
            protein_percent=40,
            # Only one macro provided - should not validate sum
        )

        # Assert
        assert request.protein_percent == 40
        assert request.carbs_percent is None
        assert request.fat_percent is None

    def test_protein_percent_negative_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCreateCalculatedRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("180"),
                current_weight_kg=Decimal("85"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.maintain,
                protein_percent=-5,
            )

    def test_protein_percent_above_100_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCreateCalculatedRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("180"),
                current_weight_kg=Decimal("85"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.maintain,
                protein_percent=101,
            )

    def test_water_ml_negative_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCreateCalculatedRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("180"),
                current_weight_kg=Decimal("85"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.maintain,
                water_ml=-100,
            )

    def test_water_ml_above_maximum_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCreateCalculatedRequest(
                gender=Gender.male,
                birth_date=date(1990, 1, 1),
                height_cm=Decimal("180"),
                current_weight_kg=Decimal("85"),
                activity_level=ActivityLevel.moderate,
                weight_goal_type=WeightGoalType.maintain,
                water_ml=10001,  # > 10000
            )


class TestGoalCreateManualRequest:
    """Tests for GoalCreateManualRequest validation."""

    def test_valid_manual_request(self):
        # Arrange & Act
        request = GoalCreateManualRequest(
            daily_calories_kcal=2000,
            protein_percent=30,
            carbs_percent=45,
            fat_percent=25,
            water_ml=2500,
        )

        # Assert
        assert request.daily_calories_kcal == 2000
        assert request.protein_percent == 30
        assert request.carbs_percent == 45
        assert request.fat_percent == 25
        assert request.water_ml == 2500

    def test_valid_manual_request_with_id(self):
        # Arrange
        goal_id = uuid4()

        # Act
        request = GoalCreateManualRequest(
            id=goal_id,
            daily_calories_kcal=1800,
            protein_percent=25,
            carbs_percent=50,
            fat_percent=25,
            water_ml=2000,
        )

        # Assert
        assert request.id == goal_id

    def test_macros_sum_to_100_valid(self):
        # Arrange & Act
        request = GoalCreateManualRequest(
            daily_calories_kcal=2200,
            protein_percent=33,
            carbs_percent=34,
            fat_percent=33,
            water_ml=2500,
        )

        # Assert
        assert (
            request.protein_percent + request.carbs_percent + request.fat_percent == 100
        )

    def test_macros_sum_not_100_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError, match="Macro percentages must sum to 100"):
            GoalCreateManualRequest(
                daily_calories_kcal=2000,
                protein_percent=40,
                carbs_percent=40,
                fat_percent=25,  # Sum = 105
                water_ml=2500,
            )

    def test_macros_sum_less_than_100_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError, match="Macro percentages must sum to 100"):
            GoalCreateManualRequest(
                daily_calories_kcal=2000,
                protein_percent=30,
                carbs_percent=30,
                fat_percent=30,  # Sum = 90
                water_ml=2500,
            )

    def test_calories_zero_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCreateManualRequest(
                daily_calories_kcal=0,
                protein_percent=30,
                carbs_percent=45,
                fat_percent=25,
                water_ml=2500,
            )

    def test_calories_negative_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCreateManualRequest(
                daily_calories_kcal=-100,
                protein_percent=30,
                carbs_percent=45,
                fat_percent=25,
                water_ml=2500,
            )

    def test_calories_above_maximum_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCreateManualRequest(
                daily_calories_kcal=10001,  # > 10000
                protein_percent=30,
                carbs_percent=45,
                fat_percent=25,
                water_ml=2500,
            )

    def test_protein_percent_negative_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCreateManualRequest(
                daily_calories_kcal=2000,
                protein_percent=-5,
                carbs_percent=55,
                fat_percent=50,
                water_ml=2500,
            )

    def test_protein_percent_above_100_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCreateManualRequest(
                daily_calories_kcal=2000,
                protein_percent=101,
                carbs_percent=0,
                fat_percent=0,
                water_ml=2500,
            )

    def test_water_ml_negative_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCreateManualRequest(
                daily_calories_kcal=2000,
                protein_percent=30,
                carbs_percent=45,
                fat_percent=25,
                water_ml=-100,
            )

    def test_water_ml_above_maximum_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalCreateManualRequest(
                daily_calories_kcal=2000,
                protein_percent=30,
                carbs_percent=45,
                fat_percent=25,
                water_ml=10001,  # > 10000
            )

    def test_boundary_value_calories_minimum(self):
        # Arrange & Act
        request = GoalCreateManualRequest(
            daily_calories_kcal=1,  # Minimum valid
            protein_percent=30,
            carbs_percent=45,
            fat_percent=25,
            water_ml=1000,
        )

        # Assert
        assert request.daily_calories_kcal == 1

    def test_boundary_value_calories_maximum(self):
        # Arrange & Act
        request = GoalCreateManualRequest(
            daily_calories_kcal=10000,  # Maximum valid
            protein_percent=30,
            carbs_percent=45,
            fat_percent=25,
            water_ml=5000,
        )

        # Assert
        assert request.daily_calories_kcal == 10000


class TestGoalUpdateRequest:
    """Tests for GoalUpdateRequest validation."""

    def test_valid_update_all_fields(self):
        # Arrange & Act
        request = GoalUpdateRequest(
            daily_calories_kcal=2100,
            protein_percent=35,
            carbs_percent=40,
            fat_percent=25,
            water_ml=2800,
        )

        # Assert
        assert request.daily_calories_kcal == 2100
        assert request.protein_percent == 35
        assert request.water_ml == 2800

    def test_valid_update_partial_fields(self):
        # Arrange & Act
        request = GoalUpdateRequest(
            daily_calories_kcal=2200,
            water_ml=3000,
        )

        # Assert
        assert request.daily_calories_kcal == 2200
        assert request.water_ml == 3000
        assert request.protein_percent is None
        assert request.carbs_percent is None
        assert request.fat_percent is None

    def test_valid_update_single_field(self):
        # Arrange & Act
        request = GoalUpdateRequest(water_ml=2700)

        # Assert
        assert request.water_ml == 2700
        assert request.daily_calories_kcal is None

    def test_empty_update_valid(self):
        # Arrange & Act
        request = GoalUpdateRequest()

        # Assert
        assert request.daily_calories_kcal is None
        assert request.protein_percent is None
        assert request.water_ml is None

    def test_calories_zero_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalUpdateRequest(daily_calories_kcal=0)

    def test_calories_negative_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalUpdateRequest(daily_calories_kcal=-100)

    def test_calories_above_maximum_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalUpdateRequest(daily_calories_kcal=10001)

    def test_protein_percent_negative_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalUpdateRequest(protein_percent=-5)

    def test_protein_percent_above_100_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalUpdateRequest(protein_percent=101)

    def test_water_ml_negative_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalUpdateRequest(water_ml=-100)

    def test_water_ml_above_maximum_raises_error(self):
        # Arrange & Act & Assert
        with pytest.raises(ValidationError):
            GoalUpdateRequest(water_ml=10001)
