"""Integration tests for the full auth flow.

Note: These tests hit a real API with rate limiting. Each test that does login
uses unique emails to avoid cross-test interference. Tests that need refresh
tokens extract them from the Set-Cookie header since httpx sync client doesn't
auto-forward cookies.
"""

import uuid

import httpx
import pyotp


def _extract_refresh_token(response: httpx.Response) -> str | None:
    """Extract refresh_token from Set-Cookie header."""
    for header in response.headers.get_list("set-cookie"):
        if header.startswith("refresh_token="):
            return header.split("refresh_token=")[1].split(";")[0]
    return None


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def test_register_login_flow(client: httpx.Client):
    """Full registration -> login -> access protected endpoint flow."""
    email = _unique_email("authflow")

    # Register
    resp = client.post("/auth/register", json={
        "email": email,
        "password": "AuthFlow123!",
        "name": "Auth Flow User",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    user = data["user"]
    assert user["email"] == email

    # Login
    resp = client.post("/auth/login", json={"email": email, "password": "AuthFlow123!"})
    assert resp.status_code == 200
    tokens = resp.json()
    assert "access_token" in tokens
    assert tokens["mfa_required"] is False

    # Access protected endpoint
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    resp = client.get("/user/profile", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == email


def test_register_duplicate_email(client: httpx.Client, test_user):
    """Cannot register with an already-used email."""
    resp = client.post("/auth/register", json={
        "email": test_user["email"],
        "password": "SomePass123!",
        "name": "Duplicate",
    })
    assert resp.status_code == 409


def test_login_wrong_password(client: httpx.Client):
    email = _unique_email("wrongpw")
    client.post("/auth/register", json={
        "email": email, "password": "CorrectPass123!", "name": "User"
    })
    resp = client.post("/auth/login", json={
        "email": email, "password": "WrongPassword!",
    })
    assert resp.status_code == 401


def test_login_nonexistent_user(client: httpx.Client):
    resp = client.post("/auth/login", json={
        "email": _unique_email("nonexist"),
        "password": "whatever1234",
    })
    assert resp.status_code == 401


def test_access_protected_endpoint_without_token(client: httpx.Client):
    resp = client.get("/user/profile")
    assert resp.status_code == 403


def test_access_with_invalid_token(client: httpx.Client):
    resp = client.get("/user/profile", headers={"Authorization": "Bearer invalid.token.here"})
    assert resp.status_code == 401


def test_refresh_token_flow(client: httpx.Client):
    """Login -> refresh -> get new access token."""
    email = _unique_email("refresh")
    client.post("/auth/register", json={
        "email": email, "password": "RefreshTest123!", "name": "Refresh User"
    })
    login_resp = client.post("/auth/login", json={
        "email": email, "password": "RefreshTest123!"
    })
    assert login_resp.status_code == 200
    refresh_token = _extract_refresh_token(login_resp)
    assert refresh_token is not None, "No refresh_token cookie in response"

    # Refresh via body (mobile flow)
    resp = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    new_tokens = resp.json()
    assert "access_token" in new_tokens

    # Verify the new token works
    headers = {"Authorization": f"Bearer {new_tokens['access_token']}"}
    profile = client.get("/user/profile", headers=headers)
    assert profile.status_code == 200


def test_logout_invalidates_refresh(client: httpx.Client):
    """After logout, refresh token should be invalid."""
    email = _unique_email("logout")
    client.post("/auth/register", json={
        "email": email, "password": "LogoutTest123!", "name": "Logout User"
    })
    login_resp = client.post("/auth/login", json={
        "email": email, "password": "LogoutTest123!"
    })
    assert login_resp.status_code == 200
    refresh_token = _extract_refresh_token(login_resp)
    token = login_resp.json()["access_token"]

    # Logout
    client.post("/auth/logout",
                headers={"Authorization": f"Bearer {token}"},
                json={"refresh_token": refresh_token})

    # Refresh should fail
    resp = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 401


def test_session_management(client: httpx.Client, auth_headers):
    """List sessions and verify at least one exists."""
    resp = client.get("/auth/sessions", headers=auth_headers)
    assert resp.status_code == 200
    sessions = resp.json()
    assert len(sessions) >= 1
    assert "device_info" in sessions[0]
    assert "expires_at" in sessions[0]


def test_mfa_setup_confirm_login_flow(client: httpx.Client):
    """Full MFA flow: setup -> confirm -> login requires MFA -> verify."""
    email = _unique_email("mfa")
    client.post("/auth/register", json={
        "email": email, "password": "MFATest123!", "name": "MFA User"
    })
    login_resp = client.post("/auth/login", json={
        "email": email, "password": "MFATest123!"
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Setup MFA
    setup_resp = client.post("/auth/mfa/setup", headers=headers)
    assert setup_resp.status_code == 200
    secret = setup_resp.json()["secret"]
    assert "otpauth_uri" in setup_resp.json()

    # Confirm MFA with TOTP code
    totp = pyotp.TOTP(secret)
    confirm_resp = client.post("/auth/mfa/confirm", headers=headers, json={
        "code": totp.now()
    })
    assert confirm_resp.status_code == 200

    # Login again — should require MFA
    login2 = client.post("/auth/login", json={
        "email": email, "password": "MFATest123!"
    })
    assert login2.status_code == 200
    assert login2.json()["mfa_required"] is True
    mfa_token = login2.json()["mfa_token"]

    # The server allows same TOTP code within its validity window (valid_window=1,
    # meaning current + previous + next 30s window). No need to wait for a new code.

    # Verify MFA
    verify_resp = client.post("/auth/mfa/verify",
                              headers={"Authorization": f"Bearer {mfa_token}"},
                              json={"code": totp.now()})
    assert verify_resp.status_code == 200
    assert "access_token" in verify_resp.json()
    assert verify_resp.json()["mfa_required"] is False

    # New token should work for protected endpoints
    new_headers = {"Authorization": f"Bearer {verify_resp.json()['access_token']}"}
    profile = client.get("/user/profile", headers=new_headers)
    assert profile.status_code == 200


def test_password_reset_request(client: httpx.Client, test_user):
    """Password reset request always returns 200 (no email leak)."""
    resp = client.post("/auth/password/reset-request", json={"email": test_user["email"]})
    assert resp.status_code == 200

    # Non-existent email also returns 200
    resp = client.post("/auth/password/reset-request", json={
        "email": _unique_email("nobody")
    })
    assert resp.status_code == 200
