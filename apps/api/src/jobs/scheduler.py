from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from src.core.config import settings

# Convert async URL to sync for APScheduler job store
_sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")

scheduler = AsyncIOScheduler(
    jobstores={
        "default": SQLAlchemyJobStore(url=_sync_url, tablename="apscheduler_jobs"),
    },
)


def setup_jobs():
    """Register all scheduled jobs."""
    from src.jobs.bill_reminders import run_bill_reminders
    from src.jobs.budget_alerts import run_budget_alerts
    from src.jobs.fallback_sync import run_fallback_sync
    from src.jobs.savings_goals import run_savings_goals

    # Bill reminders: daily at 8:00 AM UTC
    scheduler.add_job(
        run_bill_reminders,
        "cron",
        hour=8,
        minute=0,
        id="bill_reminders",
        replace_existing=True,
    )

    # Budget alerts: every 6 hours (catches new transactions from syncs)
    scheduler.add_job(
        run_budget_alerts,
        "cron",
        hour="*/6",
        minute=15,
        id="budget_alerts",
        replace_existing=True,
    )

    # Fallback Plaid sync: every 3 days at 2:00 AM UTC
    scheduler.add_job(
        run_fallback_sync,
        "cron",
        day="*/3",
        hour=2,
        minute=0,
        id="fallback_sync",
        replace_existing=True,
    )

    # Savings goals: daily at 09:00 UTC
    scheduler.add_job(
        run_savings_goals,
        "cron",
        hour=9,
        minute=0,
        id="savings_goals",
        replace_existing=True,
    )
