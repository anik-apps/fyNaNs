import io
import json
import uuid
import zipfile
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.account import Account
from src.models.bill import Bill
from src.models.budget import Budget
from src.models.transaction import Transaction
from src.models.user import User
from src.services.email import send_export_email


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime | date):
            return obj.isoformat()
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return super().default(obj)


def build_and_send_export(export_data: dict, to_email: str) -> None:
    """Build the export ZIP and send it. Fully sync; run via asyncio.to_thread.

    json.dumps + zipfile compression are CPU-bound and send_export_email makes
    a blocking HTTPS call, so none of this may run on the event loop.
    """
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for entity_name, data in export_data.items():
            content = json.dumps(data, indent=2, cls=DateTimeEncoder)
            zf.writestr(f"{entity_name}.json", content)

    # In production, upload to OCI Object Storage and send download link via email
    # For now, log/store temporarily
    send_export_email(to_email, zip_buffer.getvalue())


async def collect_export_data(db: AsyncSession, user: User) -> dict:
    """DB phase of an export: query all user data and return it as plain values.

    Only this part needs a session. The caller should close the session
    before handing the result to ``build_and_send_export`` (via
    ``asyncio.to_thread``) so no pooled connection is pinned while the ZIP
    is built and emailed.
    """
    export_data = {}

    # User profile
    export_data["profile"] = {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
    }

    # Accounts
    accounts_result = await db.execute(
        select(Account).where(Account.user_id == user.id)
    )
    accounts = accounts_result.scalars().all()
    export_data["accounts"] = [
        {
            "id": str(a.id),
            "institution_name": a.institution_name,
            "name": a.name,
            "type": a.type,
            "balance": str(a.balance),
            "currency": a.currency,
            "is_manual": a.is_manual,
        }
        for a in accounts
    ]

    # Transactions
    transactions_result = await db.execute(
        select(Transaction).where(Transaction.user_id == user.id)
    )
    transactions = transactions_result.scalars().all()
    export_data["transactions"] = [
        {
            "id": str(t.id),
            "account_id": str(t.account_id),
            "amount": str(t.amount),
            "date": t.date.isoformat(),
            "description": t.description,
            "merchant_name": t.merchant_name,
            "category_id": str(t.category_id) if t.category_id else None,
            "is_manual": t.is_manual,
            "notes": t.notes,
        }
        for t in transactions
    ]

    # Budgets
    budgets_result = await db.execute(
        select(Budget).where(Budget.user_id == user.id)
    )
    budgets = budgets_result.scalars().all()
    export_data["budgets"] = [
        {
            "id": str(b.id),
            "category_id": str(b.category_id),
            "amount_limit": str(b.amount_limit),
            "period": b.period,
        }
        for b in budgets
    ]

    # Bills
    bills_result = await db.execute(
        select(Bill).where(Bill.user_id == user.id)
    )
    bills = bills_result.scalars().all()
    export_data["bills"] = [
        {
            "id": str(bl.id),
            "name": bl.name,
            "amount": str(bl.amount),
            "frequency": bl.frequency,
            "next_due_date": bl.next_due_date.isoformat(),
            "is_active": bl.is_active,
        }
        for bl in bills
    ]

    return export_data
