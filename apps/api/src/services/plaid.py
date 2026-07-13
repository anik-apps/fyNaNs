import asyncio
import logging
import time
import uuid
from datetime import UTC, datetime, timedelta
from datetime import date as date_type
from functools import lru_cache

import plaid
from fastapi import BackgroundTasks
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
from src.core.metrics import PLAID_ACCOUNTS_LINKED, PLAID_API_CALLS, PLAID_SYNC, TRANSACTIONS
from src.core.security import decrypt_value, encrypt_value
from src.models.account import Account
from src.models.category import Category
from src.models.plaid_item import PlaidItem
from src.models.transaction import Transaction

logger = logging.getLogger(__name__)


class PlaidServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


@lru_cache(maxsize=2)
def get_plaid_client(environment: str = "") -> plaid_api.PlaidApi:
    """Get a Plaid API client for the given environment. Cached per environment."""
    env = environment or settings.plaid_env
    env_map = {
        "sandbox": plaid.Environment.Sandbox,
        # Our plaid-python SDK only exposes Sandbox + Production
        "development": plaid.Environment.Sandbox,
        "production": plaid.Environment.Production,
    }
    if env == "sandbox" and settings.plaid_sandbox_client_id and settings.plaid_sandbox_secret:
        client_id = settings.plaid_sandbox_client_id
        secret = settings.plaid_sandbox_secret
    else:
        client_id = settings.plaid_client_id
        secret = settings.plaid_secret
    configuration = plaid.Configuration(
        host=env_map.get(env, plaid.Environment.Sandbox),
        api_key={"clientId": client_id, "secret": secret},
    )
    return plaid_api.PlaidApi(plaid.ApiClient(configuration))


async def create_link_token(user_id: uuid.UUID, environment: str = "") -> dict:
    """Create a Plaid Link token for the frontend."""
    client = get_plaid_client(environment)

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

    PLAID_API_CALLS.inc()
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
    environment: str = "",
) -> tuple[PlaidItem, int]:
    """Exchange public token for access token, create PlaidItem and Accounts.

    Returns (plaid_item, num_accounts_linked).
    """
    client = get_plaid_client(environment)

    # Exchange public token
    exchange_request = ItemPublicTokenExchangeRequest(public_token=public_token)
    PLAID_API_CALLS.inc()
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
        environment=environment or settings.plaid_env,
        status="active",
    )
    db.add(plaid_item)
    await db.flush()

    # Fetch accounts from Plaid
    from plaid.model.accounts_get_request import AccountsGetRequest

    accounts_request = AccountsGetRequest(access_token=access_token)
    PLAID_API_CALLS.inc()
    accounts_response = await asyncio.to_thread(client.accounts_get, accounts_request)

    account_type_map = {
        "depository": "checking",
        "credit": "credit",
        "loan": "loan",
        "investment": "investment",
    }

    num_linked = 0
    for plaid_acct in accounts_response.accounts:
        # Dedup: check by plaid_account_id first (same link session retry),
        # then by name+mask (same real account across different link sessions)
        existing_result = await db.execute(
            select(Account).where(
                Account.user_id == user_id,
                Account.plaid_account_id == plaid_acct.account_id,
            )
        )
        existing_acct = existing_result.scalars().first()

        if not existing_acct and plaid_acct.mask:
            # Fallback: match by institution + name + last 4 digits
            fallback_result = await db.execute(
                select(Account).where(
                    Account.user_id == user_id,
                    Account.institution_name == institution_name,
                    Account.name == plaid_acct.name,
                    Account.mask == plaid_acct.mask,
                )
            )
            existing_acct = fallback_result.scalars().first()

        if existing_acct:
            # Update existing account with fresh data from Plaid
            existing_acct.balance = plaid_acct.balances.current or 0
            existing_acct.plaid_item_id = plaid_item.id
            existing_acct.plaid_account_id = plaid_acct.account_id
            existing_acct.is_manual = False
            continue

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
    PLAID_ACCOUNTS_LINKED.inc(num_linked)
    return plaid_item, num_linked


async def get_decrypted_access_token(plaid_item: PlaidItem) -> str:
    """Decrypt a PlaidItem's access token."""
    return decrypt_value(plaid_item.access_token)


# --- Transaction Sync ---


