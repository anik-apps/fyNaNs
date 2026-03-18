import uuid
from datetime import datetime, timezone

import plaid
from plaid.api import plaid_api
from plaid.model.country_code import CountryCode
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.products import Products
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.security import encrypt_value, decrypt_value
from src.models.account import Account
from src.models.plaid_item import PlaidItem


class PlaidServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


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

    kwargs = dict(
        user=LinkTokenCreateRequestUser(client_user_id=str(user_id)),
        client_name="fyNaNs",
        products=[Products("transactions")],
        country_codes=[CountryCode("US")],
        language="en",
    )
    if settings.plaid_webhook_url:
        kwargs["webhook"] = settings.plaid_webhook_url

    request = LinkTokenCreateRequest(**kwargs)

    response = client.link_token_create(request)
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
    exchange_response = client.item_public_token_exchange(exchange_request)

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
    accounts_response = client.accounts_get(accounts_request)

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

from datetime import date as date_type

from plaid.model.transactions_sync_request import TransactionsSyncRequest

from src.models.transaction import Transaction


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
        response = client.transactions_sync(sync_request)

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
    plaid_item.last_synced_at = datetime.now(timezone.utc)
    await db.commit()

    return {"added": added_count, "modified": modified_count, "removed": removed_count}
