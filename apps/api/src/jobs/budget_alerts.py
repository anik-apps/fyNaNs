from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.budget import Budget
from src.models.category import Category
from src.services.budget import compute_current_spend
from src.services.notification import create_notification


async def check_budget_alerts(db: AsyncSession) -> None:
    """Check all budgets and send alerts at 80% and 100% thresholds.

    Uses dedup (type + reference_id + period_key) to ensure one alert per
    threshold per period.
    """
    result = await db.execute(select(Budget))
    budgets = result.scalars().all()

    today = date.today()

    for budget in budgets:
        current_spend = await compute_current_spend(
            db, budget.user_id, budget.category_id, budget.period
        )

        if budget.amount_limit <= 0:
            continue

        percent = (current_spend / budget.amount_limit) * 100

        # Get category name for notification message
        cat_result = await db.execute(
            select(Category).where(Category.id == budget.category_id)
        )
        cat = cat_result.scalar_one_or_none()
        cat_name = cat.name if cat else "Unknown"

        # Determine period key based on budget period
        if budget.period == "monthly":
            period_key = today.strftime("%Y-%m")
        elif budget.period == "weekly":
            # Use ISO week number
            period_key = f"{today.year}-W{today.isocalendar()[1]:02d}"
        elif budget.period == "yearly":
            period_key = str(today.year)
        else:
            period_key = today.strftime("%Y-%m")

        # Check 80% threshold
        if percent >= 80:
            await create_notification(
                db=db,
                user_id=budget.user_id,
                notif_type="budget_80",
                reference_id=budget.id,
                period_key=period_key,
                title=f"Budget Warning: {cat_name}",
                body=(
                    f"You've spent {percent:.0f}% of your {cat_name} budget "
                    f"(${current_spend}/{budget.amount_limit})"
                ),
            )

        # Check 100% threshold
        if percent >= 100:
            await create_notification(
                db=db,
                user_id=budget.user_id,
                notif_type="budget_100",
                reference_id=budget.id,
                period_key=period_key,
                title=f"Budget Exceeded: {cat_name}",
                body=(
                    f"You've exceeded your {cat_name} budget "
                    f"-- ${current_spend} of ${budget.amount_limit}"
                ),
            )


async def run_budget_alerts() -> None:
    """Entry point for APScheduler."""
    from src.core.database import async_session_factory

    async with async_session_factory() as session:
        await check_budget_alerts(session)
