from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.core.enums import ReportReason
from app.core.schemas import APIModel

# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


class ReportCreateRequest(APIModel):
    target_shared_food_id: UUID
    reason: ReportReason
    detail: str | None = Field(default=None, max_length=2000)


class ReportResponse(APIModel):
    id: UUID
    reporter_user_id: UUID
    target_shared_food_id: UUID
    reason: ReportReason
    detail: str | None
    created_at: datetime
    resolved_at: datetime | None
    resolved_by_user_id: UUID | None
    resolution_note: str | None


class ReportListItem(APIModel):
    id: UUID
    reporter_user_id: UUID
    target_shared_food_id: UUID
    reason: ReportReason
    detail: str | None
    created_at: datetime


class ResolveReportRequest(APIModel):
    resolution_note: str | None = Field(default=None, max_length=2000)


# ---------------------------------------------------------------------------
# Blocks
# ---------------------------------------------------------------------------


class BlockCreateRequest(APIModel):
    blocked_user_id: UUID


class BlockResponse(APIModel):
    id: UUID
    blocker_user_id: UUID
    blocked_user_id: UUID
    created_at: datetime


# ---------------------------------------------------------------------------
# Admin moderation
# ---------------------------------------------------------------------------


class AdminModerationAction(APIModel):
    reason: str | None = Field(default=None, max_length=2000)


class ModerationStatsResponse(APIModel):
    pending_reports: int
    pending_foods: int
