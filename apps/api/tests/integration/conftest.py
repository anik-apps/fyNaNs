"""Integration test fixtures.

These tests hit a real running API server. Set API_BASE_URL env var or default to localhost:8888.
Requires: running API server + PostgreSQL.

Usage:
    # Start the server first:
    poetry run uvicorn src.main:app --port 8888

    # Run integration tests (install pytest-timeout for per-test timeouts):
    poetry run pytest tests/integration/ -v --timeout=120
"""

import os
import time
import uuid

import httpx
import pytest

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8888/api")

# Token lifetime assumed to be 15 minutes; refresh when within 2 minutes of that.
_TOKEN_REFRESH_MARGIN = 13 * 60  # seconds


def _refresh_auth_if_needed(client, user_info):
    """Re-login to get a fresh access token if the current one is near expiry.

    Checks elapsed time since the token was issued and refreshes proactively
    so that session-scoped fixtures don't fail on long-running suites.
    """
    elapsed = time.monotonic() - user_info["_token_issued_at"]
    if elapsed < _TOKEN_REFRESH_MARGIN:
        return  # still fresh

    login_resp = client.post("/auth/login", json={
        "email": user_info["email"],
        "password": user_info["password"],
    })
    if login_resp.status_code == 200:
        tokens = login_resp.json()
        user_info["access_token"] = tokens["access_token"]
        user_info["_token_issued_at"] = time.monotonic()


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

    Session-scoped for performance. If the access token nears expiry,
    call ``_refresh_auth_if_needed(client, test_user)`` to re-login.
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
    reg_data = resp.json()
    user_data = reg_data["user"]

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
        "_token_issued_at": time.monotonic(),
    }


@pytest.fixture(autouse=True)
def _ensure_fresh_token(client, test_user):
    """Before every test, refresh the session token if it is near expiry."""
    _refresh_auth_if_needed(client, test_user)


@pytest.fixture(scope="session")
def auth_headers(test_user):
    """Authorization headers for authenticated requests.

    Because ``test_user`` is a mutable dict, the access_token value is
    always current even after a refresh — but the *dict object* returned
    here is static.  We return a fresh dict each time it is accessed by
    wrapping in a simple class.
    """
    class _LiveHeaders(dict):
        """Dict that always reflects the latest access token."""
        def __getitem__(self, key):
            if key == "Authorization":
                return f"Bearer {test_user['access_token']}"
            return super().__getitem__(key)

        def items(self):
            return [("Authorization", f"Bearer {test_user['access_token']}")]

        def copy(self):
            return {"Authorization": f"Bearer {test_user['access_token']}"}

    return _LiveHeaders({"Authorization": f"Bearer {test_user['access_token']}"})
