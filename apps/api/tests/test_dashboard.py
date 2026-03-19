from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import (
    create_test_account,
    create_test_bill,
    create_test_budget,
    create_test_category,
    create_test_transaction,
)


@pytest.fixture
async def user_and_headers(client: AsyncClient, db_session: AsyncSession):
    """Create a user directly in the DB and get an auth token via the API."""
    # Register via API so password hashing works correctly
    email = "dashboard-test@example.com"
    password = "SecurePass123!"
    await client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "name": "Dashboard Test User",
    })
    login = await client.post("/api/auth/login", json={
        "email": email,
        "password": password,
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get the user from DB for the user_id
    from sqlalchemy import select

    from src.models.user import User
    result = await db_session.execute(select(User).where(User.email == email))
    user = result.scalar_one()
    return user, headers


@pytest.mark.asyncio
async def test_dashboard_unauthenticated(client: AsyncClient):
    """Dashboard requires authentication."""
    response = await client.get("/api/dashboard")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_dashboard_empty_user(client: AsyncClient, user_and_headers):
    """Dashboard returns zero values for user with no data."""
    _user, headers = user_and_headers
    response = await client.get("/api/dashboard", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["net_worth"]["total_assets"] == "0"
    assert data["net_worth"]["total_liabilities"] == "0"
    assert data["net_worth"]["net_worth"] == "0"
    assert data["recent_transactions"] == []
    assert data["top_budgets"] == []
    assert data["upcoming_bills"] == []


@pytest.mark.asyncio
async def test_dashboard_net_worth_calculation(
    client: AsyncClient, db_session: AsyncSession, user_and_headers,
):
    """Net worth = assets - liabilities."""
    user, headers = user_and_headers
    await create_test_account(
        db_session, user.id, name="Checking", type="checking", balance=Decimal("5000.00")
    )
    await create_test_account(
        db_session, user.id, name="Savings", type="savings", balance=Decimal("10000.00")
    )
    await create_test_account(
        db_session, user.id, name="Credit Card", type="credit", balance=Decimal("2000.00")
    )

    response = await client.get("/api/dashboard", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert Decimal(data["net_worth"]["total_assets"]) == Decimal("15000.00")
    assert Decimal(data["net_worth"]["total_liabilities"]) == Decimal("2000.00")
    assert Decimal(data["net_worth"]["net_worth"]) == Decimal("13000.00")


@pytest.mark.asyncio
async def test_dashboard_recent_transactions_limit(
    client: AsyncClient, db_session: AsyncSession, user_and_headers,
):
    """Dashboard returns at most 10 recent transactions."""
    user, headers = user_and_headers
    category = await create_test_category(db_session, user_id=user.id)
    account = await create_test_account(db_session, user.id)

    # Create 15 transactions
    for i in range(15):
        await create_test_transaction(
            db_session,
            user.id,
            account.id,
            category.id,
            description=f"Txn {i}",
            date=date.today() - timedelta(days=i),
        )

    response = await client.get("/api/dashboard", headers=headers)
    data = response.json()
    assert len(data["recent_transactions"]) == 10


@pytest.mark.asyncio
async def test_dashboard_upcoming_bills_within_7_days(
    client: AsyncClient, db_session: AsyncSession, user_and_headers,
):
    """Only bills due within 7 days appear."""
    user, headers = user_and_headers
    # Bill due in 3 days (should appear)
    await create_test_bill(
        db_session, user.id, name="Netflix", next_due_date=date.today() + timedelta(days=3)
    )
    # Bill due in 14 days (should NOT appear)
    await create_test_bill(
        db_session, user.id, name="Gym", next_due_date=date.today() + timedelta(days=14)
    )

    response = await client.get("/api/dashboard", headers=headers)
    data = response.json()
    assert len(data["upcoming_bills"]) == 1
    assert data["upcoming_bills"][0]["name"] == "Netflix"


@pytest.mark.asyncio
async def test_dashboard_budget_percent_spent(
    client: AsyncClient, db_session: AsyncSession, user_and_headers,
):
    """Budget shows correct percent spent."""
    user, headers = user_and_headers
    category = await create_test_category(db_session, user_id=user.id, name="Food")
    account = await create_test_account(db_session, user.id)
    await create_test_budget(
        db_session, user.id, category.id, amount_limit=Decimal("200.00")
    )
    # Spend $50 this month
    await create_test_transaction(
        db_session, user.id, account.id, category.id, amount=Decimal("50.00")
    )

    response = await client.get("/api/dashboard", headers=headers)
    data = response.json()
    assert len(data["top_budgets"]) == 1
    assert data["top_budgets"][0]["percent_spent"] == 25.0


@pytest.mark.asyncio
async def test_dashboard_budget_weekly_period(
    client: AsyncClient, db_session: AsyncSession, user_and_headers,
):
    """Weekly budget only counts spending since start of current week (Monday)."""
    user, headers = user_and_headers
    category = await create_test_category(db_session, user_id=user.id, name="Coffee")
    account = await create_test_account(db_session, user.id)
    await create_test_budget(
        db_session, user.id, category.id,
        amount_limit=Decimal("50.00"), period="weekly",
    )
    # Spend $20 today (should count)
    await create_test_transaction(
        db_session, user.id, account.id, category.id,
        amount=Decimal("20.00"), date=date.today(),
    )
    # Spend $30 eight days ago (should NOT count -- previous week)
    await create_test_transaction(
        db_session, user.id, account.id, category.id,
        amount=Decimal("30.00"), date=date.today() - timedelta(days=8),
    )

    response = await client.get("/api/dashboard", headers=headers)
    data = response.json()
    assert len(data["top_budgets"]) == 1
    assert data["top_budgets"][0]["period"] == "weekly"
    assert data["top_budgets"][0]["percent_spent"] == 40.0


@pytest.mark.asyncio
async def test_dashboard_budget_yearly_period(
    client: AsyncClient, db_session: AsyncSession, user_and_headers,
):
    """Yearly budget counts spending since January 1 of the current year."""
    user, headers = user_and_headers
    category = await create_test_category(db_session, user_id=user.id, name="Travel")
    account = await create_test_account(db_session, user.id)
    await create_test_budget(
        db_session, user.id, category.id,
        amount_limit=Decimal("1000.00"), period="yearly",
    )
    # Spend $300 this month (should count)
    await create_test_transaction(
        db_session, user.id, account.id, category.id,
        amount=Decimal("300.00"), date=date.today(),
    )
    # Spend $200 in January of this year (should count)
    await create_test_transaction(
        db_session, user.id, account.id, category.id,
        amount=Decimal("200.00"), date=date(date.today().year, 1, 15),
    )

    response = await client.get("/api/dashboard", headers=headers)
    data = response.json()
    assert len(data["top_budgets"]) == 1
    assert data["top_budgets"][0]["period"] == "yearly"
    assert data["top_budgets"][0]["percent_spent"] == 50.0


@pytest.mark.asyncio
async def test_dashboard_spending_comparison(
    client: AsyncClient, db_session: AsyncSession, user_and_headers,
):
    """Spending comparison returns current vs previous month totals."""
    user, headers = user_and_headers
    category = await create_test_category(db_session, user_id=user.id)
    account = await create_test_account(db_session, user.id)

    # This month: $100
    await create_test_transaction(
        db_session, user.id, account.id, category.id,
        amount=Decimal("100.00"), date=date.today(),
    )

    # Last month: $200
    last_month = date.today().replace(day=15)
    if last_month.month == 1:
        last_month = last_month.replace(year=last_month.year - 1, month=12)
    else:
        last_month = last_month.replace(month=last_month.month - 1)
    await create_test_transaction(
        db_session, user.id, account.id, category.id,
        amount=Decimal("200.00"), date=last_month,
    )

    response = await client.get("/api/dashboard", headers=headers)
    data = response.json()
    assert Decimal(data["spending_comparison"]["current_month_total"]) == Decimal("100.00")
    assert Decimal(data["spending_comparison"]["previous_month_total"]) == Decimal("200.00")