# Plaid personal_finance_category.primary -> our parent category name
_PLAID_PRIMARY_MAP: dict[str, str] = {
    "INCOME": "Income",
    "TRANSFER_IN": "Income",
    "TRANSFER_OUT": "Transfer",
    "LOAN_PAYMENTS": "Transfer",
    "BANK_FEES": "Fees & Charges",
    "INTEREST_EARNED": "Income",
    "ENTERTAINMENT": "Entertainment",
    "FOOD_AND_DRINK": "Food & Drink",
    "GENERAL_MERCHANDISE": "Shopping",
    "HOME_IMPROVEMENT": "Housing",
    "MEDICAL": "Health",
    "PERSONAL_CARE": "Personal",
    "GENERAL_SERVICES": "Personal",
    "GOVERNMENT_AND_NON_PROFIT": "Gifts & Donations",
    "TRANSPORTATION": "Transportation",
    "TRAVEL": "Transportation",
    "RENT_AND_UTILITIES": "Housing",
    "EDUCATION": "Education",
}

# Plaid personal_finance_category.detailed -> our subcategory name
# Falls back to primary mapping if no detailed match
_PLAID_DETAILED_MAP: dict[str, str] = {
    # Food & Drink subcategories
    "FOOD_AND_DRINK_GROCERIES": "Groceries",
    "FOOD_AND_DRINK_RESTAURANT": "Restaurants",
    "FOOD_AND_DRINK_COFFEE": "Restaurants",
    "FOOD_AND_DRINK_FAST_FOOD": "Restaurants",
    "FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR": "Groceries",
    # Transportation subcategories
    "TRANSPORTATION_GAS": "Gas",
    "TRANSPORTATION_PUBLIC_TRANSIT": "Public Transit",
    "TRANSPORTATION_TAXI": "Rideshare",
    "TRANSPORTATION_PARKING": "Transportation",
    "TRAVEL_FLIGHTS": "Transportation",
    "TRAVEL_LODGING": "Transportation",
    # Housing subcategories
    "RENT_AND_UTILITIES_RENT": "Rent",
    "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY": "Utilities",
    "RENT_AND_UTILITIES_WATER": "Utilities",
    "RENT_AND_UTILITIES_INTERNET_AND_CABLE": "Utilities",
    "RENT_AND_UTILITIES_TELEPHONE": "Utilities",
    "HOME_IMPROVEMENT_FURNITURE": "Housing",
    "HOME_IMPROVEMENT_HARDWARE": "Housing",
    # Shopping subcategories
    "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES": "Clothing",
    "GENERAL_MERCHANDISE_ELECTRONICS": "Electronics",
    "GENERAL_MERCHANDISE_DEPARTMENT_STORES": "General",
    "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES": "General",
    # Health subcategories
    "MEDICAL_PHARMACIES_AND_SUPPLEMENTS": "Pharmacy",
    "MEDICAL_DENTIST_AND_OPTOMETRIST": "Doctor",
    "MEDICAL_VETERINARY_SERVICES": "Health",
    # Entertainment subcategories
    "ENTERTAINMENT_MUSIC_AND_AUDIO": "Streaming",
    "ENTERTAINMENT_TV_AND_MOVIES": "Streaming",
    "ENTERTAINMENT_VIDEO_GAMES": "Hobbies",
    "ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS": "Events",
    # Income subcategories
    "INCOME_WAGES": "Salary",
    "INCOME_DIVIDENDS": "Investments",
    "INCOME_INTEREST_EARNED": "Investments",
    "TRANSFER_IN_DEPOSIT": "Other Income",
    # Personal
    "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS": "Fitness",
}

# Keep backward compatibility alias
_PLAID_CATEGORY_MAP = _PLAID_PRIMARY_MAP


