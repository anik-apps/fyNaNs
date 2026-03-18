import pyotp
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_mfa_setup_requires_auth(client: AsyncClient):
    response = await client.post("/api/auth/mfa/setup")
    assert response.status_code == 403  # No bearer token


@pytest.mark.asyncio
async def test_mfa_full_flow(client: AsyncClient):
    # Register + login
    await client.post("/api/auth/register", json={
        "email": "mfa@example.com", "password": "SecurePass123!", "name": "MFA User"
    })
    login = await client.post("/api/auth/login", json={
        "email": "mfa@example.com", "password": "SecurePass123!"
    })
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Setup MFA (does NOT enable it yet)
    setup = await client.post("/api/auth/mfa/setup", headers=headers)
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    assert "otpauth_uri" in setup.json()

    # Confirm MFA with valid TOTP code (this enables it)
    totp = pyotp.TOTP(secret)
    confirm = await client.post("/api/auth/mfa/confirm", headers=headers, json={
        "code": totp.now(),
    })
    assert confirm.status_code == 200

    # Login again — should now require MFA
    login2 = await client.post("/api/auth/login", json={
        "email": "mfa@example.com", "password": "SecurePass123!"
    })
    assert login2.json()["mfa_required"] is True
    mfa_token = login2.json()["access_token"]

    # Verify MFA to get full tokens
    verify = await client.post("/api/auth/mfa/verify",
        headers={"Authorization": f"Bearer {mfa_token}"},
        json={"code": totp.now()},
    )
    assert verify.status_code == 200
    assert "access_token" in verify.json()
    assert verify.json()["mfa_required"] is False
