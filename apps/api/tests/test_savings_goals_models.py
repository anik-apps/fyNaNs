from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from src.models.account import Account
from src.models.savings_goal import SavingsGoal, SavingsGoalContribution
from src.models.user import User


@pytest.mark.asyncio
async def test_savings_goal_create_minimal(db_session):
    user = User(email="goal-owner@example.com", name="Goal Owner", password_hash="x")
    db_session.add(user)
    await db_session.flush()

    goal = SavingsGoal(
        user_id=user.id,
        name="Emergency Fund",
        target_amount=Decimal("10000.00"),
    )
    db_session.add(goal)
    await db_session.commit()

    await db_session.refresh(goal)
    assert goal.status == "active"
    assert goal.target_date is None
    assert goal.linked_account_id is None
    assert goal.completed_at is None
    assert goal.celebrated_at is None


@pytest.mark.asyncio
async def test_one_active_linked_goal_per_account(db_session):
    user = User(email="dup-goal@example.com", name="Dup", password_hash="x")
    db_session.add(user)
    await db_session.flush()

    acct = Account(
        user_id=user.id,
        name="Savings",
        institution_name="Chase",
        type="savings",
        balance=Decimal("0"),
        is_manual=True,
    )
    db_session.add(acct)
    await db_session.flush()

    g1 = SavingsGoal(
        user_id=user.id, name="A", target_amount=Decimal("100"),
        linked_account_id=acct.id,
    )
    db_session.add(g1)
    await db_session.commit()

    g2 = SavingsGoal(
        user_id=user.id, name="B", target_amount=Decimal("200"),
        linked_account_id=acct.id,
    )
    db_session.add(g2)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_completed_goal_frees_account_for_new_active_goal(db_session):
    user = User(email="free-slot@example.com", name="Free Slot", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    acct = Account(
        user_id=user.id, name="S", institution_name="Chase", type="savings",
        balance=Decimal("0"), is_manual=True,
    )
    db_session.add(acct)
    await db_session.flush()

    done = SavingsGoal(
        user_id=user.id, name="Old", target_amount=Decimal("50"),
        linked_account_id=acct.id, status="completed",
    )
    db_session.add(done)
    await db_session.commit()

    new = SavingsGoal(
        user_id=user.id, name="New", target_amount=Decimal("200"),
        linked_account_id=acct.id, status="active",
    )
    db_session.add(new)
    await db_session.commit()  # must NOT raise


@pytest.mark.asyncio
async def test_contribution_cascade_delete(db_session):
    user = User(email="c-cascade@example.com", name="Cascade", password_hash="x")
    db_session.add(user)
    await db_session.flush()

    goal = SavingsGoal(
        user_id=user.id, name="Cruise", target_amount=Decimal("500"),
    )
    db_session.add(goal)
    await db_session.flush()

    c = SavingsGoalContribution(
        goal_id=goal.id, contribution_date=date.today(), amount=Decimal("50"),
    )
    db_session.add(c)
    await db_session.commit()

    await db_session.delete(goal)
    await db_session.commit()

    remaining = await db_session.execute(select(SavingsGoalContribution))
    assert remaining.scalars().all() == []


@pytest.mark.asyncio
async def test_user_settings_has_notify_savings_goals(db_session):
    from src.models.user_settings import UserSettings
    user = User(email="us-ng@example.com", name="US", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    s = UserSettings(user_id=user.id)
    db_session.add(s)
    await db_session.commit()
    await db_session.refresh(s)
    assert s.notify_savings_goals is True
