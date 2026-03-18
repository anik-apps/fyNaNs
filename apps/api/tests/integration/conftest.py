"""Integration test fixtures.

These tests hit a real running API server. Set API_BASE_URL env var or default to localhost:8888.
Requires: running API server + PostgreSQL.

Usage:
    # Start the server first:
    poetry run uvicorn src.main:app --port 8888

    # Run integration tests:
    poetry run pytest tests/integration/ -v
"""

import os
import uuid

import httpx
import pytest

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8888/api")


@pytest.fixture(scope="session")
def api_url():
    return API_BASE_URL


@pytest.fixture(scope="session")
def client():
    """Synchronous httpx client for integration tests."""
    with httpx.Client(base_url=API_BASE_URL, timeout=30.0) as c:
        yield c


@pytest.fixture(scope="session")
def unique_suffix():
    """Unique suffix to avoid collisions across test runs."""
    return uuid.uuid4().hex[:8]


@pytest.fixture(scope="session")
def test_user(client, unique_suffix):
    """Register a test user and return credentials + tokens.

    NOTE: Session-scoped — the access token may expire if the test suite
    takes longer than 15 minutes. If that happens, switch to function-scoped
    or add token refresh logic.
    """
    email = f"inttest-{unique_suffix}@example.com"
    password = "IntTestPass123!"
    name = f"Integration Test {unique_suffix}"

    resp = client.post("/auth/register", json={
        "email": email,
        "password": password,
        "name": name,
    })
    assert resp.status_code == 201, f"Registration failed: {resp.text}"
    user_data = resp.json()

    # Login to get tokens
    login_resp = client.post("/auth/login", json={
        "email": email,
        "password": password,
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    tokens = login_resp.json()

    return {
        "id": user_data["id"],
        "email": email,
        "password": password,
        "name": name,
        "access_token": tokens["access_token"],
        "refresh_token": login_resp.cookies.get("refresh_token"),
    }


@pytest.fixture(scope="session")
def auth_headers(test_user):
    """Authorization headers for authenticated requests."""
    return {"Authorization": f"Bearer {test_user['access_token']}"}
