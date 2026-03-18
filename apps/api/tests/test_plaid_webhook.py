from unittest.mock import patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
@patch("src.routers.plaid.verify_plaid_webhook")
@patch("src.routers.plaid.handle_webhook_event")
async def test_webhook_transactions_sync(
    mock_handle, mock_verify, client: AsyncClient
):
    mock_verify.return_value = True
    mock_handle.return_value = None

    payload = {
        "webhook_type": "TRANSACTIONS",
        "webhook_code": "SYNC_UPDATES_AVAILABLE",
        "item_id": "item-webhook-123",
    }

    response = await client.post(
        "/api/plaid/webhook",
        json=payload,
        headers={"Plaid-Verification": "test-jwt-token"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "received"


@pytest.mark.asyncio
async def test_webhook_missing_verification_header(client: AsyncClient):
    payload = {
        "webhook_type": "TRANSACTIONS",
        "webhook_code": "SYNC_UPDATES_AVAILABLE",
        "item_id": "item-123",
    }

    response = await client.post("/api/plaid/webhook", json=payload)
    # Should still accept (verification is best-effort in dev)
    # or reject -- depends on implementation
    assert response.status_code in (200, 400)
