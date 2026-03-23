# Plaid Sandbox Integration for Mobile App

**Date:** 2026-03-23
**Status:** Draft

## Overview

Add Plaid Link integration to the mobile app using the official `react-native-plaid-link-sdk`, with a dev-only sandbox toggle for testing. The backend already has full Plaid support — this work focuses on the mobile UI and a small backend addition for sandbox switching.

## Goals

- Let users link bank accounts from the mobile app via Plaid Link
- Enable sandbox testing through a dev settings screen (allowlisted users only)
- Display linked accounts with sync status indicators
- Lay the foundation for production Plaid use with no throwaway code

## Non-Goals

- Plaid OAuth redirect handling (not needed for sandbox)
- Webhook processing changes (backend already handles this)
- Re-authentication flow for expired Plaid connections
- iOS build configuration (Android-first)

## Architecture

The mobile app calls existing backend Plaid endpoints. No new backend Plaid logic is needed beyond a sandbox toggle parameter and a dev allowlist flag.

```
Mobile App                          Backend (existing)
─────────                          ─────────────────
Link Bank tap
  → POST /api/plaid/link-token     → Creates link token (sandbox or prod)
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

```
DEV_ALLOWLIST_EMAILS=test@kumaranik.com,anik@kumaranik.com
```

### 2. UserResponse Schema Update

Add `is_dev: bool` field to `UserResponse` in `apps/api/src/schemas/auth.py`. Set to `True` when the user's email appears in `DEV_ALLOWLIST_EMAILS`. This field drives visibility of the dev settings screen in the mobile app.

Update `UserResponse.from_user()` to accept a settings parameter or read from config to compute `is_dev`.

### 3. Link Token Endpoint Update

Modify `POST /api/plaid/link-token` to accept an optional `sandbox: bool` body parameter. When `True` and the requesting user is dev-allowlisted, use sandbox Plaid credentials. Otherwise, use the environment's default Plaid configuration.

This requires the backend to hold both sandbox and production Plaid credentials simultaneously, selecting based on the request parameter.

## Mobile App Changes

### 1. New Dependency

Install `react-native-plaid-link-sdk`. This is a native dependency requiring a new EAS build.

### 2. Dev Settings Screen

- New screen accessible from profile/settings area
- Only rendered when `user.is_dev === true`
- Contains a toggle: "Use Plaid Sandbox"
- Toggle state persisted locally via AsyncStorage or expo-secure-store
- When sandbox is on, the app passes `sandbox: true` to `/api/plaid/link-token`

### 3. Add Account Screen Redesign

Current: manual-only form with fields for name, institution, type, balance.

New layout:
- **Top section:** "Link Bank Account" button (prominent, primary color, gradient background). Tapping launches the Plaid Link flow.
- **Divider:** "or add manually" text separator
- **Bottom section:** existing manual account form (name, institution, type, balance)

### 4. Empty State Update (Accounts Tab)

Current: "No accounts yet" with single "Add Account" button.

New layout:
- "No accounts yet" message
- "Link your bank for automatic tracking" description
- Primary CTA: "Link Bank Account" button
- Secondary: "or add manually" text link that navigates to the Add Account screen scrolled to the manual form

### 5. Plaid Link Flow Implementation

New file: `apps/mobile/src/lib/plaid.ts`

```
1. Read sandbox toggle from local storage
2. Call POST /api/plaid/link-token with { sandbox } flag
3. Receive link_token from backend
4. Call PlaidLink.open({ token: link_token }) from react-native-plaid-link-sdk
5. On success: receive public_token and metadata
6. Call POST /api/plaid/exchange-token with { public_token, metadata }
7. On completion: navigate back to accounts list
8. On exit/error: show appropriate alert
```

### 6. Account Card Updates

File: `apps/mobile/src/components/accounts/AccountCard.tsx`

For linked accounts (`is_manual === false`):
- Show a small "LINKED" badge next to account name (compact, small font size ~7px, blue background, uppercase)
- Below the name: sync status line with colored dot + timestamp
  - Green dot + "Synced 2h ago" — fresh (synced within 3 days)
  - Amber dot + "Synced 3d ago" + "↻ Sync" link — stale (3+ days since sync)
- "Sync" link calls `POST /api/plaid/items/{item_id}/sync`

For manual accounts (`is_manual === true`):
- Show "Manual" label in the subtitle area (gray text)
- No sync indicators

### 7. Account Response Data Requirements

The existing `AccountResponse` schema already includes `is_manual` and `plaid_item_id`. The mobile app will need `plaid_item_id` to call the sync endpoint. No schema changes needed for account responses.

For sync status, the app will need the Plaid item's `last_synced_at` timestamp. Options:
- Add `last_synced_at: datetime | None` to `AccountResponse`
- Or fetch it from a separate endpoint

Adding it to `AccountResponse` is simpler and avoids extra API calls. The backend can join through the `plaid_item` relationship to get `PlaidItem.last_synced_at`.

## File Changes Summary

### Backend (apps/api/)
| File | Change |
|------|--------|
| `src/core/settings.py` | Add `dev_allowlist_emails: list[str]` from env var |
| `src/schemas/auth.py` | Add `is_dev: bool` to `UserResponse` |
| `src/schemas/auth.py` | Update `from_user()` to compute `is_dev` |
| `src/schemas/account.py` | Add `last_synced_at: datetime \| None` to `AccountResponse` |
| `src/routers/accounts.py` | Include `last_synced_at` from PlaidItem relationship |
| `src/schemas/plaid.py` | Add `sandbox: bool = False` to `LinkTokenRequest` |
| `src/services/plaid.py` | Select Plaid environment based on sandbox param + dev allowlist |

### Mobile (apps/mobile/)
| File | Change |
|------|--------|
| `package.json` | Add `react-native-plaid-link-sdk` dependency |
| `app.json` | Add Plaid SDK plugin if needed |
| `src/lib/plaid.ts` | New — Plaid Link flow (create token, open link, exchange token) |
| `src/lib/constants.ts` | Add AsyncStorage key for sandbox toggle |
| `app/(tabs)/accounts/index.tsx` | Update empty state with Link Bank CTA |
| `app/(tabs)/accounts/add.tsx` | Add Link Bank button above manual form |
| `app/settings/dev.tsx` | New — Dev settings screen with sandbox toggle |
| `src/components/accounts/AccountCard.tsx` | Add LINKED badge, sync status, sync button |
| `src/providers/AuthProvider.tsx` | Expose `is_dev` from user data |

## Sandbox Testing Flow

1. Set `DEV_ALLOWLIST_EMAILS=test@kumaranik.com` on the backend
2. Log in as `test@kumaranik.com` in the mobile app
3. Navigate to Settings → Dev Settings (visible because `is_dev` is true)
4. Enable "Use Plaid Sandbox" toggle
5. Go to Accounts → Add Account → "Link Bank Account"
6. Plaid Link opens in sandbox mode
7. Use test credentials: `user_good` / `pass_good`
8. Select test accounts from the sandbox bank
9. Accounts appear in the list with realistic balances and transactions
10. Verify account cards show LINKED badge and sync status

## Dependencies

- `react-native-plaid-link-sdk` — native dependency, requires new EAS build
- Backend must have both sandbox and production Plaid API keys configured
