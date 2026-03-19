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
from src.models.notification import Notification
from src.models.transaction import Transaction
from src.models.user import User
from src.services.email import send_export_email


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return super().default(obj)


async def generate_export(db: AsyncSession, user: User) -> None:
    """Generate a ZIP file of user data and send download link via email.

    Format: ZIP containing JSON files per entity.
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

    # Create ZIP
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for entity_name, data in export_data.items():
            content = json.dumps(data, indent=2, cls=DateTimeEncoder)
            zf.writestr(f"{entity_name}.json", content)

    zip_buffer.seek(0)

    # In production, upload to OCI Object Storage and send download link via email
    # For now, log/store temporarily
    send_export_email(user.email, zip_buffer.getvalue())
