from datetime import date

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _period_params() -> dict[str, str]:
    """Return query-string params covering the current calendar month."""
    today = date.today()
    period_start = date(today.year, today.month, 1).isoformat()
    period_end = today.isoformat()
    return {"period_start": period_start, "period_end": period_end}


def _day(n: int) -> str:
    """Return an ISO date string for day *n* of the current month (clamped to today)."""
    today = date.today()
    return date(today.year, today.month, min(n, today.day)).isoformat()


# ---------------------------------------------------------------------------
# transaction_summary — Test 1: correct data with multiple categories
# ---------------------------------------------------------------------------

@pytest.fixture
async def summary_multi_category(client: AsyncClient) -> dict:
    """User with Food (3 txns / $80) + Transport (2 txns / $45) + 1 uncategorised ($10)."""
    await client.post("/api/auth/register", json={
        "email": "summary_multi@example.com",
        "password": "SecurePass123!",
        "name": "Summary Multi User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "summary_multi@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    acct = await client.post("/api/accounts", headers=headers, json={
        "institution_name": "Multi Bank",
        "name": "Checking",
        "type": "checking",
        "balance": "10000.00",
    })
    account_id = acct.json()["id"]

    food_cat = await client.post("/api/categories", headers=headers, json={
        "name": "Food",
        "icon": "utensils",
        "color": "#FF0000",
    })
    food_id = food_cat.json()["id"]

    transport_cat = await client.post("/api/categories", headers=headers, json={
        "name": "Transport",
        "icon": "car",
        "color": "#0000FF",
    })
    transport_id = transport_cat.json()["id"]

    # Food transactions: $30 + $25 + $25 = $80
    for amount, day in [("30.00", 2), ("25.00", 4), ("25.00", 6)]:
        await client.post("/api/transactions", headers=headers, json={
            "account_id": account_id,
            "amount": amount,
            "date": _day(day),
            "description": "Food purchase",
            "category_id": food_id,
        })

    # Transport transactions: $20 + $25 = $45
    for amount, day in [("20.00", 3), ("25.00", 7)]:
        await client.post("/api/transactions", headers=headers, json={
            "account_id": account_id,
            "amount": amount,
            "date": _day(day),
            "description": "Transport purchase",
            "category_id": transport_id,
        })

    # Uncategorised transaction: $10
    await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "10.00",
        "date": _day(5),
        "description": "Unknown purchase",
    })

    return {"headers": headers}


@pytest.mark.asyncio
async def test_transaction_summary_multiple_categories(
    client: AsyncClient,
    summary_multi_category: dict,
):
    headers = summary_multi_category["headers"]
    params = _period_params()

    resp = await client.get(
        "/api/transactions/summary",
        headers=headers,
        params=params,
    )
    assert resp.status_code == 200

    data = resp.json()
    items = data["items"]

    # 3 groups: Food, Transport, uncategorised
    assert len(items) == 3

    by_name: dict[str | None, dict] = {item["category_name"]: item for item in items}

    food = by_name["Food"]
    assert food["count"] == 3
    assert food["total"] == "80.00"

    transport = by_name["Transport"]
    assert transport["count"] == 2
    assert transport["total"] == "45.00"

    uncategorised = by_name[None]
    assert uncategorised["count"] == 1


# ---------------------------------------------------------------------------
# transaction_summary — Test 2: no transactions → empty items
# ---------------------------------------------------------------------------

@pytest.fixture
async def summary_empty_user(client: AsyncClient) -> dict:
    """A freshly registered user with no transactions."""
    await client.post("/api/auth/register", json={
        "email": "summary_empty@example.com",
        "password": "SecurePass123!",
        "name": "Summary Empty User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "summary_empty@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return {"headers": headers}


@pytest.mark.asyncio
async def test_transaction_summary_empty(
    client: AsyncClient,
    summary_empty_user: dict,
):
    headers = summary_empty_user["headers"]
    params = _period_params()

    resp = await client.get(
        "/api/transactions/summary",
        headers=headers,
        params=params,
    )
    assert resp.status_code == 200
    assert resp.json()["items"] == []


# ---------------------------------------------------------------------------
# budgets — Test 3: correct spend and category info for multiple budgets
# ---------------------------------------------------------------------------

@pytest.fixture
async def budgets_multi(client: AsyncClient) -> dict:
    """User with Food ($200 budget, $80 spend) and Transport ($100 budget, $45 spend)."""
    await client.post("/api/auth/register", json={
        "email": "budgets_multi@example.com",
        "password": "SecurePass123!",
        "name": "Budgets Multi User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "budgets_multi@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    acct = await client.post("/api/accounts", headers=headers, json={
        "institution_name": "Budget Bank",
        "name": "Checking",
        "type": "checking",
        "balance": "10000.00",
    })
    account_id = acct.json()["id"]

    food_cat = await client.post("/api/categories", headers=headers, json={
        "name": "Food",
        "icon": "utensils",
        "color": "#F00",
    })
    food_id = food_cat.json()["id"]

    transport_cat = await client.post("/api/categories", headers=headers, json={
        "name": "Transport",
        "icon": "car",
        "color": "#0F0",
    })
    transport_id = transport_cat.json()["id"]

    await client.post("/api/budgets", headers=headers, json={
        "category_id": food_id,
        "amount_limit": "200.00",
        "period": "monthly",
    })
    await client.post("/api/budgets", headers=headers, json={
        "category_id": transport_id,
        "amount_limit": "100.00",
        "period": "monthly",
    })

    # Food: $30 + $25 + $25 = $80
    for amount, day in [("30.00", 2), ("25.00", 4), ("25.00", 6)]:
        await client.post("/api/transactions", headers=headers, json={
            "account_id": account_id,
            "amount": amount,
            "date": _day(day),
            "description": "Food purchase",
            "category_id": food_id,
        })

    # Transport: $20 + $25 = $45
    for amount, day in [("20.00", 3), ("25.00", 7)]:
        await client.post("/api/transactions", headers=headers, json={
            "account_id": account_id,
            "amount": amount,
            "date": _day(day),
            "description": "Transport purchase",
            "category_id": transport_id,
        })

    return {"headers": headers, "food_id": food_id, "transport_id": transport_id}


@pytest.mark.asyncio
async def test_budgets_spend_and_category_info(
    client: AsyncClient,
    budgets_multi: dict,
):
    headers = budgets_multi["headers"]

    resp = await client.get("/api/budgets", headers=headers)
    assert resp.status_code == 200

    budgets = resp.json()
    assert len(budgets) == 2

    by_name = {b["category_name"]: b for b in budgets}

    food = by_name["Food"]
    assert food["category_color"] == "#F00"
    assert food["current_spend"] == "80.00"

    transport = by_name["Transport"]
    assert transport["category_color"] == "#0F0"
    assert transport["current_spend"] == "45.00"


# ---------------------------------------------------------------------------
# budgets — Test 4: no budgets → empty list
# ---------------------------------------------------------------------------

@pytest.fixture
async def budgets_empty_user(client: AsyncClient) -> dict:
    """A freshly registered user with no budgets."""
    await client.post("/api/auth/register", json={
        "email": "budgets_empty@example.com",
        "password": "SecurePass123!",
        "name": "Budgets Empty User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "budgets_empty@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return {"headers": headers}


@pytest.mark.asyncio
async def test_budgets_empty(
    client: AsyncClient,
    budgets_empty_user: dict,
):
    headers = budgets_empty_user["headers"]

    resp = await client.get("/api/budgets", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []
