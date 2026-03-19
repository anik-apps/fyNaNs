from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import encrypt_value
from src.models.plaid_item import PlaidItem
from src.models.user import User


@pytest.mark.asyncio
@patch("src.jobs.fallback_sync.sync_transactions", new_callable=AsyncMock)
@patch("src.jobs.fallback_sync.has_credit_accounts", new_callable=AsyncMock)
@patch("src.jobs.fallback_sync.sync_liabilities", new_callable=AsyncMock)
async def test_fallback_sync_syncs_stale_items(
    mock_liabilities, mock_has_credit, mock_sync, db_session: AsyncSession
):
    from src.jobs.fallback_sync import execute_fallback_sync

    user = User(
        email="fallback@example.com", name="Fallback User", password_hash="fake"
    )
    db_session.add(user)
    await db_session.flush()

    # Stale item (not synced in 4 days)
    stale_item = PlaidItem(
        user_id=user.id,
        access_token=encrypt_value("token"),
        item_id="item-stale-fb",
        institution_name="Stale Bank",
        status="active",
        last_synced_at=datetime.now(timezone.utc) - timedelta(days=4),
    )
    db_session.add(stale_item)

    # Recent item (synced 12 hours ago -- should be skipped)
    recent_item = PlaidItem(
        user_id=user.id,
        access_token=encrypt_value("token2"),
        item_id="item-recent-fb",
        institution_name="Recent Bank",
        status="active",
        last_synced_at=datetime.now(timezone.utc) - timedelta(hours=12),
    )
    db_session.add(recent_item)
    await db_session.commit()

    mock_sync.return_value = {"added": 0, "modified": 0, "removed": 0}
    mock_has_credit.return_value = False

    result = await execute_fallback_sync(db_session)

    assert result["items_synced"] == 1  # Only the stale item
    mock_sync.assert_called_once()


@pytest.mark.asyncio
@patch("src.jobs.fallback_sync.sync_transactions", new_callable=AsyncMock)
@patch("src.jobs.fallback_sync.has_credit_accounts", new_callable=AsyncMock)
@patch("src.jobs.fallback_sync.sync_liabilities", new_callable=AsyncMock)
async def test_fallback_sync_skips_error_items(
    mock_liabilities, mock_has_credit, mock_sync, db_session: AsyncSession
):
    from src.jobs.fallback_sync import execute_fallback_sync

    user = User(
        email="fallback2@example.com", name="Fallback2", password_hash="fake"
    )
    db_session.add(user)
    await db_session.flush()

    error_item = PlaidItem(
        user_id=user.id,
        access_token=encrypt_value("token"),
        item_id="item-error-fb",
        institution_name="Error Bank",
        status="error",
        last_synced_at=None,
    )
    db_session.add(error_item)
    await db_session.commit()

    result = await execute_fallback_sync(db_session)

    assert result["items_synced"] == 0
    mock_sync.assert_not_called()
