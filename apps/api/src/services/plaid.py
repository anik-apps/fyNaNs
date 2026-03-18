import asyncio
import time
import uuid
from datetime import UTC, datetime, timedelta
from datetime import date as date_type
from functools import lru_cache

import plaid
from jose import jwt as jose_jwt
from plaid.api import plaid_api
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.liabilities_get_request import LiabilitiesGetRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.security import decrypt_value, encrypt_value
from src.models.account import Account
from src.models.plaid_item import PlaidItem
from src.models.transaction import Transaction


class PlaidServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


@lru_cache(maxsize=1)
def _get_plaid_client() -> plaid_api.PlaidApi:
    env_map = {
        "sandbox": plaid.Environment.Sandbox,
        "development": plaid.Environment.Development,
        "production": plaid.Environment.Production,
    }
    configuration = plaid.Configuration(
        host=env_map.get(settings.plaid_env, plaid.Environment.Sandbox),
        api_key={
            "clientId": settings.plaid_client_id,
            "secret": settings.plaid_secret,
        },
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)


async def create_link_token(user_id: uuid.UUID) -> dict:
    """Create a Plaid Link token for the frontend."""
    client = _get_plaid_client()

    kwargs = {
        "user": LinkTokenCreateRequestUser(client_user_id=str(user_id)),
        "client_name": "fyNaNs",
        "products": [Products("transactions")],
        "country_codes": [CountryCode("US")],
        "language": "en",
    }
    if settings.plaid_webhook_url:
        kwargs["webhook"] = settings.plaid_webhook_url

    request = LinkTokenCreateRequest(**kwargs)

    response = await asyncio.to_thread(client.link_token_create, request)
    return {
        "link_token": response.link_token,
        "expiration": response.expiration,
    }


async def exchange_public_token(
    db: AsyncSession,
    user_id: uuid.UUID,
    public_token: str,
    institution_id: str,
    institution_name: str,
) -> tuple[PlaidItem, int]:
    """Exchange public token for access token, create PlaidItem and Accounts.

    Returns (plaid_item, num_accounts_linked).
    """
    client = _get_plaid_client()

    # Exchange public token
    exchange_request = ItemPublicTokenExchangeRequest(public_token=public_token)
    exchange_response = await asyncio.to_thread(client.item_public_token_exchange, exchange_request)

    access_token = exchange_response.access_token
    item_id = exchange_response.item_id

    # Check for duplicate item_id (retry safety)
    existing = await db.execute(
        select(PlaidItem).where(PlaidItem.item_id == item_id)
    )
    if existing.scalar_one_or_none():
        raise PlaidServiceError("This institution is already linked", 409)

    # Encrypt access token before storing
    encrypted_token = encrypt_value(access_token)

    plaid_item = PlaidItem(
        user_id=user_id,
        access_token=encrypted_token,
        item_id=item_id,
        institution_name=institution_name,
        status="active",
    )
    db.add(plaid_item)
    await db.flush()

    # Fetch accounts from Plaid
    from plaid.model.accounts_get_request import AccountsGetRequest

    accounts_request = AccountsGetRequest(access_token=access_token)
    accounts_response = await asyncio.to_thread(client.accounts_get, accounts_request)

    account_type_map = {
        "depository": "checking",
        "credit": "credit",
        "loan": "loan",
        "investment": "investment",
    }

    num_linked = 0
    for plaid_acct in accounts_response.accounts:
        # Map Plaid subtypes
        acct_type = account_type_map.get(
            plaid_acct.type.value if hasattr(plaid_acct.type, "value") else str(plaid_acct.type),
            "checking",
        )
        if plaid_acct.subtype and str(plaid_acct.subtype) == "savings":
            acct_type = "savings"

        account = Account(
            user_id=user_id,
            plaid_item_id=plaid_item.id,
            plaid_account_id=plaid_acct.account_id,
            institution_name=institution_name,
            name=plaid_acct.name,
            type=acct_type,
            balance=plaid_acct.balances.current or 0,
            currency=plaid_acct.balances.iso_currency_code or "USD",
            mask=plaid_acct.mask,
            is_manual=False,
        )
        db.add(account)
        num_linked += 1

    await db.commit()
    await db.refresh(plaid_item)
    return plaid_item, num_linked


