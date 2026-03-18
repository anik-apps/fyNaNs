import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_password_reset_request(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "reset@example.com", "password": "OldPass123!", "name": "Reset User"
    })
    response = await client.post("/api/auth/password/reset-request", json={
        "email": "reset@example.com"
    })
    # Should always return 200 (don't reveal if email exists)
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_password_reset_request_nonexistent(client: AsyncClient):
    response = await client.post("/api/auth/password/reset-request", json={
        "email": "nonexistent@example.com"
    })
    # Should still return 200 to not reveal if email exists
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_password_reset_invalid_token(client: AsyncClient):
    response = await client.post("/api/auth/password/reset", json={
        "token": "invalid-token",
        "new_password": "NewSecurePass123!"
    })
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_password_set_for_oauth_user(client: AsyncClient):
    # This test requires an OAuth-created user, will be a more integrated test
    pass
