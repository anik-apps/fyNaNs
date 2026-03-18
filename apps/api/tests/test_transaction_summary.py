import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_and_account(client: AsyncClient) -> tuple[dict, str]:
    await client.post("/api/auth/register", json={
        "email": "summary@example.com",
        "password": "SecurePass123!",
        "name": "Summary User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "summary@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    acct = await client.post("/api/accounts", headers=headers, json={
        "institution_name": "Summary Bank",
        "name": "Checking",
        "type": "checking",
        "balance": "5000.00",
    })
    return headers, acct.json()["id"]


@pytest.mark.asyncio
async def test_transaction_summary(client: AsyncClient, auth_and_account):
    headers, account_id = auth_and_account

    # Create some transactions
    await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "50.00",
        "date": "2026-03-01",
        "description": "Grocery",
    })
    await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "30.00",
        "date": "2026-03-05",
        "description": "Gas",
    })
    await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "-2000.00",
        "date": "2026-03-01",
        "description": "Salary",
    })

    response = await client.get(
        "/api/transactions/summary?period_start=2026-03-01&period_end=2026-03-31",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["period_start"] == "2026-03-01"
    assert data["period_end"] == "2026-03-31"
    # Total spending = 50 + 30 = 80 (positive amounts)
    assert float(data["total_spending"]) == 80.00
    # Total income = 2000 (negative amounts = income)
    assert float(data["total_income"]) == 2000.00


@pytest.mark.asyncio
async def test_transaction_summary_empty(client: AsyncClient, auth_and_account):
    headers, _ = auth_and_account

    response = await client.get(
        "/api/transactions/summary?period_start=2026-01-01&period_end=2026-01-31",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_spending"] == "0.00"
    assert data["total_income"] == "0.00"
    assert data["items"] == []