async def get_decrypted_access_token(plaid_item: PlaidItem) -> str:
    """Decrypt a PlaidItem's access token."""
    return decrypt_value(plaid_item.access_token)


# --- Transaction Sync ---


async def _resolve_category_id(
    db: AsyncSession, plaid_category_primary: str | None
) -> uuid.UUID | None:
    """Map Plaid personal_finance_category to our Category by plaid_category column.

    The Category model has a `plaid_category` field that stores the Plaid primary
    category string (e.g., "FOOD_AND_DRINK"). We match directly on that column.
    Falls back to 'Uncategorized' if no match found.
    """
    if plaid_category_primary:
        from src.models.category import Category

        # Direct match on the plaid_category column
        result = await db.execute(
            select(Category).where(
                Category.is_system.is_(True),
                Category.plaid_category == plaid_category_primary,
            )
        )
        cat = result.scalar_one_or_none()
        if cat:
            return cat.id

    # Fallback to Uncategorized
    from src.models.category import Category

    result = await db.execute(
        select(Category).where(Category.name == "Uncategorized", Category.is_system.is_(True))
    )
    uncat = result.scalar_one_or_none()
    return uncat.id if uncat else None


async def _resolve_account_id(
    db: AsyncSession, plaid_account_id: str, user_id: uuid.UUID
) -> uuid.UUID | None:
    """Look up our Account by plaid_account_id."""
    result = await db.execute(
        select(Account).where(
            Account.plaid_account_id == plaid_account_id,
            Account.user_id == user_id,
        )
    )
    account = result.scalar_one_or_none()
    return account.id if account else None


async def sync_transactions(
    db: AsyncSession, plaid_item: PlaidItem
) -> dict[str, int]:
    """Sync transactions for a PlaidItem using Plaid's /transactions/sync endpoint.

    Uses stored cursor for incremental sync. Returns stats dict with added/modified/removed counts.
    """
    client = _get_plaid_client()
    access_token = decrypt_value(plaid_item.access_token)

    added_count = 0
    modified_count = 0
    removed_count = 0
    cursor = plaid_item.cursor or ""

    has_more = True
    while has_more:
        sync_request = TransactionsSyncRequest(
            access_token=access_token,
            cursor=cursor,
        )
        response = await asyncio.to_thread(client.transactions_sync, sync_request)

        # Process added transactions
        for txn in response.added:
            account_id = await _resolve_account_id(db, txn.account_id, plaid_item.user_id)
            if not account_id:
                continue

            plaid_primary = None
            if hasattr(txn, "personal_finance_category") and txn.personal_finance_category:
                plaid_primary = txn.personal_finance_category.primary

            category_id = await _resolve_category_id(db, plaid_primary)

            # Parse date
            txn_date = txn.date
            if isinstance(txn_date, str):
                txn_date = date_type.fromisoformat(txn_date)

            # Upsert: check if plaid_txn_id already exists
            existing = await db.execute(
                select(Transaction).where(Transaction.plaid_txn_id == txn.transaction_id)
            )
            if existing.scalar_one_or_none():
                continue  # Already exists, skip (will be handled by modified)

            new_txn = Transaction(
                user_id=plaid_item.user_id,
                account_id=account_id,
                plaid_txn_id=txn.transaction_id,
                amount=txn.amount,
                date=txn_date,
                description=txn.name,
                merchant_name=getattr(txn, "merchant_name", None),
                category_id=category_id,
                is_pending=txn.pending,
                is_manual=False,
            )
            db.add(new_txn)
            added_count += 1

        # Process modified transactions
        for txn in response.modified:
            result = await db.execute(
                select(Transaction).where(Transaction.plaid_txn_id == txn.transaction_id)
            )
            existing_txn = result.scalar_one_or_none()
            if existing_txn:
                existing_txn.amount = txn.amount
                txn_date = txn.date
                if isinstance(txn_date, str):
                    txn_date = date_type.fromisoformat(txn_date)
                existing_txn.date = txn_date
                existing_txn.description = txn.name
                existing_txn.merchant_name = getattr(txn, "merchant_name", None)
                existing_txn.is_pending = txn.pending

                # Re-resolve category on modification
                plaid_primary = None
                if hasattr(txn, "personal_finance_category") and txn.personal_finance_category:
                    plaid_primary = txn.personal_finance_category.primary
                existing_txn.category_id = await _resolve_category_id(db, plaid_primary)

                modified_count += 1

        # Process removed transactions
        for removed_txn in response.removed:
            result = await db.execute(
                select(Transaction).where(
                    Transaction.plaid_txn_id == removed_txn.transaction_id
                )
            )
            existing_txn = result.scalar_one_or_none()
            if existing_txn:
                await db.delete(existing_txn)
                removed_count += 1

        has_more = response.has_more
        cursor = response.next_cursor

    # Update cursor and last_synced_at on PlaidItem
    plaid_item.cursor = cursor
    plaid_item.last_synced_at = datetime.now(UTC)
    await db.commit()

    return {"added": added_count, "modified": modified_count, "removed": removed_count}


