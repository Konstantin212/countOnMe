"""Service-level tests for moderation: reports, blocks, admin actions."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import ModerationStatus, ReportReason, Visibility
from app.features.moderation.service import (
    AUTO_HIDE_THRESHOLD,
    CannotSelfBlock,
    CannotSelfReport,
    TargetNotFound,
    admin_approve_food,
    admin_reject_food,
    block_user,
    create_report,
    get_blocked_user_ids,
    get_moderation_stats,
    get_pending_reports,
    list_blocked_users,
    list_my_reports,
    resolve_report,
    unblock_user,
)
from app.features.shared.service import search_shared_foods
from tests.factories import (
    create_content_report,
    create_shared_food,
    create_user,
)

# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_report_success(db_session: AsyncSession) -> None:
    """A user can report another user's shared food."""
    owner = await create_user(db_session)
    reporter = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    report = await create_report(
        db_session,
        reporter_user_id=reporter.id,
        target_shared_food_id=food.id,
        reason=ReportReason.spam,
        detail="Looks like spam",
    )

    assert report.reporter_user_id == reporter.id
    assert report.target_shared_food_id == food.id
    assert report.reason == ReportReason.spam
    assert report.detail == "Looks like spam"
    assert report.resolved_at is None


@pytest.mark.asyncio
async def test_create_report_idempotent(db_session: AsyncSession) -> None:
    """Second report by same user for same target returns existing report."""
    owner = await create_user(db_session)
    reporter = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    r1 = await create_report(
        db_session,
        reporter_user_id=reporter.id,
        target_shared_food_id=food.id,
        reason=ReportReason.spam,
    )
    r2 = await create_report(
        db_session,
        reporter_user_id=reporter.id,
        target_shared_food_id=food.id,
        reason=ReportReason.offensive,  # Different reason, but same pair
    )

    assert r1.id == r2.id


@pytest.mark.asyncio
async def test_create_report_cannot_self_report(db_session: AsyncSession) -> None:
    """A user cannot report their own food."""
    owner = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    with pytest.raises(CannotSelfReport):
        await create_report(
            db_session,
            reporter_user_id=owner.id,
            target_shared_food_id=food.id,
            reason=ReportReason.inaccurate,
        )


@pytest.mark.asyncio
async def test_create_report_nonexistent_food(db_session: AsyncSession) -> None:
    """Reporting a nonexistent food raises TargetNotFound."""
    reporter = await create_user(db_session)
    await db_session.commit()

    with pytest.raises(TargetNotFound):
        await create_report(
            db_session,
            reporter_user_id=reporter.id,
            target_shared_food_id=uuid.uuid4(),
            reason=ReportReason.spam,
        )


@pytest.mark.asyncio
async def test_auto_hide_after_threshold(db_session: AsyncSession) -> None:
    """After N unresolved reports, the food is auto-hidden (set to pending)."""
    owner = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    # Create AUTO_HIDE_THRESHOLD reports from different users
    for _ in range(AUTO_HIDE_THRESHOLD):
        reporter = await create_user(db_session)
        await db_session.commit()
        await create_report(
            db_session,
            reporter_user_id=reporter.id,
            target_shared_food_id=food.id,
            reason=ReportReason.inaccurate,
        )

    # Refresh the food object to see updated status
    await db_session.refresh(food)
    assert food.moderation_status == ModerationStatus.pending


@pytest.mark.asyncio
async def test_auto_hide_only_counts_unresolved(db_session: AsyncSession) -> None:
    """Resolved reports don't count toward the auto-hide threshold."""
    owner = await create_user(db_session)
    admin = await create_user(db_session, is_admin=True)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    # Create AUTO_HIDE_THRESHOLD - 1 reports and resolve them
    for _ in range(AUTO_HIDE_THRESHOLD - 1):
        reporter = await create_user(db_session)
        await db_session.commit()
        report = await create_report(
            db_session,
            reporter_user_id=reporter.id,
            target_shared_food_id=food.id,
            reason=ReportReason.spam,
        )
        await resolve_report(
            db_session,
            report_id=report.id,
            admin_user_id=admin.id,
            resolution_note="Dismissed",
        )

    # Now add one more unresolved report -- should NOT trigger auto-hide
    new_reporter = await create_user(db_session)
    await db_session.commit()
    await create_report(
        db_session,
        reporter_user_id=new_reporter.id,
        target_shared_food_id=food.id,
        reason=ReportReason.inaccurate,
    )

    await db_session.refresh(food)
    assert food.moderation_status == ModerationStatus.approved