class _CategoryResolver:
    """In-memory Plaid personal_finance_category -> Category.id resolver.

    Built once per sync run from all system categories so that per-transaction
    resolution needs zero DB round-trips. Replicates the previous per-row
    query semantics exactly:
    1. Try detailed category → subcategory (e.g., FOOD_AND_DRINK_GROCERIES → Groceries),
       disambiguated by the resolved parent category
    2. Try primary category → parent (e.g., FOOD_AND_DRINK → Food & Drink)
    3. Try direct plaid_category column match (legacy, case-sensitive)
    4. Fallback to Uncategorized
    """

    def __init__(self, system_categories: list[Category]):
        self._parent_by_name: dict[str, uuid.UUID] = {}
        self._sub_by_parent_and_name: dict[tuple[uuid.UUID, str], uuid.UUID] = {}
        self._legacy_by_plaid_category: dict[str, uuid.UUID] = {}
        self._uncategorized_id: uuid.UUID | None = None
        for cat in system_categories:
            if cat.parent_id is None:
                self._parent_by_name.setdefault(cat.name, cat.id)
            else:
                self._sub_by_parent_and_name.setdefault((cat.parent_id, cat.name), cat.id)
            if cat.plaid_category is not None:
                self._legacy_by_plaid_category.setdefault(cat.plaid_category, cat.id)
            if self._uncategorized_id is None and cat.name == "Uncategorized":
                self._uncategorized_id = cat.id

    def resolve(
        self,
        plaid_category_primary: str | None,
        plaid_category_detailed: str | None = None,
    ) -> uuid.UUID | None:
        # 1. Try detailed → subcategory
        if plaid_category_detailed:
            our_sub_name = _PLAID_DETAILED_MAP.get(plaid_category_detailed.upper())
            if our_sub_name and plaid_category_primary:
                # Resolve parent category first to disambiguate subcategories
                parent_name = _PLAID_PRIMARY_MAP.get(plaid_category_primary.upper())
                if parent_name:
                    parent_id = self._parent_by_name.get(parent_name)
                    if parent_id:
                        sub_id = self._sub_by_parent_and_name.get((parent_id, our_sub_name))
                        if sub_id:
                            return sub_id

        # 2. Try primary → parent category
        if plaid_category_primary:
            our_category_name = _PLAID_PRIMARY_MAP.get(plaid_category_primary.upper())
            if our_category_name:
                parent_id = self._parent_by_name.get(our_category_name)
                if parent_id:
                    return parent_id

            # 3. Legacy: direct plaid_category column match
            legacy_id = self._legacy_by_plaid_category.get(plaid_category_primary)
            if legacy_id:
                return legacy_id

        # 4. Fallback to Uncategorized
        return self._uncategorized_id


async def _load_category_resolver(db: AsyncSession) -> _CategoryResolver:
    """Load all system categories in one query and build the resolver."""
    result = await db.execute(select(Category).where(Category.is_system.is_(True)))
    return _CategoryResolver(list(result.scalars().all()))


async def _load_account_map(db: AsyncSession, user_id: uuid.UUID) -> dict[str, uuid.UUID]:
    """Map plaid_account_id -> our Account.id for a user, in one query."""
    result = await db.execute(
        select(Account.plaid_account_id, Account.id).where(
            Account.user_id == user_id,
            Account.plaid_account_id.is_not(None),
        )
    )
    return dict(result.all())


async def _fetch_transactions_by_plaid_ids(
    db: AsyncSession, user_id: uuid.UUID, plaid_txn_ids: list[str]
) -> dict[str, Transaction]:
    """Batch-fetch a user's transactions by plaid_txn_id in one query."""
    if not plaid_txn_ids:
        return {}
    result = await db.execute(
        select(Transaction).where(
            Transaction.plaid_txn_id.in_(plaid_txn_ids),
            Transaction.user_id == user_id,
        )
    )
    return {txn.plaid_txn_id: txn for txn in result.scalars().all()}


def _extract_plaid_categories(txn) -> tuple[str | None, str | None]:
    """Extract (primary, detailed) from a Plaid transaction's personal_finance_category."""
    if hasattr(txn, "personal_finance_category") and txn.personal_finance_category:
        return (
            txn.personal_finance_category.primary,
            getattr(txn.personal_finance_category, "detailed", None),
        )
    return None, None


def _parse_txn_date(raw_date) -> date_type:
    """Plaid may return the date as a str or a date object."""
    if isinstance(raw_date, str):
        return date_type.fromisoformat(raw_date)
    return raw_date


