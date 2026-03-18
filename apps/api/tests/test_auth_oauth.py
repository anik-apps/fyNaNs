import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_oauth_google_requires_token(client: AsyncClient):
    response = await client.post("/api/auth/oauth/google", json={})
    assert response.status_code == 422  # Missing id_token field


@pytest.mark.asyncio
async def test_oauth_unknown_provider(client: AsyncClient):
    response = await client.post("/api/auth/oauth/unknown", json={"id_token": "fake"})
    assert response.status_code == 400
