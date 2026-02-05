from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.schemas.common import APIModel
from app.schemas.enums import (
    ActivityLevel,
    Gender,
    GoalType,
    WeightChangePace,
    WeightGoalType,
)


class GoalCalculateRequest(APIModel):
    """Request for calculating BMR/TDEE/targets (preview before saving)."""

    gender: Gender
    birth_date: date
    height_cm: Decimal = Field(gt=0, le=300, description="Height in centimeters")
    current_weight_kg: Decimal = Field(gt=0, le=500, description="Current weight in kg")
    activity_level: ActivityLevel
    weight_goal_type: WeightGoalType
    target_weight_kg: Decimal | None = Field(
        default=None, gt=0, le=500, description="Target weight in kg (required for lose/gain)"
    )
    weight_change_pace: WeightChangePace | None = Field(
        default=None, description="Pace of weight change (required for lose/gain)"
    )

    @model_validator(mode="after")
    def validate_weight_goal_fields(self) -> "GoalCalculateRequest":
        if self.weight_goal_type in (WeightGoalType.lose, WeightGoalType.gain):
            if self.target_weight_kg is None:
                raise ValueError("target_weight_kg is required for lose/gain goals")
            if self.weight_change_pace is None:
                raise ValueError("weight_change_pace is required for lose/gain goals")
        return self

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: date) -> date:
        today = date.today()
        age = (today - v).days // 365
        if age < 13:
            raise ValueError("Must be at least 13 years old")
        if age > 120:
            raise ValueError("Invalid birth date")
        if v > today:
            raise ValueError("Birth date cannot be in the future")
        return v


class GoalCalculateResponse(APIModel):
    """Calculated values for preview before saving."""

    # BMR/TDEE
    bmr_kcal: int
    tdee_kcal: int

    # Targets
    daily_calories_kcal: int
    protein_percent: int
    carbs_percent: int
    fat_percent: int
    protein_grams: int
    carbs_grams: int
    fat_grams: int
    water_ml: int

    # Weight range info
    healthy_weight_min_kg: float
    healthy_weight_max_kg: float
    current_bmi: float
    bmi_category: str


class GoalCreateCalculatedRequest(GoalCalculateRequest):
    """Save calculated goal with optional macro/water overrides."""

    id: UUID | None = None
    protein_percent: int | None = Field(default=None, ge=0, le=100)
    carbs_percent: int | None = Field(default=None, ge=0, le=100)
    fat_percent: int | None = Field(default=None, ge=0, le=100)
    water_ml: int | None = Field(default=None, ge=0, le=10000)

    @model_validator(mode="after")
    def validate_macro_sum(self) -> "GoalCreateCalculatedRequest":
        # Only validate if all three are provided
        if (
            self.protein_percent is not None
            and self.carbs_percent is not None
            and self.fat_percent is not None
        ):
            total = self.protein_percent + self.carbs_percent + self.fat_percent
            if total != 100:
                raise ValueError(f"Macro percentages must sum to 100, got {total}")
        return self


class GoalCreateManualRequest(APIModel):
    """Save manual goal (direct input)."""

    id: UUID | None = None
    daily_calories_kcal: int = Field(gt=0, le=10000)
    protein_percent: int = Field(ge=0, le=100)
    carbs_percent: int = Field(ge=0, le=100)
    fat_percent: int = Field(ge=0, le=100)
    water_ml: int = Field(ge=0, le=10000)

    @model_validator(mode="after")
    def validate_macro_sum(self) -> "GoalCreateManualRequest":
        total = self.protein_percent + self.carbs_percent + self.fat_percent
        if total != 100:
            raise ValueError(f"Macro percentages must sum to 100, got {total}")
        return self


class GoalResponse(APIModel):
    """Full goal response."""

    id: UUID
    goal_type: GoalType

    # Body metrics (null for manual)
    gender: Gender | None = None
    birth_date: date | None = None
    height_cm: Decimal | None = None
    current_weight_kg: Decimal | None = None
    activity_level: ActivityLevel | None = None
    weight_goal_type: WeightGoalType | None = None
    target_weight_kg: Decimal | None = None
    weight_change_pace: WeightChangePace | None = None

    # Calculated values (null for manual)
    bmr_kcal: int | None = None
    tdee_kcal: int | None = None

    # Targets (always present)
    daily_calories_kcal: int
    protein_percent: int
    carbs_percent: int
    fat_percent: int
    protein_grams: int
    carbs_grams: int
    fat_grams: int
    water_ml: int

    # Weight range (null for manual)
    healthy_weight_min_kg: float | None = None
    healthy_weight_max_kg: float | None = None
    current_bmi: float | None = None
    bmi_category: str | None = None

    created_at: datetime
    updated_at: datetime


class GoalUpdateRequest(APIModel):
    """Update goal (partial)."""

    daily_calories_kcal: int | None = Field(default=None, gt=0, le=10000)
    protein_percent: int | None = Field(default=None, ge=0, le=100)
    carbs_percent: int | None = Field(default=None, ge=0, le=100)
    fat_percent: int | None = Field(default=None, ge=0, le=100)
    water_ml: int | None = Field(default=None, ge=0, le=10000)
