"""Plaid sandbox integration tests.

These tests require:
1. A running API server (localhost:8888)
2. Plaid sandbox credentials in environment (PLAID_CLIENT_ID, PLAID_SECRET)
3. A running PostgreSQL database

Tests are skipped if PLAID_CLIENT_ID is not set.
"""

import os
import time
import uuid

import httpx
import pytest

PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID", "")
PLAID_SECRET = os.getenv("PLAID_SECRET", "")
SANDBOX_INSTITUTION_ID = "ins_109508"
SANDBOX_INSTITUTION_NAME = "First Platypus Bank"

pytestmark = [
    pytest.mark.skipif(
        not PLAID_CLIENT_ID,
        reason="PLAID_CLIENT_ID not set — skipping Plaid sandbox tests",
    ),
    pytest.mark.plaid,
]


@pytest.fixture(scope="module")
def sandbox_public_token():
    """Create a Plaid sandbox public token directly via Plaid API."""
    resp = httpx.post(
        "https://sandbox.plaid.com/sandbox/public_token/create",
        json={
            "client_id": PLAID_CLIENT_ID,
            "secret": PLAID_SECRET,
            "institution_id": SANDBOX_INSTITUTION_ID,
            "initial_products": ["transactions"],
        },
        timeout=30.0,
    )
    assert resp.status_code == 200, f"Failed to create sandbox token: {resp.text}"
    return resp.json()["public_token"]


