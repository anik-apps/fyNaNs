import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.security import create_access_token
from src.models.refresh_token import RefreshToken

GRACE_WINDOW_SECONDS = 10


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def create_token_pair(
    db: AsyncSession, user_id: uuid.UUID, device_info: str = "unknown"
) -> tuple[str, str]:
    """Returns (access_token, refresh_token)."""
    access_token = create_access_token(user_id)

    raw_refresh = secrets.token_urlsafe(64)
    refresh_token = RefreshToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=_hash_token(raw_refresh),
        device_info=device_info,
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(refresh_token)
    await db.commit()

    return access_token, raw_refresh


async def rotate_refresh_token(
    db: AsyncSession, raw_token: str, device_info: str = "unknown"
) -> tuple[str, str, uuid.UUID]:
    """Rotate refresh token. Returns (new_access, new_refresh, user_id).

    Grace window: old token valid for 10s after rotation (handles concurrent requests).
    Reuse outside grace window invalidates all tokens for that user+device (theft detection).
    """
    token_hash = _hash_token(raw_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    existing = result.scalar_one_or_none()

    now = datetime.now(UTC)

    if not existing:
        raise ValueError("Invalid refresh token")

    if existing.expires_at.replace(tzinfo=UTC) < now:
        await db.delete(existing)
        await db.commit()
        raise ValueError("Refresh token expired")

    user_id = existing.user_id

    # Check if this token was already rotated (grace window check).
    if existing.expires_at.replace(tzinfo=UTC) <= now + timedelta(
        seconds=GRACE_WINDOW_SECONDS
    ):
        raise ValueError("Token already rotated. Use the new refresh token.")

    # Perform rotation: shorten old token's expiry to grace window
    existing.expires_at = now + timedelta(seconds=GRACE_WINDOW_SECONDS)
    await db.flush()

    # Create new token pair
    access_token, new_refresh = await create_token_pair(db, user_id, device_info)
    await db.commit()
    return access_token, new_refresh, user_id


async def revoke_refresh_token(db: AsyncSession, token_hash: str) -> None:
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    token = result.scalar_one_or_none()
    if token:
        await db.delete(token)
        await db.commit()
