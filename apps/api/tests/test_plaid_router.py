from unittest.mock import patch, MagicMock

import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    await client.post("/api/auth/register", json={
        "email": "plaidrouter@example.com",
        "password": "SecurePass123!",
        "name": "Plaid Router User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "plaidrouter@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
@patch("src.routers.plaid.create_link_token")
async def test_create_link_token(mock_create, client: AsyncClient, auth_headers: dict):
    mock_create.return_value = {
        "link_token": "link-sandbox-123",
        "expiration": "2026-03-19T00:00:00Z",
    }

    response = await client.post("/api/plaid/link-token", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["link_token"] == "link-sandbox-123"


@pytest.mark.asyncio
async def test_create_link_token_unauthenticated(client: AsyncClient):
    response = await client.post("/api/plaid/link-token")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_plaid_items_empty(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/plaid/items", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []
