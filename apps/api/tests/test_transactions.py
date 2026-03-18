
import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_and_account(client: AsyncClient) -> tuple[dict, str]:
    """Register user, login, create account. Returns (headers, account_id)."""
    await client.post("/api/auth/register", json={
        "email": "txn@example.com",
        "password": "SecurePass123!",
        "name": "Txn User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "txn@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    acct = await client.post("/api/accounts", headers=headers, json={
        "institution_name": "Test Bank",
        "name": "Checking",
        "type": "checking",
        "balance": "1000.00",
    })
    return headers, acct.json()["id"]


@pytest.mark.asyncio
async def test_create_manual_transaction(client: AsyncClient, auth_and_account):
    headers, account_id = auth_and_account

    response = await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "25.50",
        "date": "2026-03-15",
        "description": "Coffee Shop",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == "25.50"
    assert data["description"] == "Coffee Shop"
    assert data["is_manual"] is True


@pytest.mark.asyncio
async def test_list_transactions(client: AsyncClient, auth_and_account):
    headers, account_id = auth_and_account

    # Create two transactions
    await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "10.00",
        "date": "2026-03-14",
        "description": "Purchase 1",
    })
    await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "20.00",
        "date": "2026-03-15",
        "description": "Purchase 2",
    })

    response = await client.get("/api/transactions", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    # Should be sorted by date DESC
    assert data["items"][0]["date"] == "2026-03-15"


@pytest.mark.asyncio
async def test_get_single_transaction(client: AsyncClient, auth_and_account):
    headers, account_id = auth_and_account

    create = await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "15.00",
        "date": "2026-03-15",
        "description": "Single",
    })
    txn_id = create.json()["id"]

    response = await client.get(f"/api/transactions/{txn_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["description"] == "Single"


@pytest.mark.asyncio
async def test_update_transaction(client: AsyncClient, auth_and_account):
    headers, account_id = auth_and_account

    create = await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "30.00",
        "date": "2026-03-15",
        "description": "Original",
    })
    txn_id = create.json()["id"]

    response = await client.put(f"/api/transactions/{txn_id}", headers=headers, json={
        "description": "Updated",
        "notes": "Added a note",
    })
    assert response.status_code == 200
    assert response.json()["description"] == "Updated"
    assert response.json()["notes"] == "Added a note"


@pytest.mark.asyncio
async def test_delete_transaction(client: AsyncClient, auth_and_account):
    headers, account_id = auth_and_account

    create = await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "5.00",
        "date": "2026-03-15",
        "description": "To Delete",
    })
    txn_id = create.json()["id"]

    response = await client.delete(f"/api/transactions/{txn_id}", headers=headers)
    assert response.status_code == 200

    get_resp = await client.get(f"/api/transactions/{txn_id}", headers=headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_list_transactions_with_filters(client: AsyncClient, auth_and_account):
    headers, account_id = auth_and_account

    await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "10.00",
        "date": "2026-03-01",
        "description": "March Start",
    })
    await client.post("/api/transactions", headers=headers, json={
        "account_id": account_id,
        "amount": "20.00",
        "date": "2026-03-15",
        "description": "March Middle",
    })

    # Filter by date range
    response = await client.get(
        "/api/transactions?date_from=2026-03-10&date_to=2026-03-20",
        headers=headers,
    )
    assert response.status_code == 200
    assert len(response.json()["items"]) == 1
    assert response.json()["items"][0]["description"] == "March Middle"
