import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import create_access_token, decode_access_token
from src.services.token import create_token_pair, rotate_refresh_token


@pytest.mark.asyncio
async def test_create_access_token_and_decode():
    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["type"] == "access"


@pytest.mark.asyncio
async def test_decode_invalid_token():
    with pytest.raises(ValueError, match="Invalid token"):
        decode_access_token("garbage.token.here")


@pytest.mark.asyncio
async def test_create_and_rotate_token_pair(db_session: AsyncSession):
    from src.models.user import User

    # Create a real user for FK constraint
    user = User(email="token@example.com", name="Token User", password_hash="fake")
    db_session.add(user)
    await db_session.commit()

    access, refresh = await create_token_pair(db_session, user.id, "test-device")
    assert access is not None
    assert refresh is not None

    # Rotate
    new_access, new_refresh, rotated_user_id = await rotate_refresh_token(
        db_session, refresh, "test-device"
    )
    assert rotated_user_id == user.id
    assert new_access is not None
    assert new_refresh != refresh

    # Old token should now be in grace window (rotated_at is set)
    with pytest.raises(ValueError, match="already rotated"):
        await rotate_refresh_token(db_session, refresh, "test-device")


# --- Endpoint tests ---


@pytest.mark.asyncio
async def test_refresh_via_body(client: AsyncClient):
    """Mobile flow: refresh token sent in request body."""
    await client.post("/auth/register", json={
        "email": "refresh@example.com", "password": "SecurePass123!", "name": "User"
    })
    login_resp = await client.post("/auth/login", json={
        "email": "refresh@example.com", "password": "SecurePass123!"
    })
    # Get refresh token from cookie
    refresh_cookie = login_resp.cookies.get("refresh_token")

    response = await client.post("/auth/refresh", json={"refresh_token": refresh_cookie})
    assert response.status_code == 200
    assert "access_token" in response.json()


@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient):
    response = await client.post("/auth/refresh", json={"refresh_token": "invalid"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_logout_invalidates_token(client: AsyncClient):
    await client.post("/auth/register", json={
        "email": "logout@example.com", "password": "SecurePass123!", "name": "User"
    })
    login_resp = await client.post("/auth/login", json={
        "email": "logout@example.com", "password": "SecurePass123!"
    })
    refresh_cookie = login_resp.cookies.get("refresh_token")

    # Logout
    await client.post("/auth/logout", json={"refresh_token": refresh_cookie})

    # Refresh should now fail
    response = await client.post("/auth/refresh", json={"refresh_token": refresh_cookie})
    assert response.status_code == 401
