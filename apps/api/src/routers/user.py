from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
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
    # In production, this would be an async background task.
    # For B phase, run inline (data is small).
    await generate_export(db, user)
    return {"detail": "Export started. You'll receive a download link via email."}
