from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.constants import INCOME_CATEGORIES, TRANSFER_CATEGORIES
from src.models.account import Account
from src.models.category import Category
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

    # Aggregate per-day NW deltas in SQL using category + Plaid sign convention.
    # Plaid sign convention (all account types):
    #   positive = money out, negative = money in
    # Category overrides sign for known income/transfer categories:
    # transfers are excluded entirely; income counts as money in.
    # To reverse a day going backwards: subtract money in, add back money out.
    delta = case(
        (Category.name.in_(list(INCOME_CATEGORIES)), -func.abs(Transaction.amount)),
        (Transaction.amount < 0, -func.abs(Transaction.amount)),
        else_=func.abs(Transaction.amount),
    )
    txn_result = await db.execute(
        select(Transaction.date, func.sum(delta).label("delta"))
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
            Transaction.date <= today,
            or_(
                Transaction.category_id.is_(None),
                Category.name.notin_(list(TRANSFER_CATEGORIES)),
            ),
        )
        .group_by(Transaction.date)
    )
    daily_deltas: dict[date, float] = {
        row.date: float(row.delta) for row in txn_result.all()
    }

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

    # Determine period buckets (oldest first)
    points: list[SpendingBarPoint] = []

    if view == "monthly":
        period_starts: list[date] = []
        for i in range(months - 1, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            period_starts.append(date(y, m, 1))
        last = period_starts[-1]
        range_end = (
            date(last.year + 1, 1, 1) if last.month == 12
            else date(last.year, last.month + 1, 1)
        )
        totals = await _compute_period_totals(
            db, user_id, period_starts[0], range_end, "month",
        )
        labels = [d.strftime("%b %Y") for d in period_starts]
    else:  # yearly
        num_years = min(months // 12 + 1, 10)
        period_starts = [
            date(today.year - i, 1, 1) for i in range(num_years - 1, -1, -1)
        ]
        range_end = date(today.year + 1, 1, 1)
        totals = await _compute_period_totals(
            db, user_id, period_starts[0], range_end, "year",
        )
        labels = [str(d.year) for d in period_starts]

    for period_start, label in zip(period_starts, labels, strict=True):
        spending, income = totals.get(period_start, (0.0, 0.0))
        points.append(SpendingBarPoint(
            label=label,
            period_start=period_start.isoformat(),
            spending=round(spending, 2),
            income=round(income, 2),
        ))

    return SpendingHistoryResponse(points=points, view=view)


async def _compute_period_totals(
    db: AsyncSession,
    user_id: str,
    range_start: date,
    range_end: date,
    granularity: str,
) -> dict[date, tuple[float, float]]:
    """Compute spending and income totals per period bucket in one query.

    Uses Plaid sign convention (positive = out, negative = in)
    with category override for known income/transfer categories:
    transfers are excluded entirely; income-category or negative
    amounts count (as abs) toward income, the rest toward spending.

    Returns {bucket start date: (spending, income)}, where buckets are
    date_trunc'd to ``granularity`` ("month" or "year"). Buckets with no
    transactions are absent.
    """
    is_income = or_(
        Category.name.in_(list(INCOME_CATEGORIES)),
        Transaction.amount < 0,
    )
    bucket = func.date_trunc(granularity, Transaction.date).label("bucket")
    result = await db.execute(
        select(
            bucket,
            func.sum(
                case((is_income, 0), else_=func.abs(Transaction.amount))
            ).label("spending"),
            func.sum(
                case((is_income, func.abs(Transaction.amount)), else_=0)
            ).label("income"),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= range_start,
            Transaction.date < range_end,
            or_(
                Transaction.category_id.is_(None),
                Category.name.notin_(list(TRANSFER_CATEGORIES)),
            ),
        )
        .group_by(bucket)
    )

    return {
        row.bucket.date(): (float(row.spending), float(row.income))
        for row in result.all()
    }
