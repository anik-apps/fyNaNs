# Plaid Sandbox Integration for Mobile App

**Date:** 2026-03-23
**Status:** Draft

## Overview

Add Plaid Link integration to the mobile app using the official `react-native-plaid-link-sdk`, with a dev-only sandbox toggle for testing. The backend already has full Plaid support — this work focuses on the mobile UI and targeted backend changes for sandbox switching and dev allowlisting.

## Goals

- Let users link bank accounts from the mobile app via Plaid Link
- Enable sandbox testing through a dev settings screen (allowlisted users only)
- Display linked accounts with sync status indicators
- Lay the foundation for production Plaid use with no throwaway code

## Non-Goals

- **Plaid OAuth redirect handling** — not needed for sandbox. Note: many major US banks (Chase, Capital One) require OAuth for production. This must be implemented before production launch and should be tracked as a follow-up.
- Webhook processing changes (backend already handles this)
- Re-authentication flow for expired Plaid connections
- iOS build configuration (Android-first)

## Architecture

The mobile app calls existing backend Plaid endpoints. Backend changes are needed for dual-environment Plaid client support and a server-side sandbox toggle.

```
Mobile App                          Backend
─────────                          ─────────────────
Link Bank tap
  → POST /api/plaid/link-token     → Creates link token (sandbox or prod based on server-side toggle)
    ← link_token
  → Open Plaid Link (native SDK)
  → User completes flow
  → POST /api/plaid/exchange-token → Exchanges token, creates accounts, syncs txns
    ← success
  → Navigate back, refresh list
```

## Backend Changes

### 1. Dev Allowlist via Environment Variable

Add `DEV_ALLOWLIST_EMAILS` env var containing comma-separated email addresses.

File: `apps/api/src/core/config.py`

```
DEV_ALLOWLIST_EMAILS=test@kumaranik.com,anik@kumaranik.com
```

Add `dev_allowlist_emails: list[str]` setting that parses this env var.

### 2. UserResponse Schema Update

Add `is_dev: bool` field to `UserResponse` in `apps/api/src/schemas/auth.py`.

Compute `is_dev` in the router/service layer (not in the schema) to avoid coupling schemas to config:

```python
UserResponse.from_user(user, is_dev=user.email in settings.dev_allowlist_emails)
```

Update `from_user()` to accept an `is_dev: bool = False` parameter.

### 3. Server-Side Sandbox Toggle

The sandbox toggle is a **server-side setting**, not a client request parameter. This prevents non-dev users from forcing sandbox mode.

Add a protected endpoint for dev-allowlisted users:

```
POST /api/dev/sandbox-toggle
Body: { "enabled": true }
```

This endpoint:
- Verifies the user is in the dev allowlist (403 otherwise)
- Stores the sandbox preference as a `use_plaid_sandbox: bool = False` column on the User model (simpler than a separate table for a single field)
- Returns the current state: `{ "enabled": true/false }`

Also add a read endpoint:

```
GET /api/dev/sandbox-toggle
Response: { "enabled": true/false }
```

This lets the mobile dev settings screen read the current state on mount.

When `POST /api/plaid/link-token` is called, the backend checks the user's `use_plaid_sandbox` preference (if they're dev-allowlisted) and selects the appropriate Plaid client. No sandbox flag is sent from the client.

### 4. Dual Plaid Client Support

The existing `_get_plaid_client()` in `services/plaid.py` uses `@lru_cache(maxsize=1)` and builds a single `PlaidApi` from global settings. This cannot switch environments per-request.

Required changes:
- Add separate env vars: `PLAID_SANDBOX_CLIENT_ID` and `PLAID_SANDBOX_SECRET` to `config.py`
- Replace `_get_plaid_client()` with a factory that accepts an environment parameter and caches per-environment (`@lru_cache` keyed by env string, `maxsize=2`)
- `create_link_token()` signature changes to accept environment and select the appropriate client
- All service functions operating on an existing PlaidItem (`exchange_public_token`, `sync_transactions`, `sync_liabilities`, etc.) must derive the environment from `PlaidItem.environment`, not from the user's current toggle. This ensures sandbox items always use sandbox credentials and production items always use production credentials, regardless of the user's current toggle state.
- Add a safety check: refuse sandbox mode when `PLAID_ENV == "production"` (belt and suspenders)

### 5. PlaidItem Environment Tracking

Add `environment: str` column to the `PlaidItem` model (values: `"sandbox"` or `"production"`). This distinguishes sandbox items from production items so sandbox test data can be filtered out or cleaned up.

### 6. AccountResponse Update

Add `last_synced_at: datetime | None` to `AccountResponse` in `apps/api/src/schemas/account.py`. Populated by joining through the `plaid_item` relationship to `PlaidItem.last_synced_at`. `None` for manual accounts.

### 7. Sync Rate Limiting

Add a named constant `MIN_SYNC_INTERVAL = timedelta(minutes=5)` for the minimum interval between manual syncs. The `POST /api/plaid/items/{item_id}/sync` endpoint should check `last_synced_at` and return 429 if synced too recently. The 3-day "stale" threshold for UI display is derived from the backend's `FALLBACK_SYNC_INTERVAL = timedelta(days=3)` constant. Both intervals should be exposed via a config API or included in the account response so the mobile app doesn't hardcode them.

## Mobile App Changes

### 1. New Dependency

Install `react-native-plaid-link-sdk`. This is a native dependency requiring a new EAS build.

The SDK ships an Expo config plugin. Add to `app.json` plugins array:

```json
["react-native-plaid-link-sdk"]
```

### 2. Dev Settings Screen

