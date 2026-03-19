from datetime import date, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.bill import Bill
from src.models.user import User
from src.models.user_settings import UserSettings


@pytest.mark.asyncio
@patch("src.services.notification.create_notification")
async def test_bill_reminders_sends_for_upcoming(mock_notif, db_session: AsyncSession):
    from src.jobs.bill_reminders import check_bill_reminders

    user = User(
        email="remind@example.com", name="Remind User", password_hash="fake"
    )
    db_session.add(user)
    await db_session.flush()

    settings = UserSettings(user_id=user.id)
    db_session.add(settings)

    # Bill due in 2 days with reminder_days=3 (should trigger)
    bill = Bill(
        user_id=user.id,
        name="Electric",
        amount=120.00,
        frequency="monthly",
        day_of_month=20,
        next_due_date=date.today() + timedelta(days=2),
        reminder_days=3,
        is_active=True,
        source="manual",
    )
    db_session.add(bill)
    await db_session.commit()

    mock_notif.return_value = None  # Simulate notification created

    await check_bill_reminders(db_session)

    mock_notif.assert_called_once()
    call_kwargs = mock_notif.call_args[1]
    assert call_kwargs["notif_type"] == "bill_reminder"
    assert call_kwargs["reference_id"] == bill.id


@pytest.mark.asyncio
@patch("src.services.notification.create_notification")
async def test_bill_reminders_skips_inactive(mock_notif, db_session: AsyncSession):
    from src.jobs.bill_reminders import check_bill_reminders

    user = User(
        email="remind2@example.com", name="Remind2", password_hash="fake"
    )
    db_session.add(user)
    await db_session.flush()

    settings = UserSettings(user_id=user.id)
    db_session.add(settings)

    # Inactive bill
    bill = Bill(
        user_id=user.id,
        name="Cancelled Sub",
        amount=10.00,
        frequency="monthly",
        day_of_month=20,
        next_due_date=date.today() + timedelta(days=1),
        reminder_days=3,
        is_active=False,
        source="manual",
    )
    db_session.add(bill)
    await db_session.commit()

    await check_bill_reminders(db_session)

    mock_notif.assert_not_called()


@pytest.mark.asyncio
@patch("src.services.notification.create_notification")
async def test_bill_reminders_auto_advances_overdue(
    mock_notif, db_session: AsyncSession
):
    from src.jobs.bill_reminders import check_bill_reminders

    user = User(
        email="advance@example.com", name="Advance User", password_hash="fake"
    )
    db_session.add(user)
    await db_session.flush()

    settings = UserSettings(user_id=user.id)
    db_session.add(settings)

    # Overdue bill
    bill = Bill(
        user_id=user.id,
        name="Overdue Bill",
        amount=50.00,
        frequency="monthly",
        day_of_month=1,
        next_due_date=date.today() - timedelta(days=5),
        reminder_days=3,
        is_active=True,
        source="manual",
    )
    db_session.add(bill)
    await db_session.commit()

    mock_notif.return_value = None

    await check_bill_reminders(db_session)

    # Verify bill was auto-advanced
    result = await db_session.execute(select(Bill).where(Bill.id == bill.id))
    updated_bill = result.scalar_one()
    assert updated_bill.next_due_date > date.today()