# --- Liabilities Sync ---


async def sync_liabilities(
    db: AsyncSession, plaid_item: PlaidItem
) -> dict[str, int]:
    """Sync credit card liabilities for a PlaidItem.

    Updates account balances and returns bill-relevant data.
    Only called for PlaidItems that have credit card accounts.
    """
    client = _get_plaid_client()
    access_token = decrypt_value(plaid_item.access_token)

    liab_request = LiabilitiesGetRequest(access_token=access_token)
    response = await asyncio.to_thread(client.liabilities_get, liab_request)

    credit_synced = 0
    liability_data = []

    if response.liabilities.credit:
        for credit in response.liabilities.credit:
            # Find matching account
            result = await db.execute(
                select(Account).where(
                    Account.plaid_account_id == credit.account_id,
                    Account.user_id == plaid_item.user_id,
                )
            )
            account = result.scalar_one_or_none()
            if not account:
                continue

            # Update account balance with statement balance
            if credit.last_statement_balance is not None:
                account.balance = credit.last_statement_balance

            liability_data.append({
                "account_id": account.id,
                "plaid_account_id": credit.account_id,
                "statement_balance": credit.last_statement_balance,
                "minimum_payment": credit.minimum_payment_amount,
                "next_due_date": (
                    str(credit.next_payment_due_date)
                    if credit.next_payment_due_date
                    else None
                ),
            })

            credit_synced += 1

    await db.commit()

    return {
        "credit_accounts_synced": credit_synced,
        "liability_data": liability_data,
    }


async def has_credit_accounts(db: AsyncSession, plaid_item: PlaidItem) -> bool:
    """Check if a PlaidItem has any credit card accounts (used for quota optimization)."""
    result = await db.execute(
        select(Account).where(
            Account.plaid_item_id == plaid_item.id,
            Account.type == "credit",
        ).limit(1)
    )
    return result.scalars().first() is not None


# --- Webhook Verification ---

# Cache for Plaid webhook verification keys (TTL: 24 hours per Plaid recommendation)
_webhook_key_cache: dict[str, tuple[dict, float]] = {}
_webhook_key_cache_lock = asyncio.Lock()
WEBHOOK_KEY_CACHE_TTL = 86400  # 24 hours


async def verify_plaid_webhook(body: bytes, plaid_verification_header: str | None) -> bool:
    """Verify Plaid webhook JWT signature.

    Uses cached public keys from Plaid's /webhook_verification_key/get endpoint.
    Returns True if verification passes or is skipped (dev mode).
    """
    if not plaid_verification_header:
        # In development, Plaid may not send verification header
        return settings.plaid_env == "sandbox"

    try:
        # Decode the JWT header to get the key_id
        unverified_header = jose_jwt.get_unverified_header(plaid_verification_header)
        key_id = unverified_header.get("kid")
        if not key_id:
            return False

        # Fetch or use cached verification key
        jwk = await _get_webhook_verification_key(key_id)
        if not jwk:
            return False

        # Verify the JWT
        claims = jose_jwt.decode(
            plaid_verification_header,
            jwk,
            algorithms=["ES256"],
        )

        # Verify the request body hash matches
        import hashlib
        body_hash = hashlib.sha256(body).hexdigest()
        return claims.get("request_body_sha256") == body_hash

    except Exception:
        # Log error but don't crash -- webhook processing is best-effort
        return settings.plaid_env == "sandbox"


