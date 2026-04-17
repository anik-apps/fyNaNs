from datetime import date, timedelta
from decimal import Decimal

import pytest

from src.models.savings_goal import SavingsGoal, SavingsGoalContribution
from src.models.user import User
from src.services.dashboard import get_dashboard


@pytest.mark.asyncio
async def test_dashboard_includes_top_goals_and_count(db_session):
    user = User(email="dash-g@example.com", name="Dash", password_hash="x")
    db_session.add(user)
    await db_session.flush()

    for i, name in enumerate(["a", "b", "c", "d"]):
        db_session.add(SavingsGoal(
            user_id=user.id, name=name,
            target_amount=Decimal(str((i + 1) * 100)),
            status="active",
        ))
    db_session.add(SavingsGoal(
        user_id=user.id, name="old", target_amount=Decimal("1"),
        status="archived",
    ))
    await db_session.commit()

    # get_dashboard takes user_id as str (matches existing sig in services/dashboard.py)
    resp = await get_dashboard(db_session, str(user.id), today=date(2026, 4, 16))
    assert resp.active_goals_count == 4
    assert len(resp.top_goals) == 3  # capped at 3


@pytest.mark.asyncio
async def test_top_goals_sort_order_by_pace(db_session):
    """Goals must be ordered: behind -> on_pace -> ahead (pace_rank asc)."""
    user = User(email="dash-sort@example.com", name="Sort", password_hash="x")
    db_session.add(user)
    await db_session.flush()

    today = date(2026, 4, 16)
    target_date = today + timedelta(days=180)  # ~6 months out
    contribution_date = date(2026, 4, 10)  # within 30-day rolling window

    # Create goals in a mixed order so sort order is meaningful.
    # BEHIND: target=1200, current=50 → actual_monthly ~50.73, required ~191.67.
    behind_goal = SavingsGoal(
        user_id=user.id, name="behind-goal",
        target_amount=Decimal("1200"), target_date=target_date, status="active",
    )
    # AHEAD: target=1200, current=250 → actual_monthly ~253.67, required ~158.33.
    ahead_goal = SavingsGoal(
        user_id=user.id, name="ahead-goal",
        target_amount=Decimal("1200"), target_date=target_date, status="active",
    )
    # ON_PACE: target=1200, current=180 → actual_monthly ~182.64, required =170.
    on_pace_goal = SavingsGoal(
        user_id=user.id, name="on-pace-goal",
        target_amount=Decimal("1200"), target_date=target_date, status="active",
    )
    # Insert in an order that is NOT the expected sort order, to catch
    # regressions where the sort key is insertion order.
    db_session.add(ahead_goal)
    db_session.add(on_pace_goal)
    db_session.add(behind_goal)
    await db_session.flush()

    db_session.add(SavingsGoalContribution(
        goal_id=behind_goal.id, contribution_date=contribution_date,
        amount=Decimal("50"),
    ))
    db_session.add(SavingsGoalContribution(
        goal_id=on_pace_goal.id, contribution_date=contribution_date,
        amount=Decimal("180"),
    ))
    db_session.add(SavingsGoalContribution(
        goal_id=ahead_goal.id, contribution_date=contribution_date,
        amount=Decimal("250"),
    ))
    await db_session.commit()

    resp = await get_dashboard(db_session, str(user.id), today=today)
    assert resp.active_goals_count == 3
    names = [g.name for g in resp.top_goals]
    assert names == ["behind-goal", "on-pace-goal", "ahead-goal"]
    pace_values = [g.pace_status for g in resp.top_goals]
    assert pace_values == ["behind", "on_pace", "ahead"]


@pytest.mark.asyncio
async def test_top_goals_user_isolation(db_session):
    """Dashboard only returns goals for the requested user."""
    user_a = User(email="dash-a@example.com", name="UserA", password_hash="x")
    user_b = User(email="dash-b@example.com", name="UserB", password_hash="x")
    db_session.add(user_a)
    db_session.add(user_b)
    await db_session.flush()

    db_session.add(SavingsGoal(
        user_id=user_a.id, name="a-goal",
        target_amount=Decimal("500"), status="active",
    ))
    db_session.add(SavingsGoal(
        user_id=user_b.id, name="b-goal",
        target_amount=Decimal("500"), status="active",
    ))
    await db_session.commit()

    resp = await get_dashboard(db_session, str(user_a.id), today=date(2026, 4, 16))
    assert resp.active_goals_count == 1
    assert len(resp.top_goals) == 1
    assert resp.top_goals[0].name == "a-goal"


@pytest.mark.asyncio
async def test_top_goals_empty_when_no_active_goals(db_session):
    """User with only archived/completed goals has empty top_goals and zero count."""
    user = User(email="dash-empty@example.com", name="Empty", password_hash="x")
    db_session.add(user)
    await db_session.flush()

    db_session.add(SavingsGoal(
        user_id=user.id, name="archived-goal",
        target_amount=Decimal("100"), status="archived",
    ))
    db_session.add(SavingsGoal(
        user_id=user.id, name="completed-goal",
        target_amount=Decimal("100"), status="completed",
    ))
    await db_session.commit()

    resp = await get_dashboard(db_session, str(user.id), today=date(2026, 4, 16))
    assert resp.active_goals_count == 0
    assert resp.top_goals == []
