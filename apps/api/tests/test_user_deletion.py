from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.user import User


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict:
    await client.post("/api/auth/register", json={
        "email": "delete@example.com",
        "password": "SecurePass123!",
        "name": "Delete User",
    })
    login = await client.post("/api/auth/login", json={
        "email": "delete@example.com",
        "password": "SecurePass123!",
    })
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_delete_account(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    # Verify user exists
    result = await db_session.execute(
        select(User).where(User.email == "delete@example.com")
    )
    assert result.scalar_one_or_none() is not None

    response = await client.delete("/api/user/account", headers=auth_headers)
    assert response.status_code == 200
    assert "deleted" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_delete_account_with_plaid_items(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """Deletion should attempt to revoke Plaid tokens (best effort)."""
    from src.core.security import encrypt_value
    from src.models.plaid_item import PlaidItem

    profile = await client.get("/api/user/profile", headers=auth_headers)
    user_id = profile.json()["id"]

    plaid_item = PlaidItem(
        user_id=user_id,
        access_token=encrypt_value("test-token"),
        item_id="item-delete-test",
        institution_name="Delete Bank",
        status="active",
    )
    db_session.add(plaid_item)
    await db_session.commit()

    with patch("src.routers.user._revoke_plaid_tokens") as mock_revoke:
        mock_revoke.return_value = None
        response = await client.delete("/api/user/account", headers=auth_headers)
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_delete_account_unauthenticated(client: AsyncClient):
    response = await client.delete("/api/user/account")
    assert response.status_code == 403
