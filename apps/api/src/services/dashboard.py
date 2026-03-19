from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.account import Account
from src.models.bill import Bill
from src.models.budget import Budget
from src.models.category import Category
from src.models.transaction import Transaction
from src.schemas.dashboard import (
    AccountBalance,
    AccountBalancesByType,
    BudgetStatus,
    DashboardResponse,
    NetWorthSummary,
    RecentTransaction,
    SpendingComparison,
    UpcomingBill,
)

ASSET_TYPES = {"checking", "savings", "investment"}
LIABILITY_TYPES = {"credit", "loan"}


async def get_dashboard(db: AsyncSession, user_id: str) -> DashboardResponse:
    """Aggregate all dashboard data for a user."""
    net_worth = await _get_net_worth(db, user_id)
    accounts_by_type = await _get_accounts_by_type(db, user_id)
    recent_transactions = await _get_recent_transactions(db, user_id, limit=10)
    top_budgets = await _get_top_budgets(db, user_id, limit=5)
    upcoming_bills = await _get_upcoming_bills(db, user_id, days=7)
    spending_comparison = await _get_spending_comparison(db, user_id)

    return DashboardResponse(
        net_worth=net_worth,
        accounts_by_type=accounts_by_type,
        recent_transactions=recent_transactions,
        top_budgets=top_budgets,
        upcoming_bills=upcoming_bills,
        spending_comparison=spending_comparison,
    )


async def _get_net_worth(db: AsyncSession, user_id: str) -> NetWorthSummary:
    """Calculate net worth from account balances.

    Balance sign convention:
    - Asset accounts (checking, savings, investment): balance is positive (money you own).
    - Liability accounts (credit, loan): balance is stored as positive (money you owe).
      We use the raw balance value directly for liabilities -- no abs() needed.
    - Net worth = total_assets - total_liabilities.
    """
    result = await db.execute(
        select(
            func.coalesce(
                func.sum(case((Account.type.in_(ASSET_TYPES), Account.balance), else_=0)),
                0,
            ).label("total_assets"),
            func.coalesce(
                func.sum(
                    case((Account.type.in_(LIABILITY_TYPES), Account.balance), else_=0)
                ),
                0,
            ).label("total_liabilities"),
        ).where(Account.user_id == user_id)
    )
    row = result.one()
    total_assets = Decimal(str(row.total_assets))
    total_liabilities = Decimal(str(row.total_liabilities))

    return NetWorthSummary(
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        net_worth=total_assets - total_liabilities,
    )


async def _get_accounts_by_type(db: AsyncSession, user_id: str) -> AccountBalancesByType:
    """Get all accounts grouped by type."""
    result = await db.execute(
        select(Account).where(Account.user_id == user_id).order_by(Account.institution_name)
    )
    accounts = result.scalars().all()

    grouped = AccountBalancesByType()
    valid_types = {"checking", "savings", "credit", "loan", "investment"}
    for acct in accounts:
        if acct.type not in valid_types:
            continue
        balance = AccountBalance(
            id=str(acct.id),
            name=acct.name,
            institution_name=acct.institution_name,
            type=acct.type,
            balance=acct.balance,
            currency=acct.currency,
            is_manual=acct.is_manual,
        )
        getattr(grouped, acct.type).append(balance)

    return grouped


async def _get_recent_transactions(
    db: AsyncSession, user_id: str, limit: int = 10
) -> list[RecentTransaction]:
    """Get last N transactions with category info."""
    result = await db.execute(
        select(Transaction, Category.name, Category.color, Account.name.label("account_name"))
        .outerjoin(Category, Transaction.category_id == Category.id)
        .join(Account, Transaction.account_id == Account.id)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
        .limit(limit)
    )
    rows = result.all()

    return [
        RecentTransaction(
            id=str(txn.id),
            date=txn.date.isoformat(),
            description=txn.description,
            merchant_name=txn.merchant_name,
            amount=txn.amount,
            category_name=cat_name or "Uncategorized",
            category_color=cat_color or "#6B7280",
            account_name=acct_name,
            is_pending=txn.is_pending,
        )
        for txn, cat_name, cat_color, acct_name in rows
    ]


