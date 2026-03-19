from datetime import date
from decimal import Decimal
from unittest.mock import patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.account import Account
from src.models.budget import Budget
from src.models.category import Category
from src.models.transaction import Transaction
from src.models.user import User
from src.models.user_settings import UserSettings


@pytest.mark.asyncio
@patch("src.jobs.budget_alerts.create_notification")
async def test_budget_alert_80_percent(mock_notif, db_session: AsyncSession):
    from src.jobs.budget_alerts import check_budget_alerts

    user = User(
        email="alert@example.com", name="Alert User", password_hash="fake"
    )
    db_session.add(user)
    await db_session.flush()

    settings = UserSettings(user_id=user.id)
    db_session.add(settings)

    cat = Category(
        user_id=user.id, name="Alert Food", icon="utensils", color="#F59E0B"
    )
    db_session.add(cat)
    await db_session.flush()

    account = Account(
        user_id=user.id,
        institution_name="Bank",
        name="Checking",
        type="checking",
        balance=5000,
        is_manual=True,
    )
    db_session.add(account)
    await db_session.flush()

    budget = Budget(
        user_id=user.id,
        category_id=cat.id,
        amount_limit=Decimal("200.00"),
        period="monthly",
    )
    db_session.add(budget)
    await db_session.flush()

    # Add transactions totaling $170 (85% of $200 budget)
    txn = Transaction(
        user_id=user.id,
        account_id=account.id,
        amount=Decimal("170.00"),
        date=date.today(),
        description="Groceries",
        category_id=cat.id,
        is_manual=True,
    )
    db_session.add(txn)
    await db_session.commit()

    mock_notif.return_value = None

    await check_budget_alerts(db_session)

    # Should trigger 80% alert
    assert mock_notif.call_count >= 1
    call_kwargs = mock_notif.call_args_list[0][1]
    assert call_kwargs["notif_type"] == "budget_80"


@pytest.mark.asyncio
@patch("src.jobs.budget_alerts.create_notification")
async def test_budget_alert_100_percent(mock_notif, db_session: AsyncSession):
    from src.jobs.budget_alerts import check_budget_alerts

    user = User(
        email="alert100@example.com", name="Alert100", password_hash="fake"
    )
    db_session.add(user)
    await db_session.flush()

    settings = UserSettings(user_id=user.id)
    db_session.add(settings)

    cat = Category(
        user_id=user.id, name="Alert100 Food", icon="utensils", color="#F59E0B"
    )
    db_session.add(cat)
    await db_session.flush()

    account = Account(
        user_id=user.id,
        institution_name="Bank",
        name="Checking",
        type="checking",
        balance=5000,
        is_manual=True,
    )
    db_session.add(account)
    await db_session.flush()

    budget = Budget(
        user_id=user.id,
        category_id=cat.id,
        amount_limit=Decimal("100.00"),
        period="monthly",
    )
    db_session.add(budget)
    await db_session.flush()

    # Add transactions totaling $110 (110% of $100 budget)
    txn = Transaction(
        user_id=user.id,
        account_id=account.id,
        amount=Decimal("110.00"),
        date=date.today(),
        description="Over budget",
        category_id=cat.id,
        is_manual=True,
    )
    db_session.add(txn)
    await db_session.commit()

    mock_notif.return_value = None

    await check_budget_alerts(db_session)

    # Should trigger both 80% and 100% alerts
    assert mock_notif.call_count >= 2
    types = [call[1]["notif_type"] for call in mock_notif.call_args_list]
    assert "budget_80" in types
    assert "budget_100" in types