async def sync_transactions(
    db: AsyncSession, plaid_item: PlaidItem
) -> dict[str, int]:
    """Sync transactions for a PlaidItem using Plaid's /transactions/sync endpoint.

    Uses stored cursor for incremental sync. Returns stats dict with added/modified/removed counts.

    Accounts and system categories are preloaded once per run, and per-page
    lookups are batched, so DB round-trips scale with pages, not transactions.
    """
    client = get_plaid_client(plaid_item.environment)
    access_token = decrypt_value(plaid_item.access_token)

    # Preload static lookups once per sync run (1 query each)
    account_map = await _load_account_map(db, plaid_item.user_id)
    category_resolver = await _load_category_resolver(db)

    added_count = 0
    modified_count = 0
    removed_count = 0
    cursor = plaid_item.cursor or ""

    # plaid_txn_ids inserted during this run: the same transaction can appear
    # in `added` on more than one page; without this we'd insert duplicates
    # and hit the unique constraint on plaid_txn_id.
    inserted_this_run: set[str] = set()

    has_more = True
    while has_more:
        sync_request = TransactionsSyncRequest(
            access_token=access_token,
            cursor=cursor,
        )
        PLAID_API_CALLS.inc()
        response = await asyncio.to_thread(client.transactions_sync, sync_request)

        # Process added transactions: one existence query for the whole page
        existing_txn_ids: set[str] = set()
        added_txn_ids = [txn.transaction_id for txn in response.added]
        if added_txn_ids:
            existing_result = await db.execute(
                select(Transaction.plaid_txn_id).where(
                    Transaction.plaid_txn_id.in_(added_txn_ids),
                    Transaction.user_id == plaid_item.user_id,
                )
            )
            existing_txn_ids = set(existing_result.scalars().all())

        new_rows: list[Transaction] = []
        for txn in response.added:
            account_id = account_map.get(txn.account_id)
            if not account_id:
                continue

            if txn.transaction_id in existing_txn_ids or txn.transaction_id in inserted_this_run:
                continue  # Already exists, skip (will be handled by modified)

            plaid_primary, plaid_detailed = _extract_plaid_categories(txn)
            new_rows.append(
                Transaction(
                    user_id=plaid_item.user_id,
                    account_id=account_id,
                    plaid_txn_id=txn.transaction_id,
                    amount=txn.amount,
                    date=_parse_txn_date(txn.date),
                    description=txn.name,
                    merchant_name=getattr(txn, "merchant_name", None),
                    category_id=category_resolver.resolve(plaid_primary, plaid_detailed),
                    is_pending=txn.pending,
                    is_manual=False,
                )
            )
            inserted_this_run.add(txn.transaction_id)
            added_count += 1
        if new_rows:
            db.add_all(new_rows)

        # Process modified transactions: batch-fetch existing rows for the page
        modified_by_id = await _fetch_transactions_by_plaid_ids(
            db, plaid_item.user_id, [txn.transaction_id for txn in response.modified]
        )
        for txn in response.modified:
            existing_txn = modified_by_id.get(txn.transaction_id)
            if existing_txn:
                existing_txn.amount = txn.amount
                existing_txn.date = _parse_txn_date(txn.date)
                existing_txn.description = txn.name
                existing_txn.merchant_name = getattr(txn, "merchant_name", None)
                existing_txn.is_pending = txn.pending

                # Re-resolve category on modification
                plaid_primary, plaid_detailed = _extract_plaid_categories(txn)
                existing_txn.category_id = category_resolver.resolve(
                    plaid_primary, plaid_detailed
                )

                modified_count += 1

        # Process removed transactions: batch-fetch existing rows for the page
        removed_by_id = await _fetch_transactions_by_plaid_ids(
            db, plaid_item.user_id, [txn.transaction_id for txn in response.removed]
        )
        for txn_id, existing_txn in removed_by_id.items():
            await db.delete(existing_txn)
            # Forget the id if it was inserted earlier in this run, so an
            # add -> remove -> re-add sequence within one run re-inserts the
            # transaction instead of silently dropping it.
            inserted_this_run.discard(txn_id)
            removed_count += 1

        has_more = response.has_more
        cursor = response.next_cursor

    try:
        # Update cursor and last_synced_at on PlaidItem
        plaid_item.cursor = cursor
        plaid_item.last_synced_at = datetime.now(UTC)
        await db.commit()
    except Exception:
        PLAID_SYNC.labels(status="failure").inc()
        raise

    PLAID_SYNC.labels(status="success").inc()
    TRANSACTIONS.labels(source="plaid").inc(added_count)
    return {"added": added_count, "modified": modified_count, "removed": removed_count}


# --- Liabilities Sync ---


async def sync_liabilities(
    db: AsyncSession, plaid_item: PlaidItem
) -> dict[str, int]:
    """Sync credit card liabilities for a PlaidItem.

    Updates account balances and returns bill-relevant data.
    Only called for PlaidItems that have credit card accounts.
    """
    client = get_plaid_client(plaid_item.environment)
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
            client = get_plaid_client()
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


# --- Per-item sync lock (in-process) ---

# The API runs as a single uvicorn worker process, so in-process asyncio
# state is authoritative. The membership checks and set mutations below run
# with no awaits in between, which makes them atomic on the single event loop.
_syncing_items: set[uuid.UUID] = set()
_resync_requested: set[uuid.UUID] = set()

# Delay (seconds) before the single retry of a failed webhook-triggered sync.
WEBHOOK_SYNC_RETRY_DELAY_SECONDS = 30


