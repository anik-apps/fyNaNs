"""Savings Goals service layer: progress, pace, required-monthly, validation."""

import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_FLOOR, Decimal

from dateutil.relativedelta import relativedelta
from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.account import Account
from src.models.savings_goal import SavingsGoal, SavingsGoalContribution
from src.models.transaction import Transaction
from src.schemas.savings_goal import (
    GoalResponse,
    GoalStatus,
    LinkedAccountSummary,
    PaceStatus,
)

BEHIND_THRESHOLD = Decimal("0.75")
AHEAD_THRESHOLD = Decimal("1.10")
ROLLING_WINDOW_DAYS = 30
ROLLING_MONTH_DAYS = Decimal("30.44")

LINKABLE_ACCOUNT_TYPES = {"checking", "savings"}


class SavingsGoalError(Exception):
    """Service-layer error. Mirrors BudgetError in apps/api/src/services/budget.py."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        self.message = message
        self.status_code = status_code


async def compute_current_amount(
    db: AsyncSession, goal: SavingsGoal
) -> Decimal:
    """Progress amount: linked account balance, else sum of contributions. Clamped >= 0."""
    if goal.linked_account_id is not None:
        if goal.linked_account is not None:
            balance = goal.linked_account.balance
        else:
            r = await db.execute(
                select(Account.balance).where(Account.id == goal.linked_account_id)
            )
            balance = r.scalar_one_or_none() or Decimal("0")
        return max(Decimal("0"), balance)

    r = await db.execute(
        select(func.coalesce(func.sum(SavingsGoalContribution.amount), 0))
        .where(SavingsGoalContribution.goal_id == goal.id)
    )
    total = Decimal(str(r.scalar_one()))
    return max(Decimal("0"), total)


def _months_between(start: date, end: date) -> int:
    rd = relativedelta(end, start)
    return max(1, rd.years * 12 + rd.months)


def compute_required_monthly(
    current: Decimal, target: Decimal, target_date: date | None, today: date
) -> Decimal | None:
    if target_date is None or target_date <= today:
        return None
    months = _months_between(today, target_date)
    remaining = max(Decimal("0"), target - current)
    return (remaining / months).quantize(Decimal("0.01"))


def compute_pace_status(
    actual_monthly: Decimal,
    required_monthly: Decimal | None,
    target_date: date | None,
    today: date,
) -> PaceStatus | None:
    """Four-way pace: null | target_passed | behind | on_pace | ahead."""
    # target_date in the past overrides everything.
    if target_date is not None and target_date < today:
        return PaceStatus.TARGET_PASSED
    # No required rate → no pace.
    if required_monthly is None:
        return None
    if actual_monthly >= required_monthly * AHEAD_THRESHOLD:
        return PaceStatus.AHEAD
    if actual_monthly >= required_monthly * BEHIND_THRESHOLD:
        return PaceStatus.ON_PACE
    return PaceStatus.BEHIND


async def compute_actual_monthly(
    db: AsyncSession, goal: SavingsGoal, today: date
) -> Decimal:
    """Rolling 30-day inflow projected to monthly rate."""
    cutoff = today - timedelta(days=ROLLING_WINDOW_DAYS)

    if goal.linked_account_id is not None:
        r = await db.execute(
            select(func.coalesce(func.sum(-Transaction.amount), 0))
            .where(
                Transaction.account_id == goal.linked_account_id,
                Transaction.is_pending.is_(False),
                Transaction.date >= cutoff,
                Transaction.amount < 0,
            )
        )
        actual_30d = Decimal(str(r.scalar_one()))
    else:
        r = await db.execute(
            select(func.coalesce(func.sum(SavingsGoalContribution.amount), 0))
            .where(
                SavingsGoalContribution.goal_id == goal.id,
                SavingsGoalContribution.contribution_date >= cutoff,
            )
        )
        actual_30d = Decimal(str(r.scalar_one()))

    return (actual_30d * (ROLLING_MONTH_DAYS / ROLLING_WINDOW_DAYS)).quantize(
        Decimal("0.01")
    )


async def to_responses(
    db: AsyncSession, goals: Sequence[SavingsGoal], today: date | None = None
) -> list[GoalResponse]:
    """Batch variant of to_response.

    Computes all per-goal aggregates in one grouped query each (instead of
    1-2 queries per goal):
    - contribution totals by goal_id (current amount for unlinked goals;
      mirrors compute_current_amount),
    - rolling-30-day contribution sums by goal_id (pace for unlinked goals;
      mirrors compute_actual_monthly),
    - rolling-30-day inflow sums by account_id for linked goals (pace for
      linked goals; mirrors compute_actual_monthly).

    Responses are assembled in Python and match to_response exactly.
    """
    today = today or date.today()
    if not goals:
        return []

    cutoff = today - timedelta(days=ROLLING_WINDOW_DAYS)
    unlinked_ids = [g.id for g in goals if g.linked_account_id is None]
    linked_account_ids = [
        g.linked_account_id for g in goals if g.linked_account_id is not None
    ]

    contribution_totals: dict[uuid.UUID, Decimal] = {}
    contribution_30d: dict[uuid.UUID, Decimal] = {}
    if unlinked_ids:
        r = await db.execute(
            select(
                SavingsGoalContribution.goal_id,
                func.sum(SavingsGoalContribution.amount),
            )
            .where(SavingsGoalContribution.goal_id.in_(unlinked_ids))
            .group_by(SavingsGoalContribution.goal_id)
        )
        contribution_totals = {
            goal_id: Decimal(str(total)) for goal_id, total in r.all()
        }

        r = await db.execute(
            select(
                SavingsGoalContribution.goal_id,
                func.sum(SavingsGoalContribution.amount),
            )
            .where(
                SavingsGoalContribution.goal_id.in_(unlinked_ids),
                SavingsGoalContribution.contribution_date >= cutoff,
            )
            .group_by(SavingsGoalContribution.goal_id)
        )
        contribution_30d = {
            goal_id: Decimal(str(total)) for goal_id, total in r.all()
        }

    inflow_30d: dict[uuid.UUID, Decimal] = {}
    if linked_account_ids:
        r = await db.execute(
            select(Transaction.account_id, func.sum(-Transaction.amount))
            .where(
                Transaction.account_id.in_(linked_account_ids),
                Transaction.is_pending.is_(False),
                Transaction.date >= cutoff,
                Transaction.amount < 0,
            )
            .group_by(Transaction.account_id)
        )
        inflow_30d = {
            account_id: Decimal(str(total)) for account_id, total in r.all()
        }

    # Balances for linked goals whose relationship wasn't eager-loaded
    # (both list callers use selectinload, so this is normally empty).
    missing_balance_ids = [
        g.linked_account_id
        for g in goals
        if g.linked_account_id is not None and g.linked_account is None
    ]
    balances: dict[uuid.UUID, Decimal] = {}
    if missing_balance_ids:
        r = await db.execute(
            select(Account.id, Account.balance).where(
                Account.id.in_(missing_balance_ids)
            )
        )
        balances = dict(r.all())

    responses = []
    for goal in goals:
        if goal.linked_account_id is not None:
            if goal.linked_account is not None:
                balance = goal.linked_account.balance
            else:
                balance = balances.get(goal.linked_account_id) or Decimal("0")
            current = max(Decimal("0"), balance)
            actual_30d = inflow_30d.get(goal.linked_account_id, Decimal("0"))
        else:
            current = max(
                Decimal("0"), contribution_totals.get(goal.id, Decimal("0"))
            )
            actual_30d = contribution_30d.get(goal.id, Decimal("0"))

        actual = (
            actual_30d * (ROLLING_MONTH_DAYS / ROLLING_WINDOW_DAYS)
        ).quantize(Decimal("0.01"))
        required = compute_required_monthly(
            current, goal.target_amount, goal.target_date, today
        )
        pace = compute_pace_status(actual, required, goal.target_date, today)

        pct = 0
        if goal.target_amount > 0:
            pct = int((current / goal.target_amount * 100).to_integral_value(
                rounding=ROUND_FLOOR
            ))
        pct = min(100, max(0, pct))

        linked = None
        if goal.linked_account_id is not None and goal.linked_account is not None:
            linked = LinkedAccountSummary(
                id=goal.linked_account.id, name=goal.linked_account.name
            )

        responses.append(
            GoalResponse(
                id=goal.id,
                name=goal.name,
                target_amount=goal.target_amount,
                target_date=goal.target_date,
                linked_account=linked,
                status=GoalStatus(goal.status),
                current_amount=current,
                progress_pct=pct,
                required_monthly=required,
                pace_status=pace,
                completed_at=goal.completed_at,
                celebrated_at=goal.celebrated_at,
            )
        )

    return responses


async def to_response(
    db: AsyncSession, goal: SavingsGoal, today: date | None = None
) -> GoalResponse:
    """Single-goal convenience wrapper around to_responses."""
    return (await to_responses(db, [goal], today))[0]


async def validate_linked_account(
    db: AsyncSession,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    exclude_goal_id: uuid.UUID | None = None,
) -> Account:
    """Raise SavingsGoalError if account is invalid for linking."""
    acct_result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    acct = acct_result.scalar_one_or_none()
    if acct is None:
        raise SavingsGoalError("linked_account_id not found", 400)
    if acct.type not in LINKABLE_ACCOUNT_TYPES:
        raise SavingsGoalError("account type must be checking or savings", 400)

    # Partial-unique guard (also enforced at DB; this yields a clean 409)
    q = select(SavingsGoal.id).where(
        SavingsGoal.linked_account_id == account_id,
        SavingsGoal.status == "active",
    )
    if exclude_goal_id is not None:
        q = q.where(SavingsGoal.id != exclude_goal_id)
    existing = await db.execute(q)
    if existing.scalar_one_or_none():
        raise SavingsGoalError("account already has an active goal", 409)

    return acct


async def load_goal(
    db: AsyncSession, goal_id: uuid.UUID, user_id: uuid.UUID
) -> SavingsGoal | None:
    """Fetch a goal with linked_account eager-loaded, verifying ownership."""
    r = await db.execute(
        select(SavingsGoal)
        .options(selectinload(SavingsGoal.linked_account))
        .where(SavingsGoal.id == goal_id, SavingsGoal.user_id == user_id)
    )
    return r.scalar_one_or_none()


async def check_and_flip_completion(
    db: AsyncSession, goal: SavingsGoal
) -> bool:
    """Flip the goal to `completed` if it's active AND current >= target.

    Called synchronously from write paths (PATCH, add-contribution) so that
    user-initiated actions reflect completion immediately rather than waiting
    for the nightly job. The scheduled job is still the authoritative
    completion path for linked-account balance changes from Plaid sync.

    Uses an optimistic guard (`WHERE status='active'`) so concurrent callers
    don't double-flip. Emits the `savings_goal_completed` notification on a
    successful flip; the notification service dedups via its unique index.

    Returns True if this call performed the flip, False otherwise. Caller is
    responsible for committing (this function issues db.commit()).
    """
    # Import here to avoid a circular import at module load
    # (notification service -> user_settings -> nothing cyclical, but keep
    # the pattern consistent with the job module).
    from src.services.notification import create_notification

    if goal.status != "active":
        return False

    current = await compute_current_amount(db, goal)
    if current < goal.target_amount:
        return False

    updated = await db.execute(
        update(SavingsGoal)
        .where(and_(SavingsGoal.id == goal.id, SavingsGoal.status == "active"))
        .values(status="completed", completed_at=datetime.now(UTC))
    )
    await db.commit()
    if updated.rowcount != 1:
        # Another writer won; nothing for us to do.
        return False

    await create_notification(
        db,
        user_id=goal.user_id,
        notif_type="savings_goal_completed",
        reference_id=goal.id,
        period_key="completion",
        title="🎉 Goal reached",
        body=f"You hit your target for {goal.name}",
    )
    return True
