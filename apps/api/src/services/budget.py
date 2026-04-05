import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.budget import Budget
from src.models.category import Category
from src.models.transaction import Transaction


class BudgetError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code


def _get_period_bounds(
    period: str, reference_date: date | None = None
) -> tuple[date, date]:
    """Get the start and end dates for the current period window."""
    today = reference_date or date.today()

    if period == "monthly":
        start = today.replace(day=1)
        # End = last day of month
        if today.month == 12:
            end = today.replace(year=today.year + 1, month=1, day=1)
        else:
            end = today.replace(month=today.month + 1, day=1)
        end = end - timedelta(days=1)
    elif period == "weekly":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
    elif period == "yearly":
        start = today.replace(month=1, day=1)
        end = today.replace(month=12, day=31)
    else:
        start = today.replace(day=1)
        end = today

    return start, end


async def compute_current_spend(
    db: AsyncSession,
    user_id: uuid.UUID,
    category_id: uuid.UUID,
    period: str,
) -> Decimal:
    """Compute current spend for a budget by summing transactions in the period window.

    Only counts positive amounts (expenses). Negative amounts (income/refunds)
    are excluded.
    """
    period_start, period_end = _get_period_bounds(period)

    result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.category_id == category_id,
            Transaction.date >= period_start,
            Transaction.date <= period_end,
            Transaction.amount > 0,  # Only expenses
        )
    )
    return Decimal(str(result.scalar()))


async def create_budget(
    db: AsyncSession,
    user_id: uuid.UUID,
    category_id: uuid.UUID,
    amount_limit: str,
    period: str,
) -> Budget:
    # Check for duplicate
    result = await db.execute(
        select(Budget).where(
            Budget.user_id == user_id,
            Budget.category_id == category_id,
        )
    )
    if result.scalar_one_or_none():
        raise BudgetError("Budget already exists for this category", 409)

    budget = Budget(
        user_id=user_id,
        category_id=category_id,
        amount_limit=Decimal(amount_limit),
        period=period,
    )
    db.add(budget)
    await db.commit()
    await db.refresh(budget)
    return budget


async def get_budgets_with_spend(
    db: AsyncSession, user_id: uuid.UUID
) -> list[dict]:
    """Get all budgets with computed current spend."""
    # Fetch budgets with category info in one query
    result = await db.execute(
        select(Budget, Category.name, Category.color)
        .join(Category, Budget.category_id == Category.id)
        .where(Budget.user_id == user_id)
    )
    rows = result.all()

    budget_data = []
    for budget, cat_name, cat_color in rows:
        # compute_current_spend is still per-budget (each has different period/dates)
        current_spend = await compute_current_spend(
            db, user_id, budget.category_id, budget.period
        )

        budget_data.append(
            {
                "id": budget.id,
                "category_id": budget.category_id,
                "category_name": cat_name,
                "category_color": cat_color,
                "amount_limit": str(budget.amount_limit),
                "period": budget.period,
                "current_spend": str(current_spend),
                "percent_spent": float(
                    (current_spend / budget.amount_limit * 100)
                    if budget.amount_limit > 0
                    else 0
                ),
                "created_at": budget.created_at,
                "updated_at": budget.updated_at,
            }
        )

    return budget_data
