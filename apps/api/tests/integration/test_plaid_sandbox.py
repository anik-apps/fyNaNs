"""Integration tests for Plaid sandbox flow.

These tests hit a running API server and the real Plaid sandbox API.
They are skipped automatically when PLAID_CLIENT_ID is not set (e.g., in CI).

Requirements:
  - Running API server at API_BASE_URL (default: http://localhost:8888/api)
  - PLAID_CLIENT_ID and PLAID_SECRET environment variables
  - The API server must also have these Plaid credentials configured

Usage:
  PLAID_CLIENT_ID=xxx PLAID_SECRET=yyy poetry run pytest tests/integration/test_plaid_sandbox.py -v
"""

import os
import time

import httpx
import pytest

PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID", "")
PLAID_SECRET = os.getenv("PLAID_SECRET", "")
SANDBOX_INSTITUTION_ID = "ins_109508"  # First Platypus Bank
SANDBOX_INSTITUTION_NAME = "First Platypus Bank"

pytestmark = pytest.mark.skipif(
    not PLAID_CLIENT_ID or not PLAID_SECRET,
    reason="PLAID_CLIENT_ID and PLAID_SECRET not set; skipping Plaid sandbox tests",
)


@pytest.fixture(scope="module")
def sandbox_public_token() -> str:
    """Create a sandbox public token directly via the Plaid sandbox API."""
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


class TestPlaidSandboxLinkToken:
    """Test creating a Plaid Link token."""

    def test_create_link_token(self, client, plaid_test_user):
        resp = client.post("/plaid/link-token", headers=plaid_test_user["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert "link_token" in data
        assert data["link_token"].startswith("link-sandbox-")
        assert "expiration" in data


class TestPlaidSandboxExchange:
    """Test exchanging a sandbox public token."""

    def test_exchange_sandbox_public_token(self, client, plaid_test_user, sandbox_public_token):
        resp = client.post(
            "/plaid/exchange-token",
            headers=plaid_test_user["headers"],
            json={
                "public_token": sandbox_public_token,
                "institution_id": SANDBOX_INSTITUTION_ID,
                "institution_name": SANDBOX_INSTITUTION_NAME,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["institution_name"] == SANDBOX_INSTITUTION_NAME
        assert data["accounts_linked"] > 0
        assert "plaid_item_id" in data


class TestPlaidSandboxItems:
    """Test listing linked Plaid items."""

    def test_list_plaid_items(self, client, plaid_test_user, sandbox_public_token):
        # Ensure the item is linked first
        client.post(
            "/plaid/exchange-token",
            headers=plaid_test_user["headers"],
            json={
                "public_token": sandbox_public_token,
                "institution_id": SANDBOX_INSTITUTION_ID,
                "institution_name": SANDBOX_INSTITUTION_NAME,
            },
        )

        resp = client.get("/plaid/items", headers=plaid_test_user["headers"])
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) >= 1
        item = items[0]
        assert item["institution_name"] == SANDBOX_INSTITUTION_NAME
        assert item["status"] == "active"
        assert item["account_count"] > 0


class TestPlaidSandboxTransactions:
    """Test transaction sync in sandbox mode."""

    def test_accounts_have_transactions_after_sync(
        self, client, plaid_test_user, sandbox_public_token,
    ):
        """After linking, transactions should appear (sandbox auto-generates them)."""
        # Link if not already linked
        client.post(
            "/plaid/exchange-token",
            headers=plaid_test_user["headers"],
            json={
                "public_token": sandbox_public_token,
                "institution_id": SANDBOX_INSTITUTION_ID,
                "institution_name": SANDBOX_INSTITUTION_NAME,
            },
        )

        # Poll for transactions (sync may take a moment in sandbox)
        transactions = []
        for _ in range(15):
            resp = client.get("/transactions", headers=plaid_test_user["headers"])
            assert resp.status_code == 200
            data = resp.json()
            transactions = data if isinstance(data, list) else data.get("items", [])
            if transactions:
                break
            time.sleep(1)

        # Sandbox should generate test transactions
        assert len(transactions) > 0, "Expected sandbox transactions after sync"

    def test_accounts_appear_after_linking(self, client, plaid_test_user):
        """Verify that accounts from First Platypus Bank exist."""
        resp = client.get("/accounts", headers=plaid_test_user["headers"])
        assert resp.status_code == 200
        accounts = resp.json()
        platypus_accounts = [
            a for a in accounts
            if a.get("institution_name") == SANDBOX_INSTITUTION_NAME
        ]
        assert len(platypus_accounts) > 0, "Expected accounts from First Platypus Bank"
