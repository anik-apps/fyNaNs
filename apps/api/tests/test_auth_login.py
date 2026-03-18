import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "login@example.com",
        "password": "SecurePass123!",
        "name": "Login User",
    })
    response = await client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "SecurePass123!",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["mfa_required"] is False


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "wrong@example.com",
        "password": "SecurePass123!",
        "name": "User",
    })
    response = await client.post("/api/auth/login", json={
        "email": "wrong@example.com",
        "password": "WrongPassword!",
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    response = await client.post("/api/auth/login", json={
        "email": "nobody@example.com",
        "password": "whatever",
    })
    assert response.status_code == 401
