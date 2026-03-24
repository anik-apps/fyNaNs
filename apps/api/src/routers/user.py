import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.account import Account
from src.models.bill import Bill
from src.models.budget import Budget
from src.models.device_token import DeviceToken
from src.models.notification import Notification
from src.models.plaid_item import PlaidItem
from src.models.transaction import Transaction
from src.models.user import User
from src.models.user_settings import UserSettings
from src.routers.deps import get_current_user
from src.schemas.user import (
    ProfileResponse,
    ProfileUpdateRequest,
    SettingsResponse,
    SettingsUpdateRequest,
)
from src.services.export import generate_export

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(user: User = Depends(get_current_user)):
    return ProfileResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        has_mfa=user.mfa_secret is not None,
    )


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if request.name is not None:
        user.name = request.name
    if request.avatar_url is not None:
        user.avatar_url = request.avatar_url
    await db.commit()
    await db.refresh(user)
    return ProfileResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        has_mfa=user.mfa_secret is not None,
    )


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings


@router.put("/settings", response_model=SettingsResponse)
async def update_settings(
    request: SettingsUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)

    await db.commit()
    await db.refresh(settings)
    return settings


@router.post("/export", status_code=202)
async def request_export(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request data export (async). Sends download link via email."""
    # B phase: runs inline. At scale, offload to background job.
    await generate_export(db, user)
    return {"detail": "Export started. You'll receive a download link via email."}


async def _revoke_plaid_tokens(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Best-effort revocation of Plaid access tokens."""
    result = await db.execute(
        select(PlaidItem).where(PlaidItem.user_id == user_id)
    )
    plaid_items = result.scalars().all()

    for item in plaid_items:
        try:
            from src.services.plaid import get_decrypted_access_token, get_plaid_client

            access_token = await get_decrypted_access_token(item)
            client = get_plaid_client(item.environment)
            from plaid.model.item_remove_request import ItemRemoveRequest

            client.item_remove(ItemRemoveRequest(access_token=access_token))
        except Exception:
            logger.warning("Failed to revoke Plaid token for item %s", item.id, exc_info=True)


@router.delete("/account")
async def delete_user_account(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all user data.

    Cascade order:
    1. Revoke Plaid access tokens (best effort)
    2. Delete all user data in DB
    """
    # Step 1: Revoke Plaid tokens
    await _revoke_plaid_tokens(db, user.id)

    # Step 2: Delete user data in correct order to respect FK constraints
    await db.execute(delete(Notification).where(Notification.user_id == user.id))
    await db.execute(delete(Transaction).where(Transaction.user_id == user.id))
    await db.execute(delete(Budget).where(Budget.user_id == user.id))
    await db.execute(delete(Bill).where(Bill.user_id == user.id))
    await db.execute(delete(DeviceToken).where(DeviceToken.user_id == user.id))
    await db.execute(delete(Account).where(Account.user_id == user.id))
    await db.execute(delete(PlaidItem).where(PlaidItem.user_id == user.id))

    # This will cascade-delete OAuth accounts, settings, refresh tokens
    await db.delete(user)
    await db.commit()

    return {"detail": "Account and all associated data deleted"}
