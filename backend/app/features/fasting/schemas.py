from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from pydantic import Field, field_validator

from app.core.schemas import APIModel

VALID_TECHNIQUES = ("16:8", "18:6", "20:4", "custom")

_MAX_FUTURE = timedelta(hours=24)
_MAX_PAST = timedelta(days=365)


def _validate_timestamp_bounds(v: datetime, field_name: str) -> datetime:
    """Validate that a timestamp is within a reasonable range."""
    now = datetime.now(UTC)
    if v > now + _MAX_FUTURE:
        raise ValueError(f"{field_name} cannot be more than 24 hours in the future")
    if v < now - _MAX_PAST:
        raise ValueError(f"{field_name} cannot be more than 1 year in the past")
    return v


class FastingStartRequest(APIModel):
    technique: str = Field(..., pattern=r"^(16:8|18:6|20:4|custom)$")
    fasting_hours: int = Field(..., gt=0, le=72)
    started_at: datetime

    @field_validator("started_at")
    @classmethod
    def validate_started_at(cls, v: datetime) -> datetime:
        return _validate_timestamp_bounds(v, "started_at")


class FastingEndRequest(APIModel):
    ended_at: datetime

    @field_validator("ended_at")
    @classmethod
    def validate_ended_at(cls, v: datetime) -> datetime:
        return _validate_timestamp_bounds(v, "ended_at")


class FastingUpdateRequest(APIModel):
    started_at: datetime | None = None
    ended_at: datetime | None = None
    technique: str | None = Field(default=None, pattern=r"^(16:8|18:6|20:4|custom)$")
    fasting_hours: int | None = Field(default=None, gt=0, le=72)

    @field_validator("started_at")
    @classmethod
    def validate_started_at(cls, v: datetime | None) -> datetime | None:
        if v is not None:
            return _validate_timestamp_bounds(v, "started_at")
        return v

    @field_validator("ended_at")
    @classmethod
    def validate_ended_at(cls, v: datetime | None) -> datetime | None:
        if v is not None:
            return _validate_timestamp_bounds(v, "ended_at")
        return v


class FastingSessionResponse(APIModel):
    id: UUID
    technique: str
    fasting_hours: int
    started_at: datetime
    target_end_at: datetime
    ended_at: datetime | None
    completed: bool
    created_at: datetime
    updated_at: datetime
