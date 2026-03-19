import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.models.device_token import DeviceToken
from src.models.user import User
from src.routers.deps import get_current_user
from src.schemas.notification import DeviceTokenCreateRequest, DeviceTokenResponse

router = APIRouter(prefix="/device-tokens", tags=["device-tokens"])


@router.post("", response_model=DeviceTokenResponse, status_code=201)
async def register_device_token(
    request: DeviceTokenCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register device token for push notifications. Idempotent."""
    # Check for existing
    result = await db.execute(
        select(DeviceToken).where(
            DeviceToken.user_id == user.id,
            DeviceToken.token == request.token,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    device_token = DeviceToken(
        user_id=user.id,
        token=request.token,
        platform=request.platform,
    )
    db.add(device_token)
    await db.commit()
    await db.refresh(device_token)
    return device_token


@router.delete("/{token_id}")
async def delete_device_token(
    token_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DeviceToken).where(
            DeviceToken.id == token_id,
            DeviceToken.user_id == user.id,
        )
    )
    device_token = result.scalar_one_or_none()
    if not device_token:
        raise HTTPException(status_code=404, detail="Device token not found")

    await db.delete(device_token)
    await db.commit()
    return {"detail": "Device token removed"}
