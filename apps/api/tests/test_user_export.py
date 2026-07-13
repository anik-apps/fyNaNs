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
@patch("src.routers.user.build_and_send_export")
@patch("src.routers.user.collect_export_data")
async def test_request_export(
    mock_collect, mock_build, client: AsyncClient, auth_headers: dict
):
    mock_collect.return_value = {}  # Async task, no immediate result

    response = await client.post("/api/user/export", headers=auth_headers)
    assert response.status_code == 202
    assert "export" in response.json()["detail"].lower()


@pytest.mark.asyncio
@patch("src.routers.user.build_and_send_export")
@patch("src.routers.user.collect_export_data")
async def test_second_export_rate_limited(
    mock_collect, mock_build, client: AsyncClient, auth_headers: dict
):
    mock_collect.return_value = {}

    first = await client.post("/api/user/export", headers=auth_headers)
    assert first.status_code == 202

    second = await client.post("/api/user/export", headers=auth_headers)
    assert second.status_code == 429
    assert "export" in second.json()["detail"].lower()


@pytest.mark.asyncio
async def test_export_unauthenticated(client: AsyncClient):
    response = await client.post("/api/user/export")
    assert response.status_code == 403
