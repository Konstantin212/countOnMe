"""Business logic for moderation: reports, blocks, and admin actions."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ModerationStatus, Visibility
from app.features.moderation.models import ContentReport, UserBlock
from app.features.shared.models import SharedFood

logger = logging.getLogger(__name__)

# Configurable: number of unresolved reports before auto-hiding a shared food.
AUTO_HIDE_THRESHOLD = 3


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class CannotSelfReport(Exception):
    """Raised when a user tries to report their own shared food."""


class TargetNotFound(Exception):
    """Raised when the report target does not exist."""


class CannotSelfBlock(Exception):
    """Raised when a user tries to block themselves."""


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


async def create_report(
    session: AsyncSession,
    *,
    reporter_user_id: uuid.UUID,
    target_shared_food_id: uuid.UUID,
    reason: str,
    detail: str | None = None,
) -> ContentReport:
    """Create a content report. Idempotent: returns existing if duplicate.

    Raises TargetNotFound if the shared food does not exist.
    Raises CannotSelfReport if the reporter is the food owner.
    """
    # Validate the shared food exists
    stmt = select(SharedFood).where(
        SharedFood.id == target_shared_food_id,
        SharedFood.deleted_at.is_(None),
    )
    result = await session.execute(stmt)
    food = result.scalars().first()

    if food is None:
        raise TargetNotFound

    if food.owner_user_id == reporter_user_id:
        raise CannotSelfReport

    # Check for existing report (idempotent)
    existing_stmt = select(ContentReport).where(
        ContentReport.reporter_user_id == reporter_user_id,
        ContentReport.target_shared_food_id == target_shared_food_id,
    )
    existing_result = await session.execute(existing_stmt)
    existing = existing_result.scalars().first()
    if existing is not None:
        return existing

    report = ContentReport(
        reporter_user_id=reporter_user_id,
        target_shared_food_id=target_shared_food_id,
        reason=reason,
        detail=detail,
    )
    session.add(report)

    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        # Race condition: another request created the report concurrently
        re_result = await session.execute(existing_stmt)
        existing = re_result.scalars().first()
        if existing is not None:
            return existing
        raise  # pragma: no cover

    # Auto-hide: if unresolved report count reaches threshold, set pending
    unresolved_count = await count_unresolved_reports(
        session, target_shared_food_id=target_shared_food_id,
    )
    if unresolved_count >= AUTO_HIDE_THRESHOLD:
        if food.moderation_status != ModerationStatus.pending:
            food.moderation_status = ModerationStatus.pending
            session.add(food)
            await session.flush()

    await session.commit()
    await session.refresh(report)
    return report


async def list_my_reports(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
) -> list[ContentReport]:
    """Return reports submitted by this user, newest first."""
    stmt = (
        select(ContentReport)
        .where(ContentReport.reporter_user_id == user_id)
        .order_by(ContentReport.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_pending_reports(
    session: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[ContentReport]:
    """Return unresolved reports, oldest first (for admin queue)."""
    stmt = (
        select(ContentReport)
        .where(ContentReport.resolved_at.is_(None))
        .order_by(ContentReport.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def resolve_report(
    session: AsyncSession,
    *,
    report_id: uuid.UUID,
    admin_user_id: uuid.UUID,
    resolution_note: str | None = None,
) -> ContentReport | None:
    """Resolve a report. Returns None if not found."""
    stmt = select(ContentReport).where(ContentReport.id == report_id)
    result = await session.execute(stmt)
    report = result.scalars().first()
    if report is None:
        return None

    # Idempotent: already resolved, return as-is
    if report.resolved_at is not None:
        return report

    report.resolved_at = datetime.now(UTC)
    report.resolved_by_user_id = admin_user_id
    report.resolution_note = resolution_note
    session.add(report)
    await session.commit()
    await session.refresh(report)
    return report


async def count_unresolved_reports(
    session: AsyncSession,
    *,
    target_shared_food_id: uuid.UUID,
) -> int:
    """Count unresolved reports for a given shared food."""
    stmt = select(func.count()).where(
        ContentReport.target_shared_food_id == target_shared_food_id,
        ContentReport.resolved_at.is_(None),
    )
    result = await session.execute(stmt)
    return result.scalar_one()


# ---------------------------------------------------------------------------
# Blocks
# ---------------------------------------------------------------------------


async def block_user(
    session: AsyncSession,
    *,
    blocker_user_id: uuid.UUID,
    blocked_user_id: uuid.UUID,
) -> UserBlock:
    """Block a user. Idempotent: returns existing if duplicate.

    Raises CannotSelfBlock if blocker == blocked.
    """
    if blocker_user_id == blocked_user_id:
        raise CannotSelfBlock

    # Check for existing block
    existing_stmt = select(UserBlock).where(
        UserBlock.blocker_user_id == blocker_user_id,
        UserBlock.blocked_user_id == blocked_user_id,
    )
    existing_result = await session.execute(existing_stmt)
    existing = existing_result.scalars().first()
    if existing is not None:
        return existing

    block = UserBlock(
        blocker_user_id=blocker_user_id,
        blocked_user_id=blocked_user_id,
    )
    session.add(block)

    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        re_result = await session.execute(existing_stmt)
        existing = re_result.scalars().first()
        if existing is not None:
            return existing
        raise  # pragma: no cover

    await session.commit()
    await session.refresh(block)
    return block


async def unblock_user(
    session: AsyncSession,
    *,
    blocker_user_id: uuid.UUID,
    blocked_user_id: uuid.UUID,
) -> bool:
    """Unblock a user. Returns False if not found."""
    stmt = select(UserBlock).where(
        UserBlock.blocker_user_id == blocker_user_id,
        UserBlock.blocked_user_id == blocked_user_id,
    )
    result = await session.execute(stmt)
    block = result.scalars().first()
    if block is None:
        return False

    await session.delete(block)
    await session.commit()
    return True


async def list_blocked_users(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
) -> list[UserBlock]:
    """Return all blocks where user is the blocker."""
    stmt = (
        select(UserBlock)
        .where(UserBlock.blocker_user_id == user_id)
        .order_by(UserBlock.created_at.desc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_blocked_user_ids(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
) -> set[uuid.UUID]:
    """Return the set of user IDs blocked by this user."""
    stmt = select(UserBlock.blocked_user_id).where(
        UserBlock.blocker_user_id == user_id,
    )
    result = await session.execute(stmt)
    return set(result.scalars().all())


# ---------------------------------------------------------------------------
# Admin moderation
# ---------------------------------------------------------------------------


async def admin_approve_food(
    session: AsyncSession,
    *,
    shared_food_id: uuid.UUID,
    admin_user_id: uuid.UUID,
) -> SharedFood | None:
    """Approve a shared food. Returns None if not found."""
    stmt = select(SharedFood).where(
        SharedFood.id == shared_food_id,
        SharedFood.deleted_at.is_(None),
    )
    result = await session.execute(stmt)
    food = result.scalars().first()
    if food is None:
        return None

    if food.moderation_status != ModerationStatus.pending:
        logger.warning(
            "Admin %s approving shared food %s with non-pending status '%s'",
            admin_user_id,
            shared_food_id,
            food.moderation_status.value,
        )

    food.moderation_status = ModerationStatus.approved
    food.updated_at = datetime.now(UTC)
    session.add(food)
    await session.commit()
    await session.refresh(food)
    logger.info("Admin %s approved shared food %s", admin_user_id, shared_food_id)
    return food


async def admin_reject_food(
    session: AsyncSession,
    *,
    shared_food_id: uuid.UUID,
    admin_user_id: uuid.UUID,
    reason: str | None = None,
) -> SharedFood | None:
    """Reject a shared food. Returns None if not found."""
    stmt = select(SharedFood).where(
        SharedFood.id == shared_food_id,
        SharedFood.deleted_at.is_(None),
    )
    result = await session.execute(stmt)
    food = result.scalars().first()
    if food is None:
        return None

    if food.moderation_status != ModerationStatus.pending:
        logger.warning(
            "Admin %s rejecting shared food %s with non-pending status '%s'",
            admin_user_id,
            shared_food_id,
            food.moderation_status.value,
        )

    food.moderation_status = ModerationStatus.rejected
    food.updated_at = datetime.now(UTC)
    session.add(food)
    await session.commit()
    await session.refresh(food)
    logger.info("Admin %s rejected shared food %s (reason=%s)", admin_user_id, shared_food_id, reason)
    return food


async def get_moderation_stats(
    session: AsyncSession,
) -> dict[str, int]:
    """Return counts of pending reports and pending foods."""
    # Pending reports (unresolved)
    pending_reports_stmt = select(func.count()).where(
        ContentReport.resolved_at.is_(None),
    )
    pending_reports_result = await session.execute(pending_reports_stmt)
    pending_reports = pending_reports_result.scalar_one()

    # Pending foods (public + pending moderation + not deleted)
    pending_foods_stmt = select(func.count()).where(
        SharedFood.visibility == Visibility.public,
        SharedFood.moderation_status == ModerationStatus.pending,
        SharedFood.deleted_at.is_(None),
    )
    pending_foods_result = await session.execute(pending_foods_stmt)
    pending_foods = pending_foods_result.scalar_one()

    return {"pending_reports": pending_reports, "pending_foods": pending_foods}
