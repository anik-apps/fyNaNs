import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    await client.post("/api/auth/register", json={
        "email": "device@example.com",
        "password": "SecurePass123!",
        "name": "Device User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "device@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_register_device_token(client: AsyncClient, auth_headers: dict):
    response = await client.post("/api/device-tokens", headers=auth_headers, json={
        "token": "ExponentPushToken[abc123]",
        "platform": "ios",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["token"] == "ExponentPushToken[abc123]"
    assert data["platform"] == "ios"


@pytest.mark.asyncio
async def test_register_duplicate_device_token(client: AsyncClient, auth_headers: dict):
    """Registering the same token twice should be idempotent."""
    await client.post("/api/device-tokens", headers=auth_headers, json={
        "token": "ExponentPushToken[dup123]",
        "platform": "ios",
    })
    response = await client.post("/api/device-tokens", headers=auth_headers, json={
        "token": "ExponentPushToken[dup123]",
        "platform": "ios",
    })
    # Should succeed (upsert or return existing)
    assert response.status_code in (200, 201)


@pytest.mark.asyncio
async def test_delete_device_token(client: AsyncClient, auth_headers: dict):
    create = await client.post("/api/device-tokens", headers=auth_headers, json={
        "token": "ExponentPushToken[del123]",
        "platform": "android",
    })
    token_id = create.json()["id"]

    response = await client.delete(
        f"/api/device-tokens/{token_id}", headers=auth_headers
    )
    assert response.status_code == 200
