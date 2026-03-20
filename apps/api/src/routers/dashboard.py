from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.account import Account
from src.models.transaction import Transaction
from src.models.user import User
from src.routers.deps import get_current_user, get_db
from src.schemas.dashboard import DashboardResponse
from src.services.dashboard import ASSET_TYPES, get_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
async def dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated dashboard view: net worth, balances, transactions, budgets, bills, spending."""
    return await get_dashboard(db, str(current_user.id))


class NetWorthPoint(BaseModel):
    date: str
    net_worth: float


class NetWorthHistoryResponse(BaseModel):
    points: list[NetWorthPoint]
    current_net_worth: float


@router.get("/net-worth-history", response_model=NetWorthHistoryResponse)
async def net_worth_history(
    period: str = Query("1m", regex="^(1m|3m|6m|1y|5y|all)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compute historical net worth by working backwards from current balances.

    Uses transaction history to estimate what net worth was at past dates.
    Current balance - sum(transactions after date) = estimated balance at date.
    """
    user_id = str(current_user.id)
    today = date.today()

    # Determine date range and interval
    period_config = {
        "1m": (30, 1),       # 30 days, daily points
        "3m": (90, 3),       # 90 days, every 3 days
        "6m": (180, 7),      # 6 months, weekly
        "1y": (365, 14),     # 1 year, biweekly
        "5y": (1825, 30),    # 5 years, monthly
        "all": (3650, 30),   # 10 years max, monthly
    }
    total_days, interval = period_config.get(period, (30, 1))
    start_date = today - timedelta(days=total_days)

    # Get current net worth (assets - liabilities)
    acct_result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (Account.type.in_(list(ASSET_TYPES)), Account.balance),
                        else_=0,
                    )
                ),
                0,
            ).label("assets"),
            func.coalesce(
                func.sum(
                    case(
                        (Account.type.notin_(list(ASSET_TYPES)), Account.balance),
                        else_=0,
                    )
                ),
                0,
            ).label("liabilities"),
        ).where(Account.user_id == user_id)
    )
    row = acct_result.one()
    current_nw = float(row.assets) - float(row.liabilities)

    # Get all transactions in the period with their categories
    from src.models.category import Category

    txn_result = await db.execute(
        select(Transaction.date, Transaction.amount, Category.name)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
        )
        .order_by(Transaction.date.desc())
    )
    transactions = txn_result.all()

    # Determine NW impact per transaction using category as the source of truth.
    # Plaid sandbox data has inconsistent signs (income sometimes positive),
    # so we use category to determine direction:
    #   - Income/Transfer-in categories: NW increased (regardless of sign)
    #   - Transfer categories: NW unchanged (internal move)
    #   - Everything else (expenses): NW decreased
    income_categories = {"Income", "Salary", "Freelance", "Other Income", "Investments"}
    transfer_categories = {"Transfer"}

    daily_deltas: dict[date, float] = {}
    for txn_date, amount, cat_name in transactions:
        d = txn_date if isinstance(txn_date, date) else date.fromisoformat(str(txn_date))
        abs_amount = abs(float(amount))

        if cat_name in transfer_categories:
            continue  # Transfers don't affect NW
        elif cat_name in income_categories:
            # Income increased NW → to reverse going backwards, subtract
            delta = -abs_amount
        else:
            # Expense decreased NW → to reverse going backwards, add
            delta = abs_amount

        daily_deltas[d] = daily_deltas.get(d, 0) + delta

    # Generate data points by working backwards
    points: list[NetWorthPoint] = []
    running_nw = current_nw

    # Add today
    points.append(NetWorthPoint(date=today.isoformat(), net_worth=round(running_nw, 2)))

    # Walk backwards day by day, emit points at intervals
    days_since_point = 0

    for day_offset in range(1, total_days + 1):
        d = today - timedelta(days=day_offset)
        days_since_point += 1

        # Reverse the transactions for the NEXT day (today - day_offset + 1)
        # because we're computing what NW was BEFORE those transactions happened
        next_day = today - timedelta(days=day_offset - 1)
        if next_day in daily_deltas:
            # Add back the delta (reverse the transactions)
            running_nw += daily_deltas[next_day]

        if days_since_point >= interval:
            points.append(NetWorthPoint(date=d.isoformat(), net_worth=round(running_nw, 2)))
            days_since_point = 0

    # Reverse so oldest is first
    points.reverse()

    return NetWorthHistoryResponse(
        points=points,
        current_net_worth=round(current_nw, 2),
    )


class SpendingBarPoint(BaseModel):
    label: str  # "Jan 2026", "Feb 2026", etc.
    period_start: str
    spending: float
    income: float


class SpendingHistoryResponse(BaseModel):
    points: list[SpendingBarPoint]
    view: str  # "monthly" or "yearly"


@router.get("/spending-history", response_model=SpendingHistoryResponse)
async def spending_history(
    view: str = Query("monthly", regex="^(monthly|yearly)$"),
    months: int = Query(6, ge=1, le=60),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get monthly or yearly spending/income totals for bar chart.

    Uses category to determine income vs expense (same logic as NW history,
    since Plaid sandbox data has inconsistent signs).
    """
    user_id = str(current_user.id)
    today = date.today()

    income_categories = {"Income", "Salary", "Freelance", "Other Income", "Investments"}
    transfer_categories = {"Transfer"}

    # Determine periods
    points: list[SpendingBarPoint] = []

    if view == "monthly":
        for i in range(months - 1, -1, -1):
            # Calculate month start/end
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            month_start = date(y, m, 1)
            month_end = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)

            label = month_start.strftime("%b %Y")
            spending, income = await _compute_period_totals(
                db, user_id, month_start, month_end,
                income_categories, transfer_categories,
            )
            points.append(SpendingBarPoint(
                label=label,
                period_start=month_start.isoformat(),
                spending=round(spending, 2),
                income=round(income, 2),
            ))
    else:  # yearly
        num_years = min(months // 12 + 1, 10)
        for i in range(num_years - 1, -1, -1):
            y = today.year - i
            year_start = date(y, 1, 1)
            year_end = date(y + 1, 1, 1)
            label = str(y)
            spending, income = await _compute_period_totals(
                db, user_id, year_start, year_end,
                income_categories, transfer_categories,
            )
            points.append(SpendingBarPoint(
                label=label,
                period_start=year_start.isoformat(),
                spending=round(spending, 2),
                income=round(income, 2),
            ))

    return SpendingHistoryResponse(points=points, view=view)


async def _compute_period_totals(
    db: AsyncSession,
    user_id: str,
    period_start: date,
    period_end: date,
    income_categories: set[str],
    transfer_categories: set[str],
) -> tuple[float, float]:
    """Compute total spending and income for a period using category-based logic."""
    from src.models.category import Category

    result = await db.execute(
        select(Transaction.amount, Category.name)
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= period_start,
            Transaction.date < period_end,
        )
    )

    spending = 0.0
    income = 0.0
    for amount, cat_name in result.all():
        abs_amt = abs(float(amount))
        if cat_name in transfer_categories:
            continue
        elif cat_name in income_categories:
            income += abs_amt
        else:
            spending += abs_amt

    return spending, income
