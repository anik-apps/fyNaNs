from unittest.mock import patch

import pytest


@pytest.fixture
async def dev_auth_headers(client):
    """Register and login as a dev-allowlisted user."""
    email = "devuser@example.com"
    await client.post("/api/auth/register", json={
        "email": email, "password": "testpass123", "name": "Dev User"
    })
    resp = await client.post("/api/auth/login", json={
        "email": email, "password": "testpass123"
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def normal_auth_headers(client):
    """Register and login as a normal (non-dev) user."""
    email = "normaluser@example.com"
    await client.post("/api/auth/register", json={
        "email": email, "password": "testpass123", "name": "Normal User"
    })
    resp = await client.post("/api/auth/login", json={
        "email": email, "password": "testpass123"
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
@patch("src.routers.dev.settings")
async def test_get_sandbox_toggle_default(mock_settings, client, dev_auth_headers):
    mock_settings.dev_emails_set = {"devuser@example.com"}
    resp = await client.get("/api/dev/sandbox-toggle", headers=dev_auth_headers)
    assert resp.status_code == 200
    assert resp.json() == {"enabled": False}

@pytest.mark.asyncio
@patch("src.routers.dev.settings")
async def test_set_sandbox_toggle(mock_settings, client, dev_auth_headers):
    mock_settings.dev_emails_set = {"devuser@example.com"}
    resp = await client.post(
        "/api/dev/sandbox-toggle",
        json={"enabled": True},
        headers=dev_auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == {"enabled": True}

@pytest.mark.asyncio
@patch("src.routers.dev.settings")
async def test_sandbox_toggle_forbidden_for_non_dev(mock_settings, client, normal_auth_headers):
    mock_settings.dev_emails_set = {"devuser@example.com"}
    resp = await client.get("/api/dev/sandbox-toggle", headers=normal_auth_headers)
    assert resp.status_code == 403
