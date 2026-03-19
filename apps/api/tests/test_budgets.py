import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_and_category(client: AsyncClient) -> tuple[dict, str]:
    """Register user, login, create category. Returns (headers, category_id)."""
    await client.post("/api/auth/register", json={
        "email": "budget@example.com",
        "password": "SecurePass123!",
        "name": "Budget User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "budget@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    cat = await client.post("/api/categories", headers=headers, json={
        "name": "Food Budget Cat",
        "icon": "utensils",
        "color": "#F59E0B",
    })
    return headers, cat.json()["id"]


@pytest.mark.asyncio
async def test_create_budget(client: AsyncClient, auth_and_category):
    headers, category_id = auth_and_category

    response = await client.post("/api/budgets", headers=headers, json={
        "category_id": category_id,
        "amount_limit": "500.00",
        "period": "monthly",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["amount_limit"] == "500.00"
    assert data["period"] == "monthly"
    assert data["category_id"] == category_id


@pytest.mark.asyncio
async def test_create_duplicate_budget_fails(client: AsyncClient, auth_and_category):
    headers, category_id = auth_and_category

    await client.post("/api/budgets", headers=headers, json={
        "category_id": category_id,
        "amount_limit": "500.00",
        "period": "monthly",
    })
    response = await client.post("/api/budgets", headers=headers, json={
        "category_id": category_id,
        "amount_limit": "600.00",
        "period": "monthly",
    })
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_list_budgets(client: AsyncClient, auth_and_category):
    headers, category_id = auth_and_category

    await client.post("/api/budgets", headers=headers, json={
        "category_id": category_id,
        "amount_limit": "500.00",
        "period": "monthly",
    })

    response = await client.get("/api/budgets", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert "current_spend" in data[0]


@pytest.mark.asyncio
async def test_update_budget(client: AsyncClient, auth_and_category):
    headers, category_id = auth_and_category

    create = await client.post("/api/budgets", headers=headers, json={
        "category_id": category_id,
        "amount_limit": "500.00",
        "period": "monthly",
    })
    budget_id = create.json()["id"]

    response = await client.put(f"/api/budgets/{budget_id}", headers=headers, json={
        "amount_limit": "750.00",
    })
    assert response.status_code == 200
    assert response.json()["amount_limit"] == "750.00"


@pytest.mark.asyncio
async def test_delete_budget(client: AsyncClient, auth_and_category):
    headers, category_id = auth_and_category

    create = await client.post("/api/budgets", headers=headers, json={
        "category_id": category_id,
        "amount_limit": "500.00",
        "period": "monthly",
    })
    budget_id = create.json()["id"]

    response = await client.delete(f"/api/budgets/{budget_id}", headers=headers)
    assert response.status_code == 200

    list_resp = await client.get("/api/budgets", headers=headers)
    assert len(list_resp.json()) == 0