async def _get_webhook_verification_key(key_id: str) -> dict | None:
    """Fetch Plaid's webhook verification public key, with caching."""
    async with _webhook_key_cache_lock:
        now = time.time()

        # Check cache
        if key_id in _webhook_key_cache:
            cached_key, cached_at = _webhook_key_cache[key_id]
            if now - cached_at < WEBHOOK_KEY_CACHE_TTL:
                return cached_key

        # Fetch from Plaid
        try:
            client = _get_plaid_client()
            from plaid.model.webhook_verification_key_get_request import (
                WebhookVerificationKeyGetRequest,
            )

            request = WebhookVerificationKeyGetRequest(key_id=key_id)
            response = await asyncio.to_thread(client.webhook_verification_key_get, request)
            key = response.key
            _webhook_key_cache[key_id] = (key, now)
            return key
        except Exception:
            return None


async def handle_webhook_event(
    db: AsyncSession, webhook_type: str, webhook_code: str, item_id: str
) -> None:
    """Process a Plaid webhook event."""
    if webhook_type == "TRANSACTIONS" and webhook_code == "SYNC_UPDATES_AVAILABLE":
        # Find the PlaidItem by item_id
        result = await db.execute(
            select(PlaidItem).where(PlaidItem.item_id == item_id)
        )
        plaid_item = result.scalar_one_or_none()
        if plaid_item and plaid_item.status == "active":
            await sync_transactions(db, plaid_item)

            # Also sync liabilities if credit accounts exist
            if await has_credit_accounts(db, plaid_item):
                await sync_liabilities(db, plaid_item)

    elif webhook_type == "ITEM" and webhook_code == "ERROR":
        result = await db.execute(
            select(PlaidItem).where(PlaidItem.item_id == item_id)
        )
        plaid_item = result.scalar_one_or_none()
        if plaid_item:
            plaid_item.status = "error"
            await db.commit()


# --- Plaid API Quota Strategy ---

# Fallback sync interval: 3 days instead of daily to conserve API quota
FALLBACK_SYNC_INTERVAL = timedelta(days=3)

# Skip fallback sync if webhook-driven sync happened within this window
WEBHOOK_RECENT_THRESHOLD = timedelta(hours=24)


def should_sync_item(plaid_item: PlaidItem) -> bool:
    """Determine if a PlaidItem should be synced in the fallback job.

    Quota strategy:
    - Skip items with error/revoked status
    - Skip items that received a webhook-driven sync in the last 24 hours
    - Only sync items that haven't been synced in 3+ days (or never synced)
    """
    if plaid_item.status != "active":
        return False

    if plaid_item.last_synced_at is None:
        return True  # Never synced

    now = datetime.now(UTC)
    last_synced = plaid_item.last_synced_at
    if last_synced.tzinfo is None:
        last_synced = last_synced.replace(tzinfo=UTC)
    time_since_sync = now - last_synced

    # Skip if recently synced (webhook likely handled it)
    if time_since_sync < WEBHOOK_RECENT_THRESHOLD:
        return False

    # Only sync if stale (3+ days)
    return time_since_sync >= FALLBACK_SYNC_INTERVAL


async def get_items_needing_sync(db: AsyncSession) -> list[PlaidItem]:
    """Get all active PlaidItems that need fallback sync."""
    result = await db.execute(
        select(PlaidItem).where(PlaidItem.status == "active")
    )
    all_items = result.scalars().all()
    return [item for item in all_items if should_sync_item(item)]
