from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.bill import Bill
from src.services.bill import auto_advance_overdue_bills
from src.services.notification import create_notification


async def check_bill_reminders(db: AsyncSession) -> None:
    """Check all active bills and send reminders for upcoming due dates.

    Also auto-advances overdue bills.
    """
    today = date.today()

    # Send overdue notifications before advancing
    overdue_result = await db.execute(
        select(Bill).where(
            Bill.is_active.is_(True),
            Bill.next_due_date < today,
        )
    )
    for bill in overdue_result.scalars().all():
        period_key = bill.next_due_date.isoformat()
        await create_notification(
            db=db,
            user_id=bill.user_id,
            notif_type="bill_overdue",
            reference_id=bill.id,
            period_key=period_key,
            title=f"Overdue: {bill.name}",
            body=f"{bill.name} (${bill.amount}) was due on {bill.next_due_date}",
        )

    # Auto-advance overdue bills to next future date
    await auto_advance_overdue_bills(db)

    # Find bills that need reminders
    result = await db.execute(
        select(Bill).where(
            Bill.is_active.is_(True),
            Bill.next_due_date >= today,
        )
    )
    bills = result.scalars().all()

    for bill in bills:
        days_until_due = (bill.next_due_date - today).days

        if days_until_due <= bill.reminder_days:
            # Generate period key for dedup (year-month-day of due date)
            period_key = bill.next_due_date.isoformat()

            await create_notification(
                db=db,
                user_id=bill.user_id,
                notif_type="bill_reminder",
                reference_id=bill.id,
                period_key=period_key,
                title=f"Bill Due: {bill.name}",
                body=(
                    f"{bill.name} (${bill.amount}) is due on {bill.next_due_date}"
                ),
            )


async def run_bill_reminders() -> None:
    """Entry point for APScheduler. Creates its own DB session."""
    from src.core.database import async_session_factory

    async with async_session_factory() as session:
        await check_bill_reminders(session)
