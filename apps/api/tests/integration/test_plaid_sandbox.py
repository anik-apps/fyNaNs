"""Plaid sandbox integration tests.

These tests require:
1. A running API server (localhost:8888)
2. Plaid sandbox credentials in environment (PLAID_CLIENT_ID, PLAID_SECRET)
3. A running PostgreSQL database

Tests are skipped if PLAID_CLIENT_ID is not set.
"""

import os
import time

import httpx
import pytest

PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID", "")
PLAID_SECRET = os.getenv("PLAID_SECRET", "")
SANDBOX_INSTITUTION_ID = "ins_109508"
SANDBOX_INSTITUTION_NAME = "First Platypus Bank"

pytestmark = pytest.mark.skipif(
    not PLAID_CLIENT_ID,
    reason="PLAID_CLIENT_ID not set — skipping Plaid sandbox tests",
)


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
        """Sandbox should generate test transactions after linking."""
        transactions = []
        for _ in range(15):
            resp = client.get("/transactions", headers=plaid_test_user["headers"])
            assert resp.status_code == 200
            data = resp.json()
            transactions = data if isinstance(data, list) else data.get("items", [])
            if transactions:
                break
            time.sleep(1)

        assert len(transactions) > 0, "Expected sandbox transactions after sync"
