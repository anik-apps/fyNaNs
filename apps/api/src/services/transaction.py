import bisect
import csv
import io
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.metrics import TRANSACTIONS
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
    TRANSACTIONS.labels(source="manual").inc()
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
        escaped = search.replace("%", "\\%").replace("_", "\\_")
        query = query.where(or_(
            Transaction.description.ilike(f"%{escaped}%"),
            Transaction.merchant_name.ilike(f"%{escaped}%"),
        ))

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


# --- Import Functions ---

# Duplicate detection window: same (amount, description) within +/- 3 days (inclusive).
_DUP_WINDOW = timedelta(days=3)

# Index of existing transactions: (amount, description) -> sorted list of dates.
_DuplicateIndex = dict[tuple[Decimal, str], list[date]]


async def _load_duplicate_index(
    db: AsyncSession,
    user_id: uuid.UUID,
    dates: list[date],
) -> _DuplicateIndex:
    """Fetch the user's existing transactions covering all given dates (+/- window)
    in ONE query and index them by (amount, description) -> sorted dates."""
    index: _DuplicateIndex = {}
    if not dates:
        return index

    result = await db.execute(
        select(Transaction.date, Transaction.amount, Transaction.description).where(
            Transaction.user_id == user_id,
            Transaction.date >= min(dates) - _DUP_WINDOW,
            Transaction.date <= max(dates) + _DUP_WINDOW,
        )
    )
    for txn_date, amount, description in result.all():
        _add_to_index(index, txn_date, amount, description)
    return index


def _add_to_index(
    index: _DuplicateIndex, txn_date: date, amount: Decimal, description: str
) -> None:
    bisect.insort(index.setdefault((amount, description), []), txn_date)


def _is_duplicate(
    index: _DuplicateIndex, txn_date: date, amount: Decimal, description: str
) -> bool:
    """Duplicate if any indexed date for (amount, description) is within +/- 3 days."""
    dates = index.get((amount, description))
    if not dates:
        return False
    pos = bisect.bisect_left(dates, txn_date - _DUP_WINDOW)
    return pos < len(dates) and dates[pos] <= txn_date + _DUP_WINDOW


def _insert_non_duplicates(
    db: AsyncSession,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    parsed_rows: list[dict],
    index: _DuplicateIndex,
    errors: list[dict],
) -> tuple[int, int]:
    """Add non-duplicate parsed rows to the session. Returns (imported, skipped).

    Accepted rows are added to the index so duplicates later in the same file
    are also skipped (matching the previous per-row query + autoflush behavior).
    """
    imported = 0
    skipped = 0
    for row in parsed_rows:
        try:
            if _is_duplicate(index, row["date"], row["amount"], row["description"]):
                skipped += 1
                continue

            txn = Transaction(
                user_id=user_id,
                account_id=account_id,
                amount=row["amount"],
                date=row["date"],
                description=row["description"],
                merchant_name=row.get("merchant_name"),
                notes=row.get("notes"),
                is_manual=True,
                is_pending=False,
            )
            db.add(txn)
            _add_to_index(index, row["date"], row["amount"], row["description"])
            imported += 1
        except Exception as e:
            errors.append({"row": row["row"], "reason": str(e)})
    return imported, skipped


async def import_csv(
    db: AsyncSession,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    file_content: bytes,
) -> dict:
    """Import transactions from CSV file.

    Expected columns: Date, Description, Amount (with optional Merchant, Category, Notes).
    Deduplicates against existing transactions by (date + amount + description) within 3-day window.
    """
    # Verify account belongs to user
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise TransactionError("Account not found", 404)

    errors: list[dict] = []

    try:
        text = file_content.decode("utf-8")
    except UnicodeDecodeError:
        text = file_content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    # Phase 1: parse and validate all rows
    parsed_rows: list[dict] = []
    for row_num, row in enumerate(reader, start=1):
        try:
            # Parse date (try multiple formats)
            date_str = row.get("Date", "").strip()
            txn_date = _parse_date(date_str)
            if not txn_date:
                errors.append({"row": row_num, "reason": f"Invalid date: {date_str}"})
                continue

            description = row.get("Description", "").strip()
            if not description:
                errors.append({"row": row_num, "reason": "Missing description"})
                continue

            amount_str = row.get("Amount", "").strip().replace(",", "").replace("$", "")
            try:
                amount = Decimal(amount_str)
            except Exception:
                errors.append({"row": row_num, "reason": f"Invalid amount: {amount_str}"})
                continue

            parsed_rows.append({
                "row": row_num,
                "date": txn_date,
                "amount": amount,
                "description": description,
                "merchant_name": row.get("Merchant", "").strip() or None,
                "notes": row.get("Notes", "").strip() or None,
            })

        except Exception as e:
            errors.append({"row": row_num, "reason": str(e)})

    # Phase 2: single duplicate-detection query, then dedupe in memory
    index = await _load_duplicate_index(db, user_id, [r["date"] for r in parsed_rows])
    imported, skipped = _insert_non_duplicates(
        db, user_id, account_id, parsed_rows, index, errors
    )

    await db.commit()
    TRANSACTIONS.labels(source="csv").inc(imported)
    return {"imported": imported, "skipped_duplicates": skipped, "errors": errors}


async def import_ofx(
    db: AsyncSession,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    file_content: bytes,
) -> dict:
    """Import transactions from OFX/QFX file."""
    from ofxparse import OfxParser

    # Verify account belongs to user
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise TransactionError("Account not found", 404)

    errors: list[dict] = []

    try:
        ofx = OfxParser.parse(io.BytesIO(file_content))
    except Exception as e:
        raise TransactionError(f"Failed to parse OFX file: {e}", 400) from e

    # Phase 1: parse and validate all transactions
    parsed_rows: list[dict] = []
    for account_data in ofx.accounts:
        for row_num, txn_data in enumerate(account_data.statement.transactions, start=1):
            try:
                txn_date = txn_data.date.date() if hasattr(txn_data.date, "date") else txn_data.date
                amount = Decimal(str(txn_data.amount))
                description = txn_data.memo or txn_data.payee or "Unknown"

                parsed_rows.append({
                    "row": row_num,
                    "date": txn_date,
                    "amount": amount,
                    "description": description,
                    "merchant_name": txn_data.payee if txn_data.payee != description else None,
                })

            except Exception as e:
                errors.append({"row": row_num, "reason": str(e)})

    # Phase 2: single duplicate-detection query, then dedupe in memory
    index = await _load_duplicate_index(db, user_id, [r["date"] for r in parsed_rows])
    imported, skipped = _insert_non_duplicates(
        db, user_id, account_id, parsed_rows, index, errors
    )

    await db.commit()
    TRANSACTIONS.labels(source="ofx").inc(imported)
    return {"imported": imported, "skipped_duplicates": skipped, "errors": errors}


def _parse_date(date_str: str) -> date | None:
    """Try multiple date formats."""
    formats = ["%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y", "%d/%m/%Y", "%Y/%m/%d"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None
