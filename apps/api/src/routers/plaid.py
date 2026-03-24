import asyncio
import json
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.models.account import Account
from src.models.plaid_item import PlaidItem
from src.models.user import User
from src.routers.deps import get_current_user
from src.schemas.plaid import (
    ExchangeTokenRequest,
    ExchangeTokenResponse,
    LinkTokenResponse,
    PlaidItemResponse,
)
from src.services.plaid import (
    MIN_SYNC_INTERVAL,
    PlaidServiceError,
    create_link_token,
    exchange_public_token,
    handle_webhook_event,
    verify_plaid_webhook,
)

router = APIRouter(prefix="/plaid", tags=["plaid"])


@router.post("/link-token", response_model=LinkTokenResponse)
async def create_link(user: User = Depends(get_current_user)):
    try:
        environment = ""
        if user.email.lower() in settings.dev_emails_set and user.use_plaid_sandbox:
            environment = "sandbox"
        result = await create_link_token(user.id, environment=environment)
        return result
    except Exception as e:
        import logging

        logging.getLogger(__name__).error("Failed to create link token: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create link token") from e


@router.post("/exchange-token", response_model=ExchangeTokenResponse)
async def exchange_token(
    request: ExchangeTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        environment = ""
        if user.email.lower() in settings.dev_emails_set and user.use_plaid_sandbox:
            environment = "sandbox"
        plaid_item, num_accounts = await exchange_public_token(
            db, user.id, request.public_token,
            request.institution_id, request.institution_name,
            environment=environment,
        )
        return ExchangeTokenResponse(
            plaid_item_id=plaid_item.id,
            institution_name=plaid_item.institution_name,
            accounts_linked=num_accounts,
        )
    except PlaidServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.post("/webhook")
async def receive_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Receive Plaid webhooks. Excluded from auth middleware and user rate limiting."""
    body = await request.body()
    verification_header = request.headers.get("Plaid-Verification")

    verified = await verify_plaid_webhook(body, verification_header)
    if not verified:
        raise HTTPException(status_code=400, detail="Webhook verification failed")

    payload = json.loads(body)
    webhook_type = payload.get("webhook_type", "")
    webhook_code = payload.get("webhook_code", "")
    item_id = payload.get("item_id", "")

    await handle_webhook_event(db, webhook_type, webhook_code, item_id)

    return {"status": "received"}


@router.get("/items", response_model=list[PlaidItemResponse])
async def list_plaid_items(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlaidItem).where(PlaidItem.user_id == user.id)
    )
    items = result.scalars().all()

    response = []
    for item in items:
        # Count accounts for this item
        count_result = await db.execute(
            select(func.count()).where(Account.plaid_item_id == item.id)
        )
        account_count = count_result.scalar() or 0

        response.append(PlaidItemResponse(
            id=item.id,
            institution_name=item.institution_name,
            status=item.status,
            last_synced_at=item.last_synced_at,
            account_count=account_count,
            created_at=item.created_at,
        ))

    return response


@router.post("/items/{item_id}/sync")
async def sync_plaid_item(
    item_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger a transaction sync for a linked Plaid item."""
    import uuid as uuid_mod

    from src.services.plaid import has_credit_accounts, sync_liabilities, sync_transactions

    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.id == uuid_mod.UUID(item_id),
            PlaidItem.user_id == user.id,
        )
    )
    plaid_item = result.scalar_one_or_none()
    if not plaid_item:
        raise HTTPException(status_code=404, detail="Plaid item not found")

    if plaid_item.status != "active":
        raise HTTPException(status_code=400, detail="Item is not active")

    if plaid_item.last_synced_at:
        elapsed = datetime.now(UTC) - plaid_item.last_synced_at
        if elapsed < MIN_SYNC_INTERVAL:
            raise HTTPException(
                status_code=429,
                detail=(
                    "Sync rate limited. Try again in "
                    f"{int((MIN_SYNC_INTERVAL - elapsed).total_seconds())} seconds."
                ),
            )

    sync_result = await sync_transactions(db, plaid_item)

    if await has_credit_accounts(db, plaid_item):
        await sync_liabilities(db, plaid_item)

    return {
        "added": sync_result["added"],
        "modified": sync_result["modified"],
        "removed": sync_result["removed"],
    }


@router.post("/sync-all")
async def sync_all_items(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync all active Plaid items for the current user."""
    from src.services.plaid import has_credit_accounts, sync_liabilities, sync_transactions

    result = await db.execute(
        select(PlaidItem).where(
            PlaidItem.user_id == user.id,
            PlaidItem.status == "active",
        )
    )
    items = result.scalars().all()

    total = {"added": 0, "modified": 0, "removed": 0, "items_synced": 0}
    for item in items:
        try:
            sync_result = await sync_transactions(db, item)
            total["added"] += sync_result["added"]
            total["modified"] += sync_result["modified"]
            total["removed"] += sync_result["removed"]
            total["items_synced"] += 1

            if await has_credit_accounts(db, item):
                await sync_liabilities(db, item)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Sync failed for item %s: %s", item.id, e)
            continue

    return total


@router.delete("/items/{item_id}")
async def delete_plaid_item(
    item_id: uuid.UUID,
    delete_accounts: bool = Query(False, description="Also delete all accounts and transactions"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke Plaid access token and remove PlaidItem.

    By default, associated accounts are converted to manual (preserving transaction history).
    Set delete_accounts=true to also delete all accounts and their transactions.
    """
    result = await db.execute(
        select(PlaidItem).where(PlaidItem.id == item_id, PlaidItem.user_id == user.id)
    )
    plaid_item = result.scalar_one_or_none()
    if not plaid_item:
        raise HTTPException(status_code=404, detail="Plaid item not found")

    # Try to revoke access token with Plaid (best effort)
    try:
        from plaid.model.item_remove_request import ItemRemoveRequest

        from src.services.plaid import get_decrypted_access_token, get_plaid_client

        access_token = await get_decrypted_access_token(plaid_item)
        client = get_plaid_client(plaid_item.environment)
        await asyncio.to_thread(client.item_remove, ItemRemoveRequest(access_token=access_token))
    except Exception:
        pass  # Log but proceed -- orphaned tokens expire naturally

    accounts_result = await db.execute(
        select(Account).where(Account.plaid_item_id == plaid_item.id)
    )
    accounts = accounts_result.scalars().all()
    num_accounts = len(accounts)

    if delete_accounts:
        # Delete accounts and their transactions (cascade)
        for account in accounts:
            await db.delete(account)
    else:
        # Convert accounts to manual (preserve transaction history)
        for account in accounts:
            account.is_manual = True
            account.plaid_item_id = None
            account.plaid_account_id = None

    await db.delete(plaid_item)
    await db.commit()

    action = "deleted" if delete_accounts else "converted to manual"
    return {"detail": f"Bank unlinked, {num_accounts} accounts {action}"}