@pytest.mark.asyncio
async def test_list_my_reports_only_mine(db_session: AsyncSession) -> None:
    """list_my_reports returns only the caller's reports."""
    owner = await create_user(db_session)
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    await create_report(
        db_session,
        reporter_user_id=user_a.id,
        target_shared_food_id=food.id,
        reason=ReportReason.spam,
    )
    await create_report(
        db_session,
        reporter_user_id=user_b.id,
        target_shared_food_id=food.id,
        reason=ReportReason.offensive,
    )

    a_reports = await list_my_reports(db_session, user_id=user_a.id)
    assert all(r.reporter_user_id == user_a.id for r in a_reports)
    assert any(r.target_shared_food_id == food.id for r in a_reports)


@pytest.mark.asyncio
async def test_get_pending_reports_excludes_resolved(db_session: AsyncSession) -> None:
    """get_pending_reports returns only unresolved reports."""
    owner = await create_user(db_session)
    admin = await create_user(db_session, is_admin=True)
    reporter = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    report = await create_report(
        db_session,
        reporter_user_id=reporter.id,
        target_shared_food_id=food.id,
        reason=ReportReason.spam,
    )
    await resolve_report(
        db_session,
        report_id=report.id,
        admin_user_id=admin.id,
    )

    pending = await get_pending_reports(db_session)
    assert report.id not in {r.id for r in pending}


@pytest.mark.asyncio
async def test_resolve_report_sets_fields(db_session: AsyncSession) -> None:
    """resolve_report sets resolved_at, resolved_by, and resolution_note."""
    owner = await create_user(db_session)
    admin = await create_user(db_session, is_admin=True)
    reporter = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    report = await create_report(
        db_session,
        reporter_user_id=reporter.id,
        target_shared_food_id=food.id,
        reason=ReportReason.offensive,
    )

    resolved = await resolve_report(
        db_session,
        report_id=report.id,
        admin_user_id=admin.id,
        resolution_note="Reviewed and dismissed",
    )

    assert resolved is not None
    assert resolved.resolved_at is not None
    assert resolved.resolved_by_user_id == admin.id
    assert resolved.resolution_note == "Reviewed and dismissed"


# ---------------------------------------------------------------------------
# Blocks
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_block_user_success(db_session: AsyncSession) -> None:
    """A user can block another user."""
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    await db_session.commit()

    block = await block_user(
        db_session,
        blocker_user_id=user_a.id,
        blocked_user_id=user_b.id,
    )

    assert block.blocker_user_id == user_a.id
    assert block.blocked_user_id == user_b.id


@pytest.mark.asyncio
async def test_block_user_idempotent(db_session: AsyncSession) -> None:
    """Blocking the same user twice returns existing block."""
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    await db_session.commit()

    b1 = await block_user(
        db_session, blocker_user_id=user_a.id, blocked_user_id=user_b.id,
    )
    b2 = await block_user(
        db_session, blocker_user_id=user_a.id, blocked_user_id=user_b.id,
    )

    assert b1.id == b2.id


@pytest.mark.asyncio
async def test_block_user_no_self_block(db_session: AsyncSession) -> None:
    """A user cannot block themselves."""
    user = await create_user(db_session)
    await db_session.commit()

    with pytest.raises(CannotSelfBlock):
        await block_user(
            db_session, blocker_user_id=user.id, blocked_user_id=user.id,
        )


@pytest.mark.asyncio
async def test_unblock_user_success(db_session: AsyncSession) -> None:
    """Unblocking a blocked user returns True."""
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    await db_session.commit()

    await block_user(
        db_session, blocker_user_id=user_a.id, blocked_user_id=user_b.id,
    )
    result = await unblock_user(
        db_session, blocker_user_id=user_a.id, blocked_user_id=user_b.id,
    )

    assert result is True


