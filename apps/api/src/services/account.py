import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.account import Account
from src.models.transaction import Transaction


class AccountError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


async def create_manual_account(
    db: AsyncSession,
    user_id: uuid.UUID,
    institution_name: str,
    name: str,
    account_type: str,
    balance: str,
    currency: str = "USD",
    mask: str | None = None,
) -> Account:
    account = Account(
        user_id=user_id,
        institution_name=institution_name,
        name=name,
        type=account_type,
        balance=Decimal(balance),
        currency=currency,
        mask=mask,
        is_manual=True,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


ALLOWED_UPDATE_FIELDS = {"name", "balance", "institution_name"}


async def update_account(
    db: AsyncSession,
    account: Account,
    **kwargs,
) -> Account:
    for key, value in kwargs.items():
        if key not in ALLOWED_UPDATE_FIELDS:
            continue
        if value is not None:
            if key == "balance":
                value = Decimal(value)
            setattr(account, key, value)
    await db.commit()
    await db.refresh(account)
    return account


async def delete_account(db: AsyncSession, account: Account) -> None:
    """Delete account and cascade-delete transactions.

    Bills linked via account_id are nullified (bill remains, loses account link).
    If account is Plaid-linked, does NOT remove the PlaidItem.
    """
    await db.delete(account)
    await db.commit()
