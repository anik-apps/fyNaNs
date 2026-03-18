import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_rate_limit(client: AsyncClient):
    # Register a user
    await client.post("/api/auth/register", json={
        "email": "ratelimit@example.com", "password": "SecurePass123!", "name": "Rate User"
    })

    # Attempt 6 logins (limit is 5/min)
    for _i in range(5):
        await client.post("/api/auth/login", json={
            "email": "ratelimit@example.com", "password": "wrong"
        })

    response = await client.post("/api/auth/login", json={
        "email": "ratelimit@example.com", "password": "wrong"
    })
    assert response.status_code == 429
