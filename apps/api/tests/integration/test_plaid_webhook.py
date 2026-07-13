"""Plaid webhook integration tests that do not require Plaid credentials.

The webhook endpoint must acknowledge immediately — sync work is enqueued as
a background task — even when the item is unknown (validation-only path).
"""

import time
import uuid


class TestWebhookFastAcknowledge:
    def test_unknown_item_returns_200_fast(self, client):
        """Validation-only path: an unknown item_id is acked quickly with 200."""
        payload = {
            "webhook_type": "TRANSACTIONS",
            "webhook_code": "SYNC_UPDATES_AVAILABLE",
            "item_id": f"unknown-item-{uuid.uuid4().hex}",
        }

        start = time.monotonic()
        resp = client.post("/plaid/webhook", json=payload)
        elapsed = time.monotonic() - start

        assert resp.status_code == 200, f"Webhook failed: {resp.text}"
        assert resp.json() == {"status": "received"}
        assert elapsed < 2.0, f"Webhook ack took {elapsed:.2f}s, expected < 2s"

    def test_unhandled_webhook_type_returns_200(self, client):
        """Unhandled webhook types are still acknowledged immediately."""
        payload = {
            "webhook_type": "HOLDINGS",
            "webhook_code": "DEFAULT_UPDATE",
            "item_id": f"unknown-item-{uuid.uuid4().hex}",
        }

        resp = client.post("/plaid/webhook", json=payload)

        assert resp.status_code == 200
        assert resp.json() == {"status": "received"}
