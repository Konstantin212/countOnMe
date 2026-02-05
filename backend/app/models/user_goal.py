from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin
from app.schemas.enums import (
    ActivityLevel,
    Gender,
    GoalType,
    WeightChangePace,
    WeightGoalType,
)


class UserGoal(Base, TimestampMixin):
    """User nutrition goal - either calculated from body metrics or manually entered."""

    __tablename__ = "user_goals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )

    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Goal type
    goal_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    # Body metrics (for calculated goals)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    height_cm: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    current_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    activity_level: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Weight goal (for calculated)
    weight_goal_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    target_weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    weight_change_pace: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Calculated values (stored for quick access)
    bmr_kcal: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tdee_kcal: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Final targets (both goal types)
    daily_calories_kcal: Mapped[int] = mapped_column(Integer, nullable=False)
    protein_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    carbs_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    fat_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    protein_grams: Mapped[int] = mapped_column(Integer, nullable=False)
    carbs_grams: Mapped[int] = mapped_column(Integer, nullable=False)
    fat_grams: Mapped[int] = mapped_column(Integer, nullable=False)
    water_ml: Mapped[int] = mapped_column(Integer, nullable=False)

    # Healthy weight range (calculated from height)
    healthy_weight_min_kg: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    healthy_weight_max_kg: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    current_bmi: Mapped[Decimal | None] = mapped_column(Numeric(4, 1), nullable=True)
    bmi_category: Mapped[str | None] = mapped_column(String(20), nullable=True)

    @property
    def goal_type_enum(self) -> GoalType:
        return GoalType(self.goal_type)

    @property
    def gender_enum(self) -> Gender | None:
        return Gender(self.gender) if self.gender else None

    @property
    def activity_level_enum(self) -> ActivityLevel | None:
        return ActivityLevel(self.activity_level) if self.activity_level else None

    @property
    def weight_goal_type_enum(self) -> WeightGoalType | None:
        return WeightGoalType(self.weight_goal_type) if self.weight_goal_type else None

    @property
    def weight_change_pace_enum(self) -> WeightChangePace | None:
        return WeightChangePace(self.weight_change_pace) if self.weight_change_pace else None
