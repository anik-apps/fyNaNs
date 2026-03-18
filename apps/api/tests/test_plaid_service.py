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


@pytest.mark.asyncio
@patch("src.services.plaid._get_plaid_client")
async def test_sync_transactions(mock_client, db_session: AsyncSession):
    from src.models.user import User
    from src.models.plaid_item import PlaidItem
    from src.models.account import Account
    from src.models.transaction import Transaction
    from src.core.security import encrypt_value
    from src.services.plaid import sync_transactions
    from sqlalchemy import select

    # Setup user, plaid_item, account
    user = User(email="sync@example.com", name="Sync User", password_hash="fake")
    db_session.add(user)
    await db_session.flush()

    plaid_item = PlaidItem(
        user_id=user.id,
        access_token=encrypt_value("access-token"),
        item_id="item-sync-123",
        institution_name="Sync Bank",
        status="active",
    )
    db_session.add(plaid_item)
    await db_session.flush()

    account = Account(
        user_id=user.id,
        plaid_item_id=plaid_item.id,
        plaid_account_id="acct-sync-001",
        institution_name="Sync Bank",
        name="Checking",
        type="checking",
        balance=1000,
        is_manual=False,
    )
    db_session.add(account)
    await db_session.commit()

    # Mock Plaid sync response
    mock_api = MagicMock()
    mock_txn = MagicMock()
    mock_txn.transaction_id = "txn-001"
    mock_txn.account_id = "acct-sync-001"
    mock_txn.amount = 25.50
    mock_txn.date = "2026-03-15"
    mock_txn.name = "Coffee Shop"
    mock_txn.merchant_name = "Starbucks"
    mock_txn.personal_finance_category = MagicMock(primary="FOOD_AND_DRINK", detailed="COFFEE")
    mock_txn.pending = False

    mock_sync_resp = MagicMock()
    mock_sync_resp.added = [mock_txn]
    mock_sync_resp.modified = []
    mock_sync_resp.removed = []
    mock_sync_resp.has_more = False
    mock_sync_resp.next_cursor = "cursor-after-sync"
    mock_api.transactions_sync.return_value = mock_sync_resp

    mock_client.return_value = mock_api

    stats = await sync_transactions(db_session, plaid_item)

    assert stats["added"] == 1
    assert stats["modified"] == 0
    assert stats["removed"] == 0

    # Verify transaction was created
    result = await db_session.execute(
        select(Transaction).where(Transaction.plaid_txn_id == "txn-001")
    )
    txn = result.scalar_one()
    assert float(txn.amount) == 25.50
    assert txn.description == "Coffee Shop"
    assert txn.merchant_name == "Starbucks"


@pytest.mark.asyncio
@patch("src.services.plaid._get_plaid_client")
async def test_sync_transactions_removes_deleted(mock_client, db_session: AsyncSession):
    from src.models.user import User
    from src.models.plaid_item import PlaidItem
    from src.models.account import Account
    from src.models.transaction import Transaction
    from src.core.security import encrypt_value
    from src.services.plaid import sync_transactions
    from sqlalchemy import select

    user = User(email="syncrem@example.com", name="Sync Rem", password_hash="fake")
    db_session.add(user)
    await db_session.flush()

    plaid_item = PlaidItem(
        user_id=user.id,
        access_token=encrypt_value("access-token"),
        item_id="item-syncrem-123",
        institution_name="Sync Bank",
        status="active",
        cursor="old-cursor",
    )
    db_session.add(plaid_item)
    await db_session.flush()

    account = Account(
        user_id=user.id,
        plaid_item_id=plaid_item.id,
        plaid_account_id="acct-syncrem-001",
        institution_name="Sync Bank",
        name="Checking",
        type="checking",
        balance=1000,
        is_manual=False,
    )
    db_session.add(account)
    await db_session.flush()

    # Pre-existing transaction that Plaid will report as removed
    from datetime import date as date_type
    txn = Transaction(
        user_id=user.id,
        account_id=account.id,
        plaid_txn_id="txn-to-remove",
        amount=10.00,
        date=date_type(2026, 3, 10),
        description="Old Coffee",
        is_manual=False,
    )
    db_session.add(txn)
    await db_session.commit()

    mock_api = MagicMock()
    mock_removed = MagicMock()
    mock_removed.transaction_id = "txn-to-remove"

    mock_sync_resp = MagicMock()
    mock_sync_resp.added = []
    mock_sync_resp.modified = []
    mock_sync_resp.removed = [mock_removed]
    mock_sync_resp.has_more = False
    mock_sync_resp.next_cursor = "cursor-after-remove"
    mock_api.transactions_sync.return_value = mock_sync_resp

    mock_client.return_value = mock_api

    stats = await sync_transactions(db_session, plaid_item)
    assert stats["removed"] == 1

    # Verify transaction was deleted
    result = await db_session.execute(
        select(Transaction).where(Transaction.plaid_txn_id == "txn-to-remove")
    )
    assert result.scalar_one_or_none() is None