async def run_locked_sync(item_id: uuid.UUID, sync_once) -> bool:
    """Run one sync pass for an item under the per-item in-process lock.

    ``sync_once`` is a zero-argument callable returning an awaitable that
    performs one full sync pass.

    If a sync for the item is already running, the request is coalesced
    rather than dropped: the lock holder runs ONE extra pass after its own,
    and this call returns False without syncing. Otherwise runs ``sync_once``
    (plus at most one coalesced extra pass) and returns True.
    """
    if item_id in _syncing_items:
        _resync_requested.add(item_id)
        logger.info("Sync already running for item %s: coalescing request", item_id)
        return False

    _syncing_items.add(item_id)
    try:
        await sync_once()
        # A request arrived while the pass above was running: honor it with
        # one extra pass, still under the lock so nothing overlaps.
        if item_id in _resync_requested:
            _resync_requested.discard(item_id)
            await sync_once()
    finally:
        _syncing_items.discard(item_id)
    return True


async def _webhook_sync_pass(plaid_item_id: uuid.UUID) -> None:
    """One pass of the webhook sync chain, with its own DB session.

    Runs after the webhook response has been sent, so it must open its own
    DB session — the request-scoped session is closed by the time it runs.
    """
    from src.core.database import async_session_factory

    async with async_session_factory() as db:
        result = await db.execute(select(PlaidItem).where(PlaidItem.id == plaid_item_id))
        plaid_item = result.scalar_one_or_none()
        if not plaid_item or plaid_item.status != "active":
            return

        sync_result = await sync_transactions(db, plaid_item)
        logger.info("Sync complete for item %s: %s", plaid_item.item_id, sync_result)

        try:
            if await has_credit_accounts(db, plaid_item):
                await sync_liabilities(db, plaid_item)

            from src.jobs.budget_alerts import check_budget_alerts

            await check_budget_alerts(db, user_id=plaid_item.user_id)
        except Exception:
            logger.exception("Post-sync tasks failed for item %s", plaid_item.item_id)


async def _webhook_sync_with_retry(plaid_item_id: uuid.UUID) -> None:
    """Run one webhook sync pass, retrying once after a short delay.

    On final failure only log and count the failure: ``last_synced_at`` is
    written solely on successful sync completion, so a failed item stays
    stale and the 3-day fallback job eventually recovers it.
    """
    try:
        await _webhook_sync_pass(plaid_item_id)
        return
    except Exception:
        logger.exception(
            "Webhook sync failed for item %s; retrying in %ss",
            plaid_item_id,
            WEBHOOK_SYNC_RETRY_DELAY_SECONDS,
        )

    await asyncio.sleep(WEBHOOK_SYNC_RETRY_DELAY_SECONDS)
    try:
        await _webhook_sync_pass(plaid_item_id)
    except Exception:
        logger.exception("Webhook sync retry failed for item %s", plaid_item_id)
        PLAID_SYNC.labels(status="failure").inc()


async def run_webhook_sync(plaid_item_id: uuid.UUID) -> None:
    """Background task: run the full sync chain for a Plaid item.

    Serialized per item via run_locked_sync, so overlapping webhook retries
    coalesce into one extra pass instead of syncing concurrently.
    """

    async def sync_once() -> None:
        await _webhook_sync_with_retry(plaid_item_id)

    await run_locked_sync(plaid_item_id, sync_once)


async def handle_webhook_event(
    db: AsyncSession,
    background_tasks: BackgroundTasks,
    webhook_type: str,
    webhook_code: str,
    item_id: str,
) -> None:
    """Process a Plaid webhook event.

    Only cheap validation and the PlaidItem lookup run in the request path;
    the sync chain (transactions -> liabilities -> budget alerts) is enqueued
    as a background task so the webhook can be acknowledged immediately.
    """
    logger.info("Webhook received: type=%s code=%s item_id=%s", webhook_type, webhook_code, item_id)

    # All transaction webhook codes that should trigger a sync
    sync_codes = {
        "SYNC_UPDATES_AVAILABLE",  # New Transactions Sync API
        "INITIAL_UPDATE",          # Legacy: initial transactions ready
        "HISTORICAL_UPDATE",       # Legacy: historical transactions ready
        "DEFAULT_UPDATE",          # Legacy: new transactions available
    }

    if webhook_type == "TRANSACTIONS" and webhook_code in sync_codes:
        result = await db.execute(
            select(PlaidItem).where(PlaidItem.item_id == item_id)
        )
        plaid_item = result.scalar_one_or_none()
        if plaid_item and plaid_item.status == "active":
            # Overlap protection happens in the background task itself:
            # run_webhook_sync serializes per item and coalesces retries.
            background_tasks.add_task(run_webhook_sync, plaid_item.id)
        else:
            logger.warning("Webhook for unknown/inactive item: %s", item_id)

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

# Minimum interval between manual syncs to prevent abuse
MIN_SYNC_INTERVAL = timedelta(minutes=5)

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
