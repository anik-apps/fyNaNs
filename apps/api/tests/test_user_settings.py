import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    await client.post("/auth/register", json={
        "email": "settings@example.com", "password": "SecurePass123!", "name": "Settings User"
    })
    login = await client.post("/auth/login", json={
        "email": "settings@example.com", "password": "SecurePass123!"
    })
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_get_settings(client: AsyncClient, auth_headers: dict):
    response = await client.get("/user/settings", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["theme"] == "system"
    assert response.json()["notify_bill_reminders"] is True


@pytest.mark.asyncio
async def test_update_settings(client: AsyncClient, auth_headers: dict):
    response = await client.put("/user/settings", headers=auth_headers, json={
        "theme": "dark",
        "notify_push": False,
    })
    assert response.status_code == 200
    assert response.json()["theme"] == "dark"
    assert response.json()["notify_push"] is False