def _get_period_start(period: str, today: date) -> date:
    """Derive the start of the current budget period based on the budget's period type."""
    if period == "weekly":
        # Start of current ISO week (Monday)
        return today - timedelta(days=today.weekday())
    elif period == "yearly":
        return today.replace(month=1, day=1)
    else:
        # monthly (default)
        return today.replace(day=1)


async def _get_top_budgets(
    db: AsyncSession, user_id: str, limit: int = 5
) -> list[BudgetStatus]:
    """Get top N budgets by percent spent in current period.

    Each budget has its own period (weekly, monthly, yearly). The spending
    window is derived from the budget's period, not a fixed monthly window.

    NOTE: This implementation issues one SUM query per budget (N+1 pattern).
    Acceptable while users have a handful of budgets. If scale requires it,
    refactor to a single query using GROUP BY category_id with conditional
    date filtering (e.g., CASE/FILTER per period type) or a LATERAL JOIN
    so the DB does all aggregation in one round-trip.
    """
    today = date.today()

    # First, fetch all budgets with their categories
    result = await db.execute(
        select(Budget, Category.name, Category.color, Category.icon)
        .join(Category, Budget.category_id == Category.id)
        .where(Budget.user_id == user_id)
    )
    rows = result.all()

    budgets = []
    for budget, cat_name, cat_color, cat_icon in rows:
        # Compute period start based on this budget's period type
        period_start = _get_period_start(budget.period, today)

        # Sum transactions for this category within the period
        spend_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id,
                Transaction.category_id == budget.category_id,
                Transaction.date >= period_start,
                Transaction.date <= today,
                Transaction.amount > 0,  # Only expenses (positive = money out)
            )
        )
        amount_spent = Decimal(str(spend_result.scalar()))

        percent = (
            float(amount_spent / budget.amount_limit * 100) if budget.amount_limit > 0 else 0.0
        )
        budgets.append(
            BudgetStatus(
                id=str(budget.id),
                category_name=cat_name,
                category_color=cat_color,
                category_icon=cat_icon,
                amount_limit=budget.amount_limit,
                amount_spent=amount_spent,
                percent_spent=round(percent, 1),
                period=budget.period,
            )
        )

    # Sort by percent spent descending, take top N
    budgets.sort(key=lambda b: b.percent_spent, reverse=True)
    return budgets[:limit]


async def _get_upcoming_bills(
    db: AsyncSession, user_id: str, days: int = 7
) -> list[UpcomingBill]:
    """Get bills due in the next N days."""
    today = date.today()
    cutoff = today + timedelta(days=days)

    result = await db.execute(
        select(Bill, Category.name)
        .outerjoin(Category, Bill.category_id == Category.id)
        .where(
            Bill.user_id == user_id,
            Bill.is_active.is_(True),
            Bill.next_due_date >= today,
            Bill.next_due_date <= cutoff,
        )
        .order_by(Bill.next_due_date)
    )
    rows = result.all()

    return [
        UpcomingBill(
            id=str(bill.id),
            name=bill.name,
            amount=bill.amount,
            next_due_date=bill.next_due_date.isoformat(),
            is_auto_pay=bill.is_auto_pay,
            days_until_due=(bill.next_due_date - today).days,
            category_name=cat_name,
        )
        for bill, cat_name in rows
    ]


async def _get_spending_comparison(db: AsyncSession, user_id: str) -> SpendingComparison:
    """Compare spending this month vs last month."""
    today = date.today()
    current_month_start = today.replace(day=1)

    # Previous month start
    if today.month == 1:
        prev_month_start = today.replace(year=today.year - 1, month=12, day=1)
    else:
        prev_month_start = today.replace(month=today.month - 1, day=1)
    prev_month_end = current_month_start - timedelta(days=1)

    # Current month spending
    current_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.date >= current_month_start,
            Transaction.date <= today,
            Transaction.amount > 0,  # Expenses only
        )
    )
    current_total = Decimal(str(current_result.scalar()))

    # Previous month spending
    prev_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.date >= prev_month_start,
            Transaction.date <= prev_month_end,
            Transaction.amount > 0,
        )
    )
    prev_total = Decimal(str(prev_result.scalar()))

    difference = current_total - prev_total
    percent_change = (
        float(difference / prev_total * 100) if prev_total > 0 else None
    )

    return SpendingComparison(
        current_month_total=current_total,
        previous_month_total=prev_total,
        difference=difference,
        percent_change=round(percent_change, 1) if percent_change is not None else None,
    )
