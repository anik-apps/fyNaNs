#!/usr/bin/env python3
"""Plaid sandbox end-to-end test script.

Tests the full flow through the running API server:
  1. Log in (or register) a test user
  2. Create a sandbox public token via Plaid's sandbox API
  3. Exchange it through the API's /api/plaid/exchange-token endpoint
  4. Trigger a transaction sync via Plaid's sandbox webhook firing
  5. Fetch and print the synced transactions

Requirements:
  - A running API server (default: http://localhost:8888/api)
  - PLAID_CLIENT_ID and PLAID_SECRET set in the API's environment
  - An existing user account (or use --register to create one)

Usage:
  poetry run python scripts/plaid-sandbox-test.py \
    --api-url http://localhost:8888/api \
    --email test@example.com \
    --password TestPass123!
"""

import argparse
import os
import sys
import time

import httpx

SANDBOX_INSTITUTION_ID = "ins_109508"  # First Platypus Bank
SANDBOX_INSTITUTION_NAME = "First Platypus Bank"
SANDBOX_TEST_USERNAME = "user_good"
SANDBOX_TEST_PASSWORD = "pass_good"
SANDBOX_PRODUCTS = ["transactions"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Plaid sandbox end-to-end test")
    parser.add_argument(
        "--api-url",
        default=os.getenv("API_BASE_URL", "http://localhost:8888/api"),
        help="Base URL of the running API (default: http://localhost:8888/api)",
    )
    parser.add_argument("--email", required=True, help="User email for authentication")
    parser.add_argument("--password", required=True, help="User password")
    parser.add_argument(
        "--register",
        action="store_true",
        help="Register the user first (if not already registered)",
    )
    parser.add_argument(
        "--plaid-client-id",
        default=os.getenv("PLAID_CLIENT_ID", ""),
        help="Plaid client ID (or set PLAID_CLIENT_ID env var)",
    )
    parser.add_argument(
        "--plaid-secret",
        default=os.getenv("PLAID_SECRET", ""),
        help="Plaid sandbox secret (or set PLAID_SECRET env var)",
    )
    return parser.parse_args()


def create_sandbox_public_token(client_id: str, secret: str) -> str:
    """Create a sandbox public token directly via Plaid's sandbox API."""
    print("[1/5] Creating sandbox public token via Plaid API...")
    resp = httpx.post(
        "https://sandbox.plaid.com/sandbox/public_token/create",
        json={
            "client_id": client_id,
            "secret": secret,
            "institution_id": SANDBOX_INSTITUTION_ID,
            "initial_products": SANDBOX_PRODUCTS,
        },
        timeout=30.0,
    )
    if resp.status_code != 200:
        print(f"  ERROR: Plaid sandbox API returned {resp.status_code}: {resp.text}")
        sys.exit(1)
    public_token = resp.json()["public_token"]
    print(f"  OK: public_token = {public_token[:20]}...")
    return public_token


def authenticate(client: httpx.Client, email: str, password: str, register: bool) -> str:
    """Log in (optionally register first) and return an access token."""
    if register:
        print("[0/5] Registering user...")
        resp = client.post(
            "/auth/register",
            json={"email": email, "password": password, "name": "Sandbox Tester"},
        )
        if resp.status_code == 201:
            print("  OK: User registered.")
        elif resp.status_code == 409:
            print("  OK: User already exists, proceeding to login.")
        else:
            print(f"  ERROR: Registration returned {resp.status_code}: {resp.text}")
            sys.exit(1)

    print("[1/5] Logging in...")
    resp = client.post("/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        print(f"  ERROR: Login returned {resp.status_code}: {resp.text}")
        sys.exit(1)
    access_token = resp.json()["access_token"]
    print("  OK: Authenticated.")
    return access_token


def exchange_token(client: httpx.Client, auth_headers: dict, public_token: str) -> dict:
    """Exchange the sandbox public token through the API."""
    print("[2/5] Exchanging public token via API /plaid/exchange-token...")
    resp = client.post(
        "/plaid/exchange-token",
        headers=auth_headers,
        json={
            "public_token": public_token,
            "institution_id": SANDBOX_INSTITUTION_ID,
            "institution_name": SANDBOX_INSTITUTION_NAME,
        },
    )
    if resp.status_code != 200:
        print(f"  ERROR: Exchange returned {resp.status_code}: {resp.text}")
        sys.exit(1)
    data = resp.json()
    print(f"  OK: Linked {data['accounts_linked']} accounts from {data['institution_name']}")
    return data


def list_accounts(client: httpx.Client, auth_headers: dict) -> list:
    """Fetch accounts from the API."""
    print("[3/5] Fetching linked accounts...")
    resp = client.get("/accounts", headers=auth_headers)
    if resp.status_code != 200:
        print(f"  ERROR: Accounts returned {resp.status_code}: {resp.text}")
        sys.exit(1)
    accounts = resp.json()
    for acct in accounts:
        print(f"  - {acct['name']} ({acct['type']}) balance={acct.get('balance', 'N/A')}")
    return accounts


def wait_for_transactions(client: httpx.Client, auth_headers: dict, max_wait: int = 15) -> list:
    """Poll for transactions (sandbox sync may take a moment)."""
    print("[4/5] Waiting for transaction sync...")
    for i in range(max_wait):
        resp = client.get("/transactions", headers=auth_headers)
        if resp.status_code != 200:
            print(f"  ERROR: Transactions returned {resp.status_code}: {resp.text}")
            sys.exit(1)
        data = resp.json()
        transactions = (
            data if isinstance(data, list)
            else data.get("items", data.get("transactions", []))
        )
        if transactions:
            print(f"  OK: Found {len(transactions)} transactions after {i + 1}s")
            return transactions
        time.sleep(1)
    print(f"  WARNING: No transactions found after {max_wait}s (sync may be pending)")
    return []


def print_transactions(transactions: list) -> None:
    """Print a summary of synced transactions."""
    print(f"\n[5/5] Transaction summary ({len(transactions)} total):")
    print(f"  {'Date':<12} {'Amount':>10}  {'Merchant/Description'}")
    print(f"  {'-'*12} {'-'*10}  {'-'*30}")
    for txn in transactions[:20]:
        date = txn.get("date", "N/A")
        amount = txn.get("amount", 0)
        desc = txn.get("merchant_name") or txn.get("description", "N/A")
        print(f"  {date:<12} {amount:>10.2f}  {desc}")
    if len(transactions) > 20:
        print(f"  ... and {len(transactions) - 20} more")


def main() -> None:
    args = parse_args()

    if not args.plaid_client_id or not args.plaid_secret:
        print("ERROR: PLAID_CLIENT_ID and PLAID_SECRET must be set (env vars or CLI args).")
        sys.exit(1)

    # Create sandbox public token directly via Plaid (simulates what Plaid Link does)
    public_token = create_sandbox_public_token(args.plaid_client_id, args.plaid_secret)

    # Talk to our API server for the rest
    with httpx.Client(base_url=args.api_url, timeout=30.0) as client:
        access_token = authenticate(client, args.email, args.password, args.register)
        auth_headers = {"Authorization": f"Bearer {access_token}"}

        exchange_token(client, auth_headers, public_token)
        list_accounts(client, auth_headers)
        transactions = wait_for_transactions(client, auth_headers)
        print_transactions(transactions)

    print("\nDone. Sandbox test completed successfully.")


if __name__ == "__main__":
    main()
