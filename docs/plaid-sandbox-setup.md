# Plaid Sandbox Setup

This guide walks through setting up and testing Plaid integration locally using the **sandbox** environment. Sandbox is free, requires no approval, and returns realistic test data.

## 1. Get Plaid Sandbox API Keys

1. Sign up at [https://dashboard.plaid.com](https://dashboard.plaid.com) (free).
2. Navigate to **Developers > Keys** ([direct link](https://dashboard.plaid.com/developers/keys)).
3. Copy your **client_id** and **Sandbox secret**.

No application approval is required for sandbox access.

## 2. Configure the `.env` File

Copy `.env.example` to `.env` (in the `apps/api` directory or project root, depending on your setup) and fill in the Plaid keys:

```env
PLAID_CLIENT_ID=<your client_id from the dashboard>
PLAID_SECRET=<your sandbox secret>
PLAID_ENV=sandbox
PLAID_WEBHOOK_URL=http://localhost:8888/api/plaid/webhook
```

The API server reads these from environment via `pydantic-settings` (see `apps/api/src/core/config.py`).

## 3. Test Bank Linking with Plaid Sandbox

### Using the Web UI

1. Start the API server: `cd apps/api && poetry run uvicorn src.main:app --port 8888`
2. Start the web dev server: `cd apps/web && pnpm dev`
3. Register/log in, go to **Accounts**, and click **Link Bank**.
4. In the Plaid Link modal, select **First Platypus Bank**.
5. Enter sandbox test credentials:
   - **Username:** `user_good`
   - **Password:** `pass_good`
6. Select one or more accounts and confirm. The accounts appear in your account list.

### Using the Sandbox Public Token Flow (CLI)

The `scripts/plaid-sandbox-test.py` script automates the full flow without the UI:

```bash
cd apps/api
poetry run python ../../scripts/plaid-sandbox-test.py \
  --api-url http://localhost:8888/api \
  --email you@example.com \
  --password YourPassword123!
```

This creates a sandbox public token via the Plaid API, exchanges it through your API, triggers a transaction sync, and prints the results.

## 4. Trigger Test Webhooks

Plaid sandbox supports firing test webhooks via the API. Use the `sandbox/item/fire_webhook` endpoint:

```bash
curl -X POST https://sandbox.plaid.com/sandbox/item/fire_webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "client_id": "<PLAID_CLIENT_ID>",
    "secret": "<PLAID_SECRET>",
    "access_token": "<access_token from exchange>",
    "webhook_type": "TRANSACTIONS",
    "webhook_code": "SYNC_UPDATES_AVAILABLE"
  }'
```

For this to reach your local server, you need a public URL. Options:
- Use `ngrok http 8888` and set `PLAID_WEBHOOK_URL` to the ngrok URL.
- Use Plaid's sandbox webhook testing which does not require a reachable URL (the API response confirms delivery).

## 5. Test Transaction Data

Plaid sandbox returns realistic test transactions for linked accounts. Typical data includes:

| Field | Example |
|---|---|
| `name` | "United Airlines", "Tectra Inc", "KFC" |
| `amount` | 5.40, 500.00, 12.00 |
| `date` | Recent dates (within last 30 days) |
| `category` | "Travel", "Food and Drink", "Transfer" |
| `merchant_name` | "United Airlines", "KFC" |
| `pending` | true/false |

Sandbox generates approximately 10-20 transactions per account on initial sync.

## 6. Full Flow: Link, Sync, View Transactions

1. **Link:** Click "Link Bank" in the web UI (or use the CLI script) to connect First Platypus Bank.
2. **Sync:** Transaction sync happens automatically after linking. You can also trigger it via webhook or wait for the fallback sync job.
3. **View:** Navigate to the **Transactions** page to see sandbox transactions. They include realistic merchant names, amounts, and categories.

### Integration Tests

Run the Plaid sandbox integration tests (requires `PLAID_CLIENT_ID` and `PLAID_SECRET` to be set):

```bash
cd apps/api
poetry run pytest tests/integration/test_plaid_sandbox.py -v
```

Tests are skipped automatically in CI when Plaid credentials are not configured.
