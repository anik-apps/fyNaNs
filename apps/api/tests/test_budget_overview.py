from datetime import date

import pytest
from httpx import AsyncClient


@pytest.fixture
async def setup_budget_with_transactions(client: AsyncClient) -> dict:
    """Register user, create account, category, budget, and some transactions."""
    await client.post("/api/auth/register", json={
        "email": "overview@example.com",
        "password": "SecurePass123!",
        "name": "Overview User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "overview@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create account
    acct = await client.post("/api/accounts", headers=headers, json={
        "institution_name": "Overview Bank",
        "name": "Checking",
        "type": "checking",
        "balance": "5000.00",
    })
    account_id = acct.json()["id"]

    # Create category
    cat = await client.post("/api/categories", headers=headers, json={
        "name": "Overview Food",
        "icon": "utensils",
        "color": "#F59E0B",
    })
    category_id = cat.json()["id"]

    # Create budget
    await client.post("/api/budgets", headers=headers, json={
        "category_id": category_id,
        "amount_limit": "200.00",
        "period": "monthly",
    })

    # Create transactions in current month (use relative dates so test doesn't rot)
    today = date.today()
    day5 = date(today.year, today.month, min(5, today.day)).isoformat()
    day10 = date(today.year, today.month, min(10, today.day)).isoformat()
    await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "50.00",
        "date": day5,
        "description": "Groceries",
        "category_id": category_id,
    })
    await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "30.00",
        "date": day10,
        "description": "Restaurant",
        "category_id": category_id,
    })

    return headers


@pytest.mark.asyncio
async def test_budget_overview(client: AsyncClient, setup_budget_with_transactions):
    headers = setup_budget_with_transactions

    response = await client.get("/api/budgets/overview", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1

    budget = data[0]
    assert "amount_limit" in budget
    assert "current_spend" in budget
    assert "percent_spent" in budget
    assert float(budget["current_spend"]) == 80.00
    assert float(budget["percent_spent"]) == 40.0  # 80/200 = 40%
