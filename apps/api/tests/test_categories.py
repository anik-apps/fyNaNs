import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    await client.post("/api/auth/register", json={
        "email": "category@example.com",
        "password": "SecurePass123!",
        "name": "Category User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "category@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_list_categories(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/categories", headers=auth_headers)
    assert response.status_code == 200
    # Should include system categories (seeded) and any user-created ones
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_create_custom_category(client: AsyncClient, auth_headers: dict):
    response = await client.post("/api/categories", headers=auth_headers, json={
        "name": "Side Hustles",
        "icon": "dollar-sign",
        "color": "#10B981",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Side Hustles"
    assert data["is_system"] is False


@pytest.mark.asyncio
async def test_create_duplicate_category_fails(client: AsyncClient, auth_headers: dict):
    await client.post("/api/categories", headers=auth_headers, json={
        "name": "Duplicate Cat",
        "icon": "tag",
        "color": "#000000",
    })
    response = await client.post("/api/categories", headers=auth_headers, json={
        "name": "Duplicate Cat",
        "icon": "tag",
        "color": "#000000",
    })
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_update_category(client: AsyncClient, auth_headers: dict):
    create = await client.post("/api/categories", headers=auth_headers, json={
        "name": "Old Name",
        "icon": "tag",
        "color": "#FF0000",
    })
    cat_id = create.json()["id"]

    response = await client.put(f"/api/categories/{cat_id}", headers=auth_headers, json={
        "name": "New Name",
        "color": "#00FF00",
    })
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"
    assert response.json()["color"] == "#00FF00"


@pytest.mark.asyncio
async def test_delete_category(client: AsyncClient, auth_headers: dict):
    create = await client.post("/api/categories", headers=auth_headers, json={
        "name": "To Delete",
        "icon": "tag",
        "color": "#FF0000",
    })
    cat_id = create.json()["id"]

    response = await client.delete(f"/api/categories/{cat_id}", headers=auth_headers)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_cannot_delete_system_category(client: AsyncClient, auth_headers: dict, db_session):
    """System categories should not be deletable by users."""
    from src.models.category import Category
    from sqlalchemy import select

    result = await db_session.execute(
        select(Category).where(Category.is_system.is_(True)).limit(1)
    )
    system_cat = result.scalar_one_or_none()

    if system_cat:
        response = await client.delete(
            f"/api/categories/{system_cat.id}", headers=auth_headers
        )
        assert response.status_code == 403
