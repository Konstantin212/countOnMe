"""Routers for moderation: user-facing reports/blocks + admin moderation."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user_id, require_admin
from app.features.auth.models import User
from app.features.moderation.schemas import (
    AdminModerationAction,
    BlockCreateRequest,
    BlockResponse,
    ModerationStatsResponse,
    ReportCreateRequest,
    ReportListItem,
    ReportResponse,
    ResolveReportRequest,
)
from app.features.moderation.service import (
    CannotSelfBlock,
    CannotSelfReport,
    TargetNotFound,
    admin_approve_food,
    admin_reject_food,
    block_user,
    get_moderation_stats,
    get_pending_reports,
    list_blocked_users,
    list_my_reports,
    resolve_report,
    unblock_user,
)
from app.features.moderation.service import create_report as svc_create_report
from app.features.shared.schemas import SharedFoodResponse
from app.features.shared.service import get_shared_food

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# User-facing router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/moderation", tags=["moderation"])


@router.post("/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report_endpoint(
    body: ReportCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> ReportResponse:
    """Report a shared food item."""
    try:
        report = await svc_create_report(
            session,
            reporter_user_id=user_id,
            target_shared_food_id=body.target_shared_food_id,
            reason=body.reason,
            detail=body.detail,
        )
    except TargetNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Shared food not found",
        ) from None
    except CannotSelfReport:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot report your own food",
        ) from None

    return ReportResponse.model_validate(report)


@router.get("/reports/mine", response_model=list[ReportListItem])
async def list_my_reports_endpoint(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> list[ReportListItem]:
    """List reports submitted by the authenticated user."""
    reports = await list_my_reports(session, user_id=user_id, limit=limit, offset=offset)
    return [ReportListItem.model_validate(r) for r in reports]


@router.post("/blocks", response_model=BlockResponse, status_code=status.HTTP_201_CREATED)
async def block_user_endpoint(
    body: BlockCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> BlockResponse:
    """Block a user."""
    try:
        block = await block_user(
            session,
            blocker_user_id=user_id,
            blocked_user_id=body.blocked_user_id,
        )
    except CannotSelfBlock:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot block yourself",
        ) from None

    return BlockResponse.model_validate(block)


@router.delete("/blocks/{blocked_user_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def unblock_user_endpoint(
    blocked_user_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Unblock a user."""
    removed = await unblock_user(
        session,
        blocker_user_id=user_id,
        blocked_user_id=blocked_user_id,
    )
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Block not found",
        )


@router.get("/blocks", response_model=list[BlockResponse])
async def list_blocks_endpoint(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> list[BlockResponse]:
    """List users blocked by the authenticated user."""
    blocks = await list_blocked_users(session, user_id=user_id)
    return [BlockResponse.model_validate(b) for b in blocks]


# ---------------------------------------------------------------------------
# Admin router
# ---------------------------------------------------------------------------

admin_router = APIRouter(prefix="/admin/moderation", tags=["admin"])


@admin_router.get("/reports", response_model=list[ReportResponse])
async def admin_list_reports(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> list[ReportResponse]:
    """List pending (unresolved) reports. Admin only."""
    reports = await get_pending_reports(session, limit=limit, offset=offset)
    return [ReportResponse.model_validate(r) for r in reports]


@admin_router.post("/reports/{report_id}/resolve", response_model=ReportResponse)
async def admin_resolve_report(
    report_id: uuid.UUID,
    body: ResolveReportRequest,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> ReportResponse:
    """Resolve a report. Admin only."""
    report = await resolve_report(
        session,
        report_id=report_id,
        admin_user_id=admin.id,
        resolution_note=body.resolution_note,
    )
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found",
        )
    return ReportResponse.model_validate(report)


@admin_router.post("/foods/{shared_food_id}/approve", response_model=SharedFoodResponse)
async def admin_approve_food_endpoint(
    shared_food_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> SharedFoodResponse:
    """Approve a shared food. Admin only."""
    food = await admin_approve_food(
        session,
        shared_food_id=shared_food_id,
        admin_user_id=admin.id,
    )
    if food is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Shared food not found",
        )
    # Re-fetch with portions eagerly loaded
    food_full = await get_shared_food(session, shared_food_id=shared_food_id)
    return SharedFoodResponse.model_validate(food_full)


@admin_router.post("/foods/{shared_food_id}/reject", response_model=SharedFoodResponse)
async def admin_reject_food_endpoint(
    shared_food_id: uuid.UUID,
    body: AdminModerationAction,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> SharedFoodResponse:
    """Reject a shared food. Admin only."""
    food = await admin_reject_food(
        session,
        shared_food_id=shared_food_id,
        admin_user_id=admin.id,
        reason=body.reason,
    )
    if food is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Shared food not found",
        )
    food_full = await get_shared_food(session, shared_food_id=shared_food_id)
    return SharedFoodResponse.model_validate(food_full)


@admin_router.get("/stats", response_model=ModerationStatsResponse)
async def admin_stats(
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
) -> ModerationStatsResponse:
    """Moderation summary stats. Admin only."""
    stats = await get_moderation_stats(session)
    return ModerationStatsResponse(**stats)
