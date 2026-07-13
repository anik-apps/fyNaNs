from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.core.constants import INCOME_CATEGORIES, TRANSFER_CATEGORIES
from src.models.account import Account
from src.models.bill import Bill
from src.models.budget import Budget
from src.models.category import Category
from src.models.savings_goal import SavingsGoal
from src.models.transaction import Transaction
from src.schemas.dashboard import (
    AccountBalance,
    AccountBalancesByType,
    BudgetStatus,
    DashboardResponse,
    GoalDashboardItem,
    NetWorthSummary,
    RecentTransaction,
    SpendingComparison,
    UpcomingBill,
)
from src.services.budget import compute_spend_for_budgets
from src.services.savings_goal import to_responses as goals_to_responses

ASSET_TYPES = {"checking", "savings", "investment"}
LIABILITY_TYPES = {"credit", "loan"}


async def get_dashboard(
    db: AsyncSession, user_id: str, today: date | None = None
) -> DashboardResponse:
    """Aggregate all dashboard data for a user.

    Args:
        today: Override for current date (defaults to date.today()). Useful for testing.
    """
    today = today or date.today()
    net_worth = await _get_net_worth(db, user_id)
    accounts_by_type = await _get_accounts_by_type(db, user_id)
    recent_transactions = await _get_recent_transactions(db, user_id, limit=10)
    top_budgets = await _get_top_budgets(db, user_id, limit=5, today=today)
    upcoming_bills = await _get_upcoming_bills(db, user_id, days=7, today=today)
    spending_comparison = await _get_spending_comparison(db, user_id, today=today)
    top_goals, active_goals_count = await _get_top_goals(db, user_id, today, limit=3)

    return DashboardResponse(
        net_worth=net_worth,
        accounts_by_type=accounts_by_type,
        recent_transactions=recent_transactions,
        top_budgets=top_budgets,
        upcoming_bills=upcoming_bills,
        spending_comparison=spending_comparison,
        top_goals=top_goals,
        active_goals_count=active_goals_count,
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
        select(
            Transaction,
            Category.name,
            Category.color,
            Account.name.label("account_name"),
            Account.type.label("account_type"),
        )
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
            account_type=acct_type or "checking",
            is_pending=txn.is_pending,
        )
        for txn, cat_name, cat_color, acct_name, acct_type in rows
    ]


async def _get_top_budgets(
    db: AsyncSession, user_id: str, limit: int = 5, today: date | None = None
) -> list[BudgetStatus]:
    """Get top N budgets by percent spent in current period.

    Each budget has its own period (weekly, monthly, yearly). The spending
    window is derived from the budget's period, not a fixed monthly window.
    Spend for all budgets is batched via compute_spend_for_budgets (one
    grouped SUM query per distinct period, max 3 queries total); ranking and
    slicing happen in Python.
    """
    today = today or date.today()

    # First, fetch all budgets with their categories
    result = await db.execute(
        select(Budget, Category.name, Category.color, Category.icon)
        .join(Category, Budget.category_id == Category.id)
        .where(Budget.user_id == user_id)
    )
    rows = result.all()

    spend_by_budget = await compute_spend_for_budgets(
        db, user_id, [budget for budget, _, _, _ in rows], reference_date=today
    )

    budgets = []
    for budget, cat_name, cat_color, cat_icon in rows:
        amount_spent = spend_by_budget[budget.id]

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
    db: AsyncSession, user_id: str, days: int = 7, today: date | None = None
) -> list[UpcomingBill]:
    """Get bills due in the next N days."""
    today = today or date.today()
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


async def _get_spending_comparison(
    db: AsyncSession, user_id: str, today: date | None = None
) -> SpendingComparison:
    """Compare spending this month vs last month.

    Uses category + amount sign hybrid to separate spending from income,
    same approach as the other dashboard endpoints.
    """
    today = today or date.today()
    current_month_start = today.replace(day=1)

    if today.month == 1:
        prev_month_start = today.replace(year=today.year - 1, month=12, day=1)
    else:
        prev_month_start = today.replace(month=today.month - 1, day=1)
    prev_month_end = current_month_start - timedelta(days=1)

    async def _sum_spending(start: date, end: date) -> Decimal:
        # Transfers are excluded entirely; income (income category or
        # negative amount) is skipped; the rest is summed as abs().
        is_income = or_(
            Category.name.in_(list(INCOME_CATEGORIES)),
            Transaction.amount < 0,
        )
        result = await db.execute(
            select(
                func.coalesce(
                    func.sum(
                        case((is_income, 0), else_=func.abs(Transaction.amount))
                    ),
                    0,
                )
            )
            .select_from(Transaction)
            .outerjoin(Category, Transaction.category_id == Category.id)
            .where(
                Transaction.user_id == user_id,
                Transaction.date >= start,
                Transaction.date <= end,
                or_(
                    Transaction.category_id.is_(None),
                    Category.name.notin_(list(TRANSFER_CATEGORIES)),
                ),
            )
        )
        total = float(result.scalar_one())
        return Decimal(str(round(total, 2)))

    current_total = await _sum_spending(current_month_start, today)
    prev_total = await _sum_spending(prev_month_start, prev_month_end)

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


async def _get_top_goals(
    db: AsyncSession, user_id: str, today: date, limit: int = 3
) -> tuple[list[GoalDashboardItem], int]:
    """Return top-N active goals by (behind-pace first, lowest progress first) + count.

    Progress + pace aggregates for all goals are batched via to_responses
    (one grouped query per aggregate, max 3 queries total).
    """
    result = await db.execute(
        select(SavingsGoal)
        .options(selectinload(SavingsGoal.linked_account))
        .where(
            SavingsGoal.user_id == user_id,
            SavingsGoal.status == "active",
        )
        .order_by(SavingsGoal.created_at.asc())
    )
    goals = list(result.scalars().all())
    active_count = len(goals)

    responses = await goals_to_responses(db, goals, today=today)

    scored: list[tuple[int, int, GoalDashboardItem]] = []
    for r in responses:
        pace_rank = {
            "behind": 0, "target_passed": 0,
            "on_pace": 1, "ahead": 2, None: 3,
        }[r.pace_status.value if r.pace_status is not None else None]
        item = GoalDashboardItem(
            id=str(r.id),
            name=r.name,
            target_amount=r.target_amount,
            current_amount=r.current_amount,
            progress_pct=r.progress_pct,
            pace_status=r.pace_status.value if r.pace_status else None,
            target_date=r.target_date.isoformat() if r.target_date else None,
        )
        scored.append((pace_rank, r.progress_pct, item))

    scored.sort(key=lambda t: (t[0], t[1]))
    top = [item for _, _, item in scored[:limit]]
    return top, active_count
