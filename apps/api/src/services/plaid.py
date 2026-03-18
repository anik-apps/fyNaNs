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
