import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    await client.post("/api/auth/register", json={
        "email": "accounts@example.com",
        "password": "SecurePass123!",
        "name": "Accounts User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "accounts@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_manual_account(client: AsyncClient, auth_headers: dict):
    response = await client.post("/api/accounts", headers=auth_headers, json={
        "institution_name": "My Bank",
        "name": "Savings",
        "type": "savings",
        "balance": "5000.00",
        "currency": "USD",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Savings"
    assert data["type"] == "savings"
    assert data["is_manual"] is True
    assert data["balance"] == "5000.00"


@pytest.mark.asyncio
async def test_list_accounts(client: AsyncClient, auth_headers: dict):
    # Create two accounts
    await client.post("/api/accounts", headers=auth_headers, json={
        "institution_name": "Bank A",
        "name": "Checking",
        "type": "checking",
        "balance": "1000.00",
    })
    await client.post("/api/accounts", headers=auth_headers, json={
        "institution_name": "Bank B",
        "name": "Credit Card",
        "type": "credit",
        "balance": "250.00",
    })

    response = await client.get("/api/accounts", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_update_account(client: AsyncClient, auth_headers: dict):
    create = await client.post("/api/accounts", headers=auth_headers, json={
        "institution_name": "Bank",
        "name": "Old Name",
        "type": "checking",
        "balance": "100.00",
    })
    account_id = create.json()["id"]

    response = await client.put(f"/api/accounts/{account_id}", headers=auth_headers, json={
        "name": "New Name",
        "balance": "200.00",
    })
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"
    assert response.json()["balance"] == "200.00"


@pytest.mark.asyncio
async def test_delete_account(client: AsyncClient, auth_headers: dict):
    create = await client.post("/api/accounts", headers=auth_headers, json={
        "institution_name": "Bank",
        "name": "To Delete",
        "type": "checking",
        "balance": "0",
    })
    account_id = create.json()["id"]

    response = await client.delete(f"/api/accounts/{account_id}", headers=auth_headers)
    assert response.status_code == 200

    # Verify deleted
    list_resp = await client.get("/api/accounts", headers=auth_headers)
    ids = [a["id"] for a in list_resp.json()]
    assert account_id not in ids


@pytest.mark.asyncio
async def test_get_account_balance(client: AsyncClient, auth_headers: dict):
    create = await client.post("/api/accounts", headers=auth_headers, json={
        "institution_name": "Bank",
        "name": "Balance Check",
        "type": "checking",
        "balance": "3500.75",
    })
    account_id = create.json()["id"]

    response = await client.get(f"/api/accounts/{account_id}/balance", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["balance"] == "3500.75"


@pytest.mark.asyncio
async def test_delete_account_not_found(client: AsyncClient, auth_headers: dict):
    import uuid
    response = await client.delete(
        f"/api/accounts/{uuid.uuid4()}", headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_account_cascades_transactions(client: AsyncClient, auth_headers: dict):
    """Deleting an account should cascade-delete its transactions."""
    create = await client.post("/api/accounts", headers=auth_headers, json={
        "institution_name": "Cascade Bank",
        "name": "Cascade Test",
        "type": "checking",
        "balance": "1000.00",
    })
    account_id = create.json()["id"]

    # Create a transaction on this account
    txn = await client.post("/api/transactions", headers=auth_headers, json={
        "account_id": account_id,
        "amount": "50.00",
        "date": "2026-03-15",
        "description": "Cascade Test Txn",
    })
    txn_id = txn.json()["id"]

    # Delete the account
    response = await client.delete(f"/api/accounts/{account_id}", headers=auth_headers)
    assert response.status_code == 200

    # Verify transaction was cascade-deleted
    txn_resp = await client.get(f"/api/transactions/{txn_id}", headers=auth_headers)
    assert txn_resp.status_code == 404
