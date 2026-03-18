import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.account import Account
from src.models.transaction import Transaction


class TransactionError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


async def create_manual_transaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    amount: str,
    txn_date: date,
    description: str,
    merchant_name: str | None = None,
    category_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> Transaction:
    # Verify account belongs to user
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise TransactionError("Account not found", 404)

    txn = Transaction(
        user_id=user_id,
        account_id=account_id,
        amount=Decimal(amount),
        date=txn_date,
        description=description,
        merchant_name=merchant_name,
        category_id=category_id,
        notes=notes,
        is_manual=True,
        is_pending=False,
    )
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return txn


async def list_transactions(
    db: AsyncSession,
    user_id: uuid.UUID,
    cursor: str | None = None,
    limit: int = 50,
    account_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
) -> tuple[list[Transaction], str | None]:
    """List transactions with cursor-based pagination and filters.

    Returns (transactions, next_cursor).
    """
    query = select(Transaction).where(Transaction.user_id == user_id)

    if account_id:
        query = query.where(Transaction.account_id == account_id)
    if category_id:
        query = query.where(Transaction.category_id == category_id)
    if date_from:
        query = query.where(Transaction.date >= date_from)
    if date_to:
        query = query.where(Transaction.date <= date_to)
    if search:
        query = query.where(
            Transaction.description.ilike(f"%{search}%")
            | Transaction.merchant_name.ilike(f"%{search}%")
        )

    # Cursor-based pagination: cursor is the last seen transaction id
    if cursor:
        try:
            cursor_uuid = uuid.UUID(cursor)
            # Get the date of cursor transaction for proper ordering
            cursor_result = await db.execute(
                select(Transaction).where(Transaction.id == cursor_uuid)
            )
            cursor_txn = cursor_result.scalar_one_or_none()
            if cursor_txn:
                query = query.where(
                    (Transaction.date < cursor_txn.date)
                    | (
                        (Transaction.date == cursor_txn.date)
                        & (Transaction.id < cursor_uuid)
                    )
                )
        except (ValueError, AttributeError):
            pass

    query = query.order_by(desc(Transaction.date), desc(Transaction.id))
    query = query.limit(limit + 1)  # Fetch one extra to determine if there's a next page

    result = await db.execute(query)
    transactions = list(result.scalars().all())

    next_cursor = None
    if len(transactions) > limit:
        transactions = transactions[:limit]
        next_cursor = str(transactions[-1].id)

    return transactions, next_cursor


async def is_duplicate_transaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    txn_date: date,
    amount: Decimal,
    description: str,
) -> bool:
    """Check for duplicate within a 3-day window by (date + amount + description)."""
    window_start = txn_date - timedelta(days=3)
    window_end = txn_date + timedelta(days=3)

    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.date >= window_start,
            Transaction.date <= window_end,
            Transaction.amount == amount,
            Transaction.description == description,
        )
    )
    return result.scalar_one_or_none() is not None