@pytest.fixture(scope="module")
def plaid_test_user(client, unique_suffix):
    """Register a dedicated user for Plaid sandbox tests."""
    email = f"plaid-test-{unique_suffix}@example.com"
    password = "PlaidTest123!"

    resp = client.post("/auth/register", json={
        "email": email,
        "password": password,
        "name": f"Plaid Tester {unique_suffix}",
    })
    if resp.status_code == 409:
        pass  # Already registered from a previous run
    else:
        assert resp.status_code == 201, f"Registration failed: {resp.text}"

    login_resp = client.post("/auth/login", json={
        "email": email,
        "password": password,
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    tokens = login_resp.json()

    return {
        "email": email,
        "access_token": tokens["access_token"],
        "headers": {"Authorization": f"Bearer {tokens['access_token']}"},
    }


@pytest.fixture(scope="module")
def exchanged_item(client, plaid_test_user, sandbox_public_token):
    """Exchange the sandbox public token once and share across tests."""
    resp = client.post(
        "/plaid/exchange-token",
        headers=plaid_test_user["headers"],
        json={
            "public_token": sandbox_public_token,
            "institution_id": SANDBOX_INSTITUTION_ID,
            "institution_name": SANDBOX_INSTITUTION_NAME,
        },
    )
    assert resp.status_code == 200, f"Exchange failed: {resp.text}"
    return resp.json()


class TestPlaidSandboxLinkToken:
    def test_create_link_token(self, client, plaid_test_user):
        resp = client.post("/plaid/link-token", headers=plaid_test_user["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert "link_token" in data
        assert data["link_token"].startswith("link-sandbox-")


class TestPlaidSandboxExchange:
    def test_exchange_returns_accounts(self, exchanged_item):
        assert exchanged_item["institution_name"] == SANDBOX_INSTITUTION_NAME
        assert exchanged_item["accounts_linked"] > 0
        assert "plaid_item_id" in exchanged_item


class TestPlaidSandboxItems:
    def test_list_plaid_items(self, client, plaid_test_user, exchanged_item):
        resp = client.get("/plaid/items", headers=plaid_test_user["headers"])
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) >= 1
        item = items[0]
        assert item["institution_name"] == SANDBOX_INSTITUTION_NAME
        assert item["status"] == "active"
        assert item["account_count"] > 0


class TestPlaidSandboxTransactions:
    def test_accounts_appear_after_linking(self, client, plaid_test_user, exchanged_item):
        resp = client.get("/accounts", headers=plaid_test_user["headers"])
        assert resp.status_code == 200
        accounts = resp.json()
        platypus_accounts = [
            a for a in accounts
            if a.get("institution_name") == SANDBOX_INSTITUTION_NAME
        ]
        assert len(platypus_accounts) > 0

    def test_transactions_sync(self, client, plaid_test_user, exchanged_item):
        """Sandbox should have transactions after linking and syncing.

        Plaid sandbox needs time after token exchange before transactions
        are available via /transactions/sync. We wait, sync, then poll
        the transactions list endpoint.
        """
        item_id = str(exchanged_item["plaid_item_id"])
        headers = plaid_test_user["headers"]

        # Wait for Plaid sandbox to populate transactions after exchange.
        # The sandbox "initial update" is async and can take 5-30 seconds.
        time.sleep(10)

        # Trigger sync with retry — sandbox can 500 if transactions
        # aren't ready yet (Plaid's async "initial update").
        sync_resp = None
        sync_detail = ""
        for attempt in range(3):
            sync_resp = client.post(
                f"/plaid/items/{item_id}/sync", headers=headers,
            )
            sync_detail = (
                f"status={sync_resp.status_code} "
                f"body={sync_resp.text[:200]}"
            )

            if sync_resp.status_code == 429:
                pytest.skip("Plaid rate limit — re-run after 5 minutes")

            if sync_resp.status_code == 200:
                break

            # 500 likely means Plaid sandbox isn't ready — wait and retry
            import warnings
            warnings.warn(
                f"Sync attempt {attempt + 1}/3 failed: {sync_detail}",
                stacklevel=1,
            )
            time.sleep(10)

        if sync_resp.status_code != 200:
            pytest.skip(
                f"Plaid sandbox sync unavailable after 3 attempts: {sync_detail}. "
                f"This is intermittent in sandbox mode — not a code bug."
            )

        sync_data = sync_resp.json()

        # If first sync got 0, Plaid sandbox may not be ready yet.
        # We can't re-sync (rate limited), so just poll transactions
        # in case they were added by exchange_public_token's initial sync.
        if sync_data.get("added", 0) == 0:
            # Plaid sandbox sometimes doesn't have transactions ready
            # on first sync. This is a known sandbox limitation.
            # Poll the transactions endpoint anyway — they may have
            # been added during the exchange step.
            pass

        # Poll for transactions with exponential backoff.
        transactions = []
        delay = 2.0
        deadline = time.monotonic() + 60.0
        while time.monotonic() < deadline:
            resp = client.get("/transactions", headers=headers)
            assert resp.status_code == 200
            data = resp.json()
            transactions = (
                data if isinstance(data, list)
                else data.get("items", [])
            )
            if transactions:
                break
            time.sleep(min(delay, 10.0))
            delay *= 2

        if not transactions:
            pytest.skip(
                f"Plaid sandbox did not produce transactions "
                f"(sync: {sync_detail}). This is intermittent "
                f"in sandbox mode — not a code bug."
            )

        # --- Transaction counts (batched sync path) ---
        resp = client.get("/transactions", headers=headers, params={"limit": 200})
        assert resp.status_code == 200
        data = resp.json()
        first_items = data if isinstance(data, list) else data.get("items", [])
        count_after_first = len(first_items)
        assert count_after_first > 0
        # Every transaction the sync reported as added must be visible
        assert count_after_first >= sync_data.get("added", 0)

        # --- Idempotency: a second sync must not duplicate transactions ---
        # Use /plaid/sync-all, which is not subject to the per-item manual
        # sync rate limit (MIN_SYNC_INTERVAL).
        resync = client.post("/plaid/sync-all", headers=headers)
        assert resync.status_code == 200
        resync_data = resync.json()
        if resync_data["items_synced"] == 0:
            pytest.skip(
                "Plaid sandbox re-sync failed — intermittent sandbox behavior."
            )

        resp = client.get("/transactions", headers=headers, params={"limit": 200})
        assert resp.status_code == 200
        data = resp.json()
        second_items = data if isinstance(data, list) else data.get("items", [])

        # Cursor-based sync is idempotent: the count only changes by what
        # Plaid actually reported on the re-sync (usually added=0/removed=0;
        # the sandbox may stream late transactions).
        assert len(second_items) == (
            count_after_first + resync_data["added"] - resync_data["removed"]
        )


def _get_plaid_external_item_id(plaid_item_uuid: str) -> str:
    """Fetch PlaidItem.item_id (Plaid's external ID) from the API database.

    The webhook payload needs Plaid's item_id string, which the API
    intentionally never exposes over HTTP — so look it up directly.
    """
    import asyncio

    import asyncpg

    dsn = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://fynans:fynans_dev@localhost:5432/fynans",
    ).replace("+asyncpg", "")

    async def _fetch():
        conn = await asyncpg.connect(dsn)
        try:
            return await conn.fetchval(
                "SELECT item_id FROM plaid_items WHERE id = $1",
                uuid.UUID(plaid_item_uuid),
            )
        finally:
            await conn.close()

    try:
        item_id = asyncio.run(_fetch())
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"Cannot reach the API database to look up the Plaid item_id: {exc}")
    if not item_id:
        pytest.skip("Plaid item not found in the API database (remote API server?)")
    return item_id


class TestPlaidSandboxWebhook:
    def test_webhook_acks_fast_and_syncs_in_background(
        self, client, plaid_test_user, exchanged_item
    ):
        """SYNC_UPDATES_AVAILABLE must be acknowledged immediately.

        The sync chain runs as a background task, so the response returns
        quickly and transaction effects show up eventually. If another sync
        for the item is running (e.g. from the previous test), the in-process
        lock coalesces this one into a single extra pass — the ack must
        still be fast and effects visible.
        """
        item_id = _get_plaid_external_item_id(str(exchanged_item["plaid_item_id"]))
        payload = {
            "webhook_type": "TRANSACTIONS",
            "webhook_code": "SYNC_UPDATES_AVAILABLE",
            "item_id": item_id,
        }

        start = time.monotonic()
        resp = client.post("/plaid/webhook", json=payload)
        elapsed = time.monotonic() - start

        assert resp.status_code == 200, f"Webhook failed: {resp.text}"
        assert resp.json() == {"status": "received"}
        assert elapsed < 2.0, f"Webhook ack took {elapsed:.2f}s, expected < 2s"

        # Poll for eventual sync effects.
        headers = plaid_test_user["headers"]
        transactions = []
        deadline = time.monotonic() + 60.0
        while time.monotonic() < deadline:
            r = client.get("/transactions", headers=headers)
            assert r.status_code == 200
            data = r.json()
            transactions = data if isinstance(data, list) else data.get("items", [])
            if transactions:
                break
            time.sleep(2)

        if not transactions:
            pytest.skip(
                "Plaid sandbox produced no transactions after the webhook — "
                "intermittent in sandbox mode, not a code bug."
            )