@pytest.mark.asyncio
async def test_unblock_user_not_found(db_session: AsyncSession) -> None:
    """Unblocking a non-blocked user returns False."""
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    await db_session.commit()

    result = await unblock_user(
        db_session, blocker_user_id=user_a.id, blocked_user_id=user_b.id,
    )

    assert result is False


@pytest.mark.asyncio
async def test_get_blocked_user_ids(db_session: AsyncSession) -> None:
    """get_blocked_user_ids returns correct set."""
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    user_c = await create_user(db_session)
    await db_session.commit()

    await block_user(
        db_session, blocker_user_id=user_a.id, blocked_user_id=user_b.id,
    )
    await block_user(
        db_session, blocker_user_id=user_a.id, blocked_user_id=user_c.id,
    )

    blocked = await get_blocked_user_ids(db_session, user_id=user_a.id)
    assert blocked == {user_b.id, user_c.id}


@pytest.mark.asyncio
async def test_list_blocked_users(db_session: AsyncSession) -> None:
    """list_blocked_users returns all blocks for the blocker."""
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)
    await db_session.commit()

    await block_user(
        db_session, blocker_user_id=user_a.id, blocked_user_id=user_b.id,
    )

    blocks = await list_blocked_users(db_session, user_id=user_a.id)
    assert len(blocks) >= 1
    assert any(b.blocked_user_id == user_b.id for b in blocks)


# ---------------------------------------------------------------------------
# Block filtering in search
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_search_excludes_blocked_users_content(db_session: AsyncSession) -> None:
    """Blocked user's public+approved foods are hidden from search."""
    await create_user(db_session)  # user_a (the searcher, not needed by name)
    user_b = await create_user(db_session)
    marker = uuid.uuid4().hex[:8]
    food = await create_shared_food(
        db_session,
        owner_user_id=user_b.id,
        name=f"BlockedSearch-{marker}",
        display_name=f"BlockedSearch-{marker}",
        visibility=Visibility.public,
        moderation_status=ModerationStatus.approved,
    )
    await db_session.commit()

    # Before block: food is visible
    results_before = await search_shared_foods(
        db_session, q=f"BlockedSearch-{marker}",
    )
    assert any(f.id == food.id for f in results_before)

    # After block: food is hidden
    blocked_ids = {user_b.id}
    results_after = await search_shared_foods(
        db_session, q=f"BlockedSearch-{marker}", exclude_owner_ids=blocked_ids,
    )
    assert not any(f.id == food.id for f in results_after)


# ---------------------------------------------------------------------------
# Admin moderation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_approve_food(db_session: AsyncSession) -> None:
    """admin_approve_food sets moderation_status to approved."""
    admin = await create_user(db_session, is_admin=True)
    owner = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.pending,
    )
    await db_session.commit()

    result = await admin_approve_food(
        db_session, shared_food_id=food.id, admin_user_id=admin.id,
    )

    assert result is not None
    assert result.moderation_status == ModerationStatus.approved


@pytest.mark.asyncio
async def test_admin_reject_food(db_session: AsyncSession) -> None:
    """admin_reject_food sets moderation_status to rejected."""
    admin = await create_user(db_session, is_admin=True)
    owner = await create_user(db_session)
    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.pending,
    )
    await db_session.commit()

    result = await admin_reject_food(
        db_session, shared_food_id=food.id, admin_user_id=admin.id, reason="Bad data",
    )

    assert result is not None
    assert result.moderation_status == ModerationStatus.rejected


@pytest.mark.asyncio
async def test_get_moderation_stats(db_session: AsyncSession) -> None:
    """get_moderation_stats returns correct counts."""
    owner = await create_user(db_session)
    reporter = await create_user(db_session)

    food = await create_shared_food(
        db_session,
        owner_user_id=owner.id,
        visibility=Visibility.public,
        moderation_status=ModerationStatus.pending,
    )
    await db_session.commit()

    await create_content_report(
        db_session,
        reporter_user_id=reporter.id,
        target_shared_food_id=food.id,
        reason=ReportReason.spam,
    )
    await db_session.commit()

    stats = await get_moderation_stats(db_session)
    assert stats["pending_reports"] >= 1
    assert stats["pending_foods"] >= 1
