import calendar
import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.bill import Bill


class BillError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


def advance_due_date(
    frequency: str,
    current_due: date,
    day_of_week: int | None = None,
    day_of_month: int | None = None,
    month_of_year: int | None = None,
) -> date:
    """Advance next_due_date based on frequency.

    Edge cases:
    - day_of_month=31 and next month has fewer days -> clamp to last day
    - Yearly on Feb 29 in non-leap year -> clamp to Feb 28
    """
    if frequency == "weekly":
        return current_due + timedelta(weeks=1)

    elif frequency == "monthly":
        # Advance by one month
        year = current_due.year
        month = current_due.month + 1
        if month > 12:
            month = 1
            year += 1

        # Clamp day to max days in target month
        target_day = day_of_month or current_due.day
        max_day = calendar.monthrange(year, month)[1]
        day = min(target_day, max_day)

        return date(year, month, day)

    elif frequency == "yearly":
        year = current_due.year + 1
        target_month = month_of_year or current_due.month
        target_day = day_of_month or current_due.day

        # Clamp for Feb 29 in non-leap years
        max_day = calendar.monthrange(year, target_month)[1]
        day = min(target_day, max_day)

        return date(year, target_month, day)

    return current_due


async def create_bill(
    db: AsyncSession,
    user_id: uuid.UUID,
    name: str,
    amount: str,
    frequency: str,
    next_due_date: date,
    day_of_week: int | None = None,
    day_of_month: int | None = None,
    month_of_year: int | None = None,
    category_id: uuid.UUID | None = None,
    account_id: uuid.UUID | None = None,
    reminder_days: int = 3,
    is_auto_pay: bool = False,
) -> Bill:
    bill = Bill(
        user_id=user_id,
        name=name,
        amount=Decimal(amount),
        frequency=frequency,
        day_of_week=day_of_week,
        day_of_month=day_of_month,
        month_of_year=month_of_year,
        category_id=category_id,
        account_id=account_id,
        next_due_date=next_due_date,
        reminder_days=reminder_days,
        is_auto_pay=is_auto_pay,
        source="manual",
    )
    db.add(bill)
    await db.commit()
    await db.refresh(bill)
    return bill


async def get_upcoming_bills(
    db: AsyncSession, user_id: uuid.UUID, days: int = 30
) -> list[Bill]:
    """Get active bills due within the next N days."""
    today = date.today()
    cutoff = today + timedelta(days=days)

    result = await db.execute(
        select(Bill)
        .where(
            Bill.user_id == user_id,
            Bill.is_active.is_(True),
            Bill.next_due_date >= today,
            Bill.next_due_date <= cutoff,
        )
        .order_by(Bill.next_due_date)
    )
    return list(result.scalars().all())


async def auto_advance_overdue_bills(db: AsyncSession) -> int:
    """Advance next_due_date for all overdue bills. Called by daily job.

    Returns number of bills advanced.
    """
    today = date.today()

    result = await db.execute(
        select(Bill).where(
            Bill.is_active.is_(True),
            Bill.next_due_date < today,
        )
    )
    overdue_bills = result.scalars().all()

    advanced = 0
    for bill in overdue_bills:
        new_due = bill.next_due_date
        while new_due < today:
            new_due = advance_due_date(
                frequency=bill.frequency,
                current_due=new_due,
                day_of_week=bill.day_of_week,
                day_of_month=bill.day_of_month,
                month_of_year=bill.month_of_year,
            )
        bill.next_due_date = new_due
        advanced += 1

    if advanced > 0:
        await db.commit()

    return advanced
