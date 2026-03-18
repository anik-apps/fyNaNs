import uuid
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import encrypt_value, decrypt_value
from src.services.plaid import create_link_token, PlaidServiceError


@pytest.mark.asyncio
async def test_encrypt_decrypt_access_token():
    """Verify AES encryption round-trip for Plaid access tokens."""
    original = "access-sandbox-abc123-test-token"
    encrypted = encrypt_value(original)
    assert encrypted != original
    decrypted = decrypt_value(encrypted)
    assert decrypted == original


@pytest.mark.asyncio
@patch("src.services.plaid._get_plaid_client")
async def test_create_link_token(mock_client):
    mock_api = MagicMock()
    mock_response = MagicMock()
    mock_response.link_token = "link-sandbox-test-123"
    mock_response.expiration = "2026-03-19T00:00:00Z"
    mock_api.link_token_create.return_value = mock_response
    mock_client.return_value = mock_api

    result = await create_link_token(uuid.uuid4())
    assert result["link_token"] == "link-sandbox-test-123"
    assert result["expiration"] == "2026-03-19T00:00:00Z"


@pytest.mark.asyncio
@patch("src.services.plaid._get_plaid_client")
async def test_exchange_public_token(mock_client, db_session: AsyncSession):
    from src.models.user import User
    from src.services.plaid import exchange_public_token

    # Create test user
    user = User(email="plaid@example.com", name="Plaid User", password_hash="fake")
    db_session.add(user)
    await db_session.commit()

    mock_api = MagicMock()

    # Mock exchange response
    mock_exchange = MagicMock()
    mock_exchange.access_token = "access-sandbox-token-123"
    mock_exchange.item_id = "item-sandbox-123"
    mock_api.item_public_token_exchange.return_value = mock_exchange

    # Mock accounts response
    mock_acct = MagicMock()
    mock_acct.account_id = "acct-001"
    mock_acct.name = "Checking"
    mock_acct.type = MagicMock(value="depository")
    mock_acct.subtype = MagicMock(__str__=lambda self: "checking")
    mock_acct.balances.current = 1500.00
    mock_acct.balances.iso_currency_code = "USD"
    mock_acct.mask = "1234"

    mock_accounts_resp = MagicMock()
    mock_accounts_resp.accounts = [mock_acct]
    mock_api.accounts_get.return_value = mock_accounts_resp

    mock_client.return_value = mock_api

    plaid_item, num_accounts = await exchange_public_token(
        db_session, user.id, "public-sandbox-token", "ins_001", "Test Bank"
    )

    assert plaid_item.institution_name == "Test Bank"
    assert plaid_item.item_id == "item-sandbox-123"
    assert plaid_item.status == "active"
    assert num_accounts == 1


@pytest.mark.asyncio
@patch("src.services.plaid._get_plaid_client")
async def test_exchange_duplicate_item_raises(mock_client, db_session: AsyncSession):
    from src.models.user import User
    from src.models.plaid_item import PlaidItem
    from src.core.security import encrypt_value
    from src.services.plaid import exchange_public_token

    user = User(email="plaid2@example.com", name="Plaid User 2", password_hash="fake")
    db_session.add(user)
    await db_session.flush()

    # Pre-existing item
    existing = PlaidItem(
        user_id=user.id,
        access_token=encrypt_value("old-token"),
        item_id="item-duplicate-123",
        institution_name="Old Bank",
        status="active",
    )
    db_session.add(existing)
    await db_session.commit()

    mock_api = MagicMock()
    mock_exchange = MagicMock()
    mock_exchange.access_token = "access-new"
    mock_exchange.item_id = "item-duplicate-123"
    mock_api.item_public_token_exchange.return_value = mock_exchange
    mock_client.return_value = mock_api

    with pytest.raises(PlaidServiceError, match="already linked"):
        await exchange_public_token(
            db_session, user.id, "public-token", "ins_001", "New Bank"
        )
