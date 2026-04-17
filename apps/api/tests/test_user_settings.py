import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    await client.post("/api/auth/register", json={
        "email": "settings@example.com", "password": "SecurePass123!", "name": "Settings User"
    })
    login = await client.post("/api/auth/login", json={
        "email": "settings@example.com", "password": "SecurePass123!"
    })
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_get_settings(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/user/settings", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["theme"] == "system"
    assert response.json()["notify_bill_reminders"] is True


@pytest.mark.asyncio
async def test_update_settings(client: AsyncClient, auth_headers: dict):
    response = await client.put("/api/user/settings", headers=auth_headers, json={
        "theme": "dark",
        "notify_push": False,
    })
    assert response.status_code == 200
    assert response.json()["theme"] == "dark"
    assert response.json()["notify_push"] is False


@pytest.mark.asyncio
async def test_update_notify_savings_goals(client: AsyncClient, auth_headers: dict):
    # Default should be True
    get_resp = await client.get("/api/user/settings", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["notify_savings_goals"] is True

    # Toggle to False via PUT
    update_resp = await client.put(
        "/api/user/settings",
        headers=auth_headers,
        json={"notify_savings_goals": False},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["notify_savings_goals"] is False

    # Read back to confirm persistence
    reread = await client.get("/api/user/settings", headers=auth_headers)
    assert reread.status_code == 200
    assert reread.json()["notify_savings_goals"] is False
