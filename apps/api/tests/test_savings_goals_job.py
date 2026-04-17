from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select

from src.jobs.savings_goals import check_savings_goals
from src.models.account import Account
from src.models.notification import Notification
from src.models.savings_goal import SavingsGoal
from src.models.user import User
from src.models.user_settings import UserSettings


@pytest.mark.asyncio
async def test_completion_flips_status_and_creates_notification(db_session):
    user = User(email="j-complete@example.com", name="JC", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserSettings(user_id=user.id))
    acct = Account(
        user_id=user.id, name="s", institution_name="Chase", type="savings",
        balance=Decimal("10000"), is_manual=True,
    )
    db_session.add(acct)
    await db_session.flush()
    goal = SavingsGoal(
        user_id=user.id, name="g", target_amount=Decimal("10000"),
        linked_account_id=acct.id, status="active",
    )
    db_session.add(goal)
    await db_session.commit()

    await check_savings_goals(db_session, today=date(2026, 4, 16))

    await db_session.refresh(goal)
    assert goal.status == "completed"
    assert goal.completed_at is not None

    notifs = (await db_session.execute(
        select(Notification).where(
            Notification.user_id == user.id,
            Notification.type == "savings_goal_completed",
        )
    )).scalars().all()
    assert len(notifs) == 1


@pytest.mark.asyncio
async def test_completion_is_idempotent_on_rerun(db_session):
    # Second run: recovery scan finds goal already has a notification row,
    # LEFT JOIN excludes it. Active-goal loop finds nothing (status != active).
    # Result: still exactly one notification.
    user = User(email="j-idem@example.com", name="JI", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserSettings(user_id=user.id))
    acct = Account(
        user_id=user.id, name="s", institution_name="Chase", type="savings",
        balance=Decimal("100"), is_manual=True,
    )
    db_session.add(acct)
    await db_session.flush()
    g = SavingsGoal(
        user_id=user.id, name="g", target_amount=Decimal("100"),
        linked_account_id=acct.id, status="active",
    )
    db_session.add(g)
    await db_session.commit()

    await check_savings_goals(db_session, today=date(2026, 4, 16))
    await check_savings_goals(db_session, today=date(2026, 4, 16))

    notifs = (await db_session.execute(
        select(Notification).where(Notification.type == "savings_goal_completed")
    )).scalars().all()
    assert len(notifs) == 1


@pytest.mark.asyncio
async def test_behind_schedule_sends_notification(db_session):
    from datetime import timedelta

    user = User(email="j-behind@example.com", name="JB", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserSettings(user_id=user.id))
    acct = Account(
        user_id=user.id, name="s", institution_name="Chase", type="savings",
        balance=Decimal("100"), is_manual=True,
    )
    db_session.add(acct)
    await db_session.flush()
    today = date(2026, 4, 16)
    db_session.add(SavingsGoal(
        user_id=user.id, name="Car", target_amount=Decimal("10000"),
        target_date=today + timedelta(days=180),
        linked_account_id=acct.id, status="active",
    ))
    await db_session.commit()

    await check_savings_goals(db_session, today=today)

    notifs = (await db_session.execute(
        select(Notification).where(Notification.type == "savings_goal_behind")
    )).scalars().all()
    assert len(notifs) == 1
    assert notifs[0].period_key == "2026-04"


@pytest.mark.asyncio
async def test_behind_schedule_deduped_within_month(db_session):
    from datetime import timedelta

    user = User(email="j-dedup@example.com", name="JD", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserSettings(user_id=user.id))
    acct = Account(
        user_id=user.id, name="s", institution_name="Chase", type="savings",
        balance=Decimal("0"), is_manual=True,
    )
    db_session.add(acct)
    await db_session.flush()
    today = date(2026, 4, 16)
    db_session.add(SavingsGoal(
        user_id=user.id, name="Boat", target_amount=Decimal("10000"),
        target_date=today + timedelta(days=180),
        linked_account_id=acct.id, status="active",
    ))
    await db_session.commit()

    await check_savings_goals(db_session, today=today)
    await check_savings_goals(db_session, today=today)

    notifs = (await db_session.execute(
        select(Notification).where(Notification.type == "savings_goal_behind")
    )).scalars().all()
    assert len(notifs) == 1


@pytest.mark.asyncio
async def test_behind_schedule_skipped_when_target_passed(db_session):
    from datetime import timedelta

    user = User(email="j-passed@example.com", name="JP", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserSettings(user_id=user.id))
    acct = Account(
        user_id=user.id, name="s", institution_name="Chase", type="savings",
        balance=Decimal("0"), is_manual=True,
    )
    db_session.add(acct)
    await db_session.flush()
    today = date(2026, 4, 16)
    db_session.add(SavingsGoal(
        user_id=user.id, name="Late", target_amount=Decimal("10000"),
        target_date=today - timedelta(days=1),
        linked_account_id=acct.id, status="active",
    ))
    await db_session.commit()

    await check_savings_goals(db_session, today=today)
    notifs = (await db_session.execute(
        select(Notification).where(Notification.type == "savings_goal_behind")
    )).scalars().all()
    assert notifs == []


@pytest.mark.asyncio
async def test_recovery_scan_backfills_missing_notification(db_session):
    """Simulate a crash: goal is in completed status but has no notification."""
    user = User(email="j-recover@example.com", name="JR", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserSettings(user_id=user.id))
    g = SavingsGoal(
        user_id=user.id, name="g", target_amount=Decimal("100"),
        status="completed", completed_at=datetime.now(UTC),
    )
    db_session.add(g)
    await db_session.commit()

    await check_savings_goals(db_session, today=date(2026, 4, 16))

    notifs = (await db_session.execute(
        select(Notification).where(Notification.type == "savings_goal_completed")
    )).scalars().all()
    assert len(notifs) == 1
