"""Daily savings-goals job: completion detection, recovery scan, behind-schedule."""

from datetime import UTC, date, datetime

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.notification import Notification
from src.models.savings_goal import SavingsGoal
from src.models.user_settings import UserSettings
from src.services.notification import create_notification
from src.services.savings_goal import compute_current_amount


async def check_savings_goals(db: AsyncSession, today: date | None = None) -> None:
    today = today or date.today()

    # --- Recovery scan: completed goals missing completion notification ---
    await _backfill_missing_completion_notifications(db)

    # --- Iterate active goals ---
    result = await db.execute(
        select(SavingsGoal).where(SavingsGoal.status == "active")
    )
    for goal in result.scalars().all():
        current = await compute_current_amount(db, goal)

        # Completion path — note: create_notification commits internally, so the
        # status UPDATE and notification row are not transactionally atomic.
        # The recovery scan at the top of the next run catches any crash between
        # UPDATE and create_notification.
        if current >= goal.target_amount:
            updated = await db.execute(
                update(SavingsGoal)
                .where(and_(
                    SavingsGoal.id == goal.id, SavingsGoal.status == "active"
                ))
                .values(status="completed", completed_at=datetime.now(UTC))
            )
            await db.commit()
            if updated.rowcount == 1:
                await create_notification(
                    db,
                    user_id=goal.user_id,
                    notif_type="savings_goal_completed",
                    reference_id=goal.id,
                    period_key="completion",
                    title="🎉 Goal reached",
                    body=f"You hit your target for {goal.name}",
                )
            continue

        # Behind-schedule path implemented in Task 10.


async def _backfill_missing_completion_notifications(db: AsyncSession) -> None:
    """Backfill notifications for goals that flipped completed but lack the row.

    Skips goals whose owner has disabled `notify_savings_goals` — otherwise
    `create_notification` would return None every run and the scan would never
    converge for that goal.
    """
    q = (
        select(SavingsGoal)
        .outerjoin(
            Notification,
            and_(
                Notification.user_id == SavingsGoal.user_id,
                Notification.type == "savings_goal_completed",
                Notification.reference_id == SavingsGoal.id,
                Notification.period_key == "completion",
            ),
        )
        .outerjoin(UserSettings, UserSettings.user_id == SavingsGoal.user_id)
        .where(
            SavingsGoal.status == "completed",
            Notification.id.is_(None),
            # No settings row → allowed (defaults). Settings present → must be True.
            (UserSettings.id.is_(None)) | (UserSettings.notify_savings_goals.is_(True)),
        )
    )
    result = await db.execute(q)
    for goal in result.scalars().all():
        await create_notification(
            db,
            user_id=goal.user_id,
            notif_type="savings_goal_completed",
            reference_id=goal.id,
            period_key="completion",
            title="🎉 Goal reached",
            body=f"You hit your target for {goal.name}",
        )


async def run_savings_goals() -> None:
    """APScheduler entry point."""
    from src.core.database import async_session_factory

    async with async_session_factory() as session:
        await check_savings_goals(session)
