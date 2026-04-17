from datetime import date
from decimal import Decimal

import pytest

from src.models.account import Account
from src.models.savings_goal import SavingsGoal, SavingsGoalContribution
from src.models.user import User
from src.services.savings_goal import (
    SavingsGoalError,  # noqa: F401 — import smoke test for Task 4 consumers
    compute_current_amount,
    compute_pace_status,
    compute_required_monthly,
)


@pytest.mark.asyncio
async def test_compute_current_amount_linked(db_session):
    user = User(email="svc-linked@example.com", name="Svc", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    acct = Account(
        user_id=user.id, name="S", institution_name="Chase", type="savings",
        balance=Decimal("1234.56"), is_manual=True,
    )
    db_session.add(acct)
    await db_session.flush()
    g = SavingsGoal(
        user_id=user.id, name="t", target_amount=Decimal("10000"),
        linked_account_id=acct.id,
    )
    db_session.add(g)
    await db_session.flush()

    amt = await compute_current_amount(db_session, g)
    assert amt == Decimal("1234.56")


@pytest.mark.asyncio
async def test_compute_current_amount_negative_balance_clamped(db_session):
    user = User(email="svc-neg@example.com", name="Svc", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    acct = Account(
        user_id=user.id, name="S", institution_name="Chase", type="savings",
        balance=Decimal("-50"), is_manual=True,
    )
    db_session.add(acct)
    await db_session.flush()
    g = SavingsGoal(
        user_id=user.id, name="t", target_amount=Decimal("100"),
        linked_account_id=acct.id,
    )
    db_session.add(g)
    await db_session.flush()

    assert await compute_current_amount(db_session, g) == Decimal("0")


@pytest.mark.asyncio
async def test_compute_current_amount_unlinked_sums_contributions(db_session):
    user = User(email="svc-un@example.com", name="Svc", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    g = SavingsGoal(
        user_id=user.id, name="t", target_amount=Decimal("500"),
    )
    db_session.add(g)
    await db_session.flush()
    for amt in ("100.00", "50.00", "-10.00"):
        db_session.add(SavingsGoalContribution(
            goal_id=g.id, contribution_date=date.today(),
            amount=Decimal(amt),
        ))
    await db_session.flush()

    assert await compute_current_amount(db_session, g) == Decimal("140.00")


def test_required_monthly_none_when_no_target_date():
    assert compute_required_monthly(
        current=Decimal("0"), target=Decimal("100"), target_date=None,
        today=date(2026, 1, 1),
    ) is None


def test_required_monthly_none_when_target_passed():
    assert compute_required_monthly(
        current=Decimal("0"), target=Decimal("100"),
        target_date=date(2025, 1, 1), today=date(2026, 1, 1),
    ) is None


def test_required_monthly_basic():
    val = compute_required_monthly(
        current=Decimal("200"), target=Decimal("1400"),
        target_date=date(2026, 7, 1), today=date(2026, 1, 1),
    )
    assert val == Decimal("200.00")  # 1200 remaining / 6 months


def test_pace_status_null_when_required_none_and_no_target():
    assert compute_pace_status(
        actual_monthly=Decimal("0"), required_monthly=None,
        target_date=None, today=date(2026, 1, 1),
    ) is None


def test_pace_status_target_passed_overrides():
    assert compute_pace_status(
        actual_monthly=Decimal("999"),
        required_monthly=None,  # compute_required_monthly returns None for past date
        target_date=date(2025, 1, 1), today=date(2026, 1, 1),
    ).value == "target_passed"


def test_pace_status_behind_on_ahead():
    t = date(2026, 7, 1)
    today = date(2026, 1, 1)
    assert compute_pace_status(
        actual_monthly=Decimal("50"), required_monthly=Decimal("100"),
        target_date=t, today=today,
    ).value == "behind"
    assert compute_pace_status(
        actual_monthly=Decimal("80"), required_monthly=Decimal("100"),
        target_date=t, today=today,
    ).value == "on_pace"
    assert compute_pace_status(
        actual_monthly=Decimal("115"), required_monthly=Decimal("100"),
        target_date=t, today=today,
    ).value == "ahead"