New file: `apps/mobile/app/settings/dev.tsx`

- Accessible from profile/settings area
- Only rendered when `user.is_dev === true`
- Contains a toggle: "Use Plaid Sandbox"
- Toggle calls `POST /api/dev/sandbox-toggle` to persist state server-side
- Reads current state from the user's dev settings on mount

### 3. Add Account Screen Redesign

File: `apps/mobile/app/(tabs)/accounts/add.tsx`

Current: manual-only form with fields for name, institution, type, balance.

New layout:
- **Top section:** "Link Bank Account" button (prominent, primary color, gradient background). Tapping launches the Plaid Link flow.
- **Divider:** "or add manually" text separator
- **Bottom section:** existing manual account form (name, institution, type, balance)

### 4. Empty State Update (Accounts Tab)

File: `apps/mobile/app/(tabs)/accounts/index.tsx`

Current: "No accounts yet" with single "Add Account" button.

New layout:
- "No accounts yet" message
- "Link your bank for automatic tracking" description
- Primary CTA: "Link Bank Account" button
- Secondary: "or add manually" text link that navigates to the Add Account screen

### 5. Plaid Link Flow Implementation

New file: `apps/mobile/src/lib/plaid.ts`

```
1. Call POST /api/plaid/link-token (backend determines sandbox/prod based on server-side toggle)
2. Receive link_token from backend
3. Call PlaidLink.open({ token: link_token }) from react-native-plaid-link-sdk
4. On success: receive public_token and metadata
5. Call POST /api/plaid/exchange-token with { public_token, metadata }
6. On completion: navigate back to accounts list
7. On exit/error: show appropriate alert
```

### 6. Account Card Updates

File: `apps/mobile/src/components/accounts/AccountCard.tsx`

For linked accounts (`is_manual === false`):
- Show a small "LINKED" badge next to account name (compact, ~7px font, blue background, uppercase — kept small to avoid crowding the horizontal line)
- Below the name: sync status line with colored dot + timestamp
  - Green dot + "Synced 2h ago" — fresh (synced within `FALLBACK_SYNC_INTERVAL`)
  - Amber dot + "Synced 3d ago" + "↻ Sync" link — stale (exceeds interval)
- "Sync" link calls `POST /api/plaid/items/{item_id}/sync`
- Client-side debounce: disable Sync button for 5 minutes after tapping (matches server-side rate limit)

For manual accounts (`is_manual === true`):
- Show "Manual" label in the subtitle area (gray text)
- No sync indicators

### 7. Account Response Data Requirements

The existing `AccountResponse` schema already includes `is_manual` and `plaid_item_id`. The mobile app needs `plaid_item_id` to call the sync endpoint.

Adding `last_synced_at` to `AccountResponse` (see Backend Changes §6) provides sync status without extra API calls.

## File Changes Summary

### Backend (apps/api/)
| File | Change |
|------|--------|
| `src/core/config.py` | Add `dev_allowlist_emails`, `plaid_sandbox_client_id`, `plaid_sandbox_secret` |
| `src/schemas/auth.py` | Add `is_dev: bool` to `UserResponse`, update `from_user(is_dev=)` |
| `src/schemas/account.py` | Add `last_synced_at: datetime \| None` to `AccountResponse` |
| `src/routers/accounts.py` | Include `last_synced_at` from PlaidItem relationship |
| `src/models/plaid_item.py` | Add `environment: str` column |
| `src/services/plaid.py` | Dual-client factory, environment-aware `create_link_token()` |
| `src/routers/plaid.py` | Pass environment to `create_link_token()` based on user's dev settings |
| `src/models/user.py` | Add `use_plaid_sandbox: bool = False` column |
| `src/routers/dev.py` | New — `GET/POST /api/dev/sandbox-toggle` (dev-allowlisted users only) |

### Mobile (apps/mobile/)
| File | Change |
|------|--------|
| `package.json` | Add `react-native-plaid-link-sdk` dependency |
| `app.json` | Add `react-native-plaid-link-sdk` to plugins array |
| `src/lib/plaid.ts` | New — Plaid Link flow (create token, open link, exchange token) |
| `app/(tabs)/accounts/index.tsx` | Update empty state with Link Bank CTA |
| `app/(tabs)/accounts/add.tsx` | Add Link Bank button above manual form |
| `app/settings/dev.tsx` | New — Dev settings screen with sandbox toggle |
| `src/components/accounts/AccountCard.tsx` | Add LINKED badge, sync status, sync button |
| `src/providers/AuthProvider.tsx` | Expose `is_dev` from user data |

## Sandbox Testing Flow

1. Set `DEV_ALLOWLIST_EMAILS=test@kumaranik.com` and `PLAID_SANDBOX_CLIENT_ID`/`PLAID_SANDBOX_SECRET` on the backend
2. Log in as `test@kumaranik.com` in the mobile app
3. Navigate to Settings → Dev Settings (visible because `is_dev` is true)
4. Enable "Use Plaid Sandbox" toggle (persists server-side)
5. Go to Accounts → Add Account → "Link Bank Account"
6. Plaid Link opens in sandbox mode
7. Use test credentials: `user_good` / `pass_good`
8. Select test accounts from the sandbox bank
9. Accounts appear in the list with realistic balances and transactions
10. Verify account cards show LINKED badge and sync status
11. Sandbox PlaidItems are tagged with `environment: "sandbox"` in the database

## Dependencies

- `react-native-plaid-link-sdk` — native dependency, requires new EAS build
- Backend must have both sandbox and production Plaid API keys configured
- Database migration for `PlaidItem.environment` column
