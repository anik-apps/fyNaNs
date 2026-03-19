import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.account import Account
from src.models.bill import Bill
from src.models.budget import Budget
from src.models.category import Category
from src.models.transaction import Transaction
from src.models.user import User


async def create_test_user(db: AsyncSession, **overrides) -> User:
    """Create a test user with sensible defaults."""
    defaults = {
        "id": uuid.uuid4(),
        "email": f"test-{uuid.uuid4().hex[:8]}@example.com",
        "name": "Test User",
        "password_hash": "$2b$12$dummy_hash_for_testing_only",
    }
    defaults.update(overrides)
    user = User(**defaults)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def create_test_category(db: AsyncSession, **overrides) -> Category:
    defaults = {
        "id": uuid.uuid4(),
        "name": f"Category-{uuid.uuid4().hex[:6]}",
        "icon": "tag",
        "color": "#4A90D9",
        "is_system": False,
    }
    defaults.update(overrides)
    category = Category(**defaults)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def create_test_account(db: AsyncSession, user_id: uuid.UUID, **overrides) -> Account:
    defaults = {
        "id": uuid.uuid4(),
        "user_id": user_id,
        "institution_name": "Test Bank",
        "name": "Checking",
        "type": "checking",
        "balance": Decimal("1000.00"),
        "currency": "USD",
        "mask": "1234",
        "is_manual": True,
    }
    defaults.update(overrides)
    account = Account(**defaults)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def create_test_transaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    category_id: uuid.UUID,
    **overrides,
) -> Transaction:
    defaults = {
        "id": uuid.uuid4(),
        "user_id": user_id,
        "account_id": account_id,
        "category_id": category_id,
        "amount": Decimal("25.00"),
        "date": date.today(),
        "description": "Test Transaction",
        "is_pending": False,
        "is_manual": True,
    }
    defaults.update(overrides)
    txn = Transaction(**defaults)
    db.add(txn)
    await db.commit()
    await db.refresh(txn)
    return txn


async def create_test_budget(
    db: AsyncSession, user_id: uuid.UUID, category_id: uuid.UUID, **overrides
) -> Budget:
    defaults = {
        "id": uuid.uuid4(),
        "user_id": user_id,
        "category_id": category_id,
        "amount_limit": Decimal("500.00"),
        "period": "monthly",
    }
    defaults.update(overrides)
    budget = Budget(**defaults)
    db.add(budget)
    await db.commit()
    await db.refresh(budget)
    return budget


async def create_test_bill(db: AsyncSession, user_id: uuid.UUID, **overrides) -> Bill:
    defaults = {
        "id": uuid.uuid4(),
        "user_id": user_id,
        "name": "Netflix",
        "amount": Decimal("15.99"),
        "frequency": "monthly",
        "day_of_month": 15,
        "next_due_date": date.today() + timedelta(days=3),
        "reminder_days": 3,
        "is_auto_pay": False,
        "is_active": True,
        "source": "manual",
        "auto_update": False,
    }
    defaults.update(overrides)
    bill = Bill(**defaults)
    db.add(bill)
    await db.commit()
    await db.refresh(bill)
    return bill
