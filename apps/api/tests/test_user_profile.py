import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    await client.post("/auth/register", json={
        "email": "profile@example.com", "password": "SecurePass123!", "name": "Profile User"
    })
    login = await client.post("/auth/login", json={
        "email": "profile@example.com", "password": "SecurePass123!"
    })
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_get_profile(client: AsyncClient, auth_headers: dict):
    response = await client.get("/user/profile", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == "profile@example.com"


@pytest.mark.asyncio
async def test_update_profile(client: AsyncClient, auth_headers: dict):
    response = await client.put("/user/profile", headers=auth_headers, json={
        "name": "Updated Name"
    })
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"
