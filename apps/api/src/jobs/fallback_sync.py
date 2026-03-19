from sqlalchemy.ext.asyncio import AsyncSession

from src.services.plaid import (
    get_items_needing_sync,
    has_credit_accounts,
    sync_liabilities,
    sync_transactions,
)


async def execute_fallback_sync(db: AsyncSession) -> dict:
    """Fallback sync for PlaidItems that haven't been synced via webhook.

    Only syncs items that are:
    - Active status
    - Not synced in the last 24 hours (webhook likely handled it)
    - Not synced in 3+ days (stale) OR never synced

    Returns sync statistics.
    """
    items = await get_items_needing_sync(db)
    results: dict = {"items_synced": 0, "errors": []}

    for item in items:
        try:
            await sync_transactions(db, item)

            # Only call liabilities for items with credit accounts
            if await has_credit_accounts(db, item):
                await sync_liabilities(db, item)

            results["items_synced"] += 1
        except Exception as e:
            results["errors"].append(
                {
                    "item_id": str(item.id),
                    "institution": item.institution_name,
                    "error": str(e),
                }
            )

    return results


async def run_fallback_sync() -> None:
    """Entry point for APScheduler."""
    from src.core.database import async_session_factory

    async with async_session_factory() as session:
        await execute_fallback_sync(session)
