from datetime import date

import pytest

from src.services.bill import advance_due_date


def test_advance_monthly_normal():
    result = advance_due_date(
        frequency="monthly",
        current_due=date(2026, 3, 15),
        day_of_month=15,
    )
    assert result == date(2026, 4, 15)


def test_advance_monthly_day31_to_short_month():
    """day_of_month=31 in April -> clamp to April 30."""
    result = advance_due_date(
        frequency="monthly",
        current_due=date(2026, 3, 31),
        day_of_month=31,
    )
    assert result == date(2026, 4, 30)


def test_advance_monthly_december_to_january():
    result = advance_due_date(
        frequency="monthly",
        current_due=date(2026, 12, 15),
        day_of_month=15,
    )
    assert result == date(2027, 1, 15)


def test_advance_weekly():
    result = advance_due_date(
        frequency="weekly",
        current_due=date(2026, 3, 16),  # Monday
        day_of_week=0,  # Monday
    )
    assert result == date(2026, 3, 23)


def test_advance_yearly_normal():
    result = advance_due_date(
        frequency="yearly",
        current_due=date(2026, 3, 15),
        day_of_month=15,
        month_of_year=3,
    )
    assert result == date(2027, 3, 15)


def test_advance_yearly_feb29_non_leap():
    """Yearly bill on Feb 29 in non-leap year -> clamp to Feb 28."""
    result = advance_due_date(
        frequency="yearly",
        current_due=date(2024, 2, 29),  # 2024 is leap year
        day_of_month=29,
        month_of_year=2,
    )
    # 2025 is NOT a leap year
    assert result == date(2025, 2, 28)


@pytest.mark.asyncio
async def test_auto_advance_overdue_bills(db_session):
    """Test the async auto_advance_overdue_bills function directly."""
    from datetime import timedelta

    from sqlalchemy import select

    from src.models.bill import Bill
    from src.models.user import User
    from src.services.bill import auto_advance_overdue_bills

    user = User(
        email="autoadvance@example.com", name="Auto Advance", password_hash="fake"
    )
    db_session.add(user)
    await db_session.flush()

    # Create an overdue monthly bill
    bill = Bill(
        user_id=user.id,
        name="Overdue Monthly",
        amount=100.00,
        frequency="monthly",
        day_of_month=15,
        next_due_date=date.today() - timedelta(days=10),
        reminder_days=3,
        is_active=True,
        source="manual",
    )
    db_session.add(bill)
    await db_session.commit()

    advanced_count = await auto_advance_overdue_bills(db_session)
    assert advanced_count == 1

    # Verify the bill was advanced to a future date
    result = await db_session.execute(select(Bill).where(Bill.id == bill.id))
    updated_bill = result.scalar_one()
    assert updated_bill.next_due_date >= date.today()
