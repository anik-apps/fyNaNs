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

    # Get all transactions in the period, ordered by date desc
    # We'll work backwards: for each past date, subtract transactions after that date
    txn_result = await db.execute(
        select(Transaction.date, Transaction.amount, Transaction.account_id)
        .where(
            Transaction.user_id == user_id,
            Transaction.date >= start_date,
        )
        .order_by(Transaction.date.desc())
    )
    transactions = txn_result.all()

    # Net worth impact: positive amount = NW decreases (both asset and liability accounts).
    # We reverse transactions to compute past NW from current NW.

    # Build cumulative daily net worth deltas (from today backwards)
    daily_deltas: dict[date, float] = {}
    for txn_date, amount, _acct_id in transactions:
        d = txn_date if isinstance(txn_date, date) else date.fromisoformat(str(txn_date))
        delta = float(amount)  # positive = NW decreased
        # For asset accounts: money out (+amount) means NW went down
        # For liability accounts: charge (+amount) means more debt = NW went down
        # Both cases: positive amount = negative NW impact
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
