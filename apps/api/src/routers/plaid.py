import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

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
        result = await create_link_token(user.id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create link token: {e}")


@router.post("/exchange-token", response_model=ExchangeTokenResponse)
async def exchange_token(
    request: ExchangeTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        plaid_item, num_accounts = await exchange_public_token(
            db, user.id, request.public_token,
            request.institution_id, request.institution_name,
        )
        return ExchangeTokenResponse(
            plaid_item_id=plaid_item.id,
            institution_name=plaid_item.institution_name,
            accounts_linked=num_accounts,
        )
    except PlaidServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


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


@router.delete("/items/{item_id}")
async def delete_plaid_item(
    item_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke Plaid access token and remove PlaidItem.

    Associated accounts are converted to manual (preserving transaction history).
    """
    result = await db.execute(
        select(PlaidItem).where(PlaidItem.id == item_id, PlaidItem.user_id == user.id)
    )
    plaid_item = result.scalar_one_or_none()
    if not plaid_item:
        raise HTTPException(status_code=404, detail="Plaid item not found")

    # Try to revoke access token with Plaid (best effort)
    try:
        from src.services.plaid import _get_plaid_client, get_decrypted_access_token
        from plaid.model.item_remove_request import ItemRemoveRequest

        access_token = await get_decrypted_access_token(plaid_item)
        client = _get_plaid_client()
        client.item_remove(ItemRemoveRequest(access_token=access_token))
    except Exception:
        pass  # Log but proceed -- orphaned tokens expire naturally

    # Convert associated accounts to manual
    accounts_result = await db.execute(
        select(Account).where(Account.plaid_item_id == plaid_item.id)
    )
    for account in accounts_result.scalars().all():
        account.is_manual = True
        account.plaid_item_id = None
        account.plaid_account_id = None

    await db.delete(plaid_item)
    await db.commit()

    return {"detail": "Plaid item removed, accounts converted to manual"}
