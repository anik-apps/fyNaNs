import uuid
from collections.abc import Sequence
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


async def compute_spend_for_budgets(
    db: AsyncSession,
    user_id: uuid.UUID,
    budgets: Sequence[Budget],
    reference_date: date | None = None,
) -> dict[uuid.UUID, Decimal]:
    """Batch-compute current-period spend for many budgets.

    Groups the budgets by their period (weekly/monthly/yearly) and runs ONE
    grouped SUM query per distinct period — at most 3 queries regardless of
    budget count. Matches compute_current_spend semantics exactly: only
    positive amounts (expenses) are counted; negative amounts (income/refunds)
    are excluded.

    Args:
        reference_date: Override for "today" when deriving period windows
            (defaults to date.today()). Useful for testing.

    Returns:
        Mapping of budget id -> Decimal spend for that budget's current period.
    """
    spend_by_budget: dict[uuid.UUID, Decimal] = {b.id: Decimal("0") for b in budgets}

    budgets_by_period: dict[str, list[Budget]] = {}
    for budget in budgets:
        budgets_by_period.setdefault(budget.period, []).append(budget)

    for period, period_budgets in budgets_by_period.items():
        period_start, period_end = _get_period_bounds(period, reference_date)

        result = await db.execute(
            select(Transaction.category_id, func.sum(Transaction.amount))
            .where(
                Transaction.user_id == user_id,
                Transaction.category_id.in_(
                    [b.category_id for b in period_budgets]
                ),
                Transaction.date >= period_start,
                Transaction.date <= period_end,
                Transaction.amount > 0,  # Only expenses
            )
            .group_by(Transaction.category_id)
        )
        spend_by_category = {
            category_id: Decimal(str(total))
            for category_id, total in result.all()
        }
        for budget in period_budgets:
            spend_by_budget[budget.id] = spend_by_category.get(
                budget.category_id, Decimal("0")
            )

    return spend_by_budget


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
    """Get all budgets with computed current spend.

    Spend for all budgets is batched via compute_spend_for_budgets (one
    grouped SUM query per distinct period, max 3 queries total).
    """
    # Fetch budgets with category info in one query
    result = await db.execute(
        select(Budget, Category.name, Category.color)
        .join(Category, Budget.category_id == Category.id)
        .where(Budget.user_id == user_id)
    )
    rows = result.all()

    spend_by_budget = await compute_spend_for_budgets(
        db, user_id, [budget for budget, _, _ in rows]
    )

    budget_data = []
    for budget, cat_name, cat_color in rows:
        current_spend = spend_by_budget[budget.id]

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
