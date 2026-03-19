from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    await client.post("/api/auth/register", json={
        "email": "export@example.com",
        "password": "SecurePass123!",
        "name": "Export User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "export@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
@patch("src.routers.user.generate_export")
async def test_request_export(mock_export, client: AsyncClient, auth_headers: dict):
    mock_export.return_value = None  # Async task, no immediate result

    response = await client.post("/api/user/export", headers=auth_headers)
    assert response.status_code == 202
    assert "export" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_export_unauthenticated(client: AsyncClient):
    response = await client.post("/api/user/export")
    assert response.status_code == 403
