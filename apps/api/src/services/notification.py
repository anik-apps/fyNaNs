import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.device_token import DeviceToken
from src.models.notification import Notification
from src.models.user_settings import UserSettings

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    notif_type: str,
    reference_id: uuid.UUID,
    period_key: str,
    title: str,
    body: str,
    channel: str = "push",
) -> Notification | None:
    """Create a notification, skipping if duplicate (dedup constraint).

    Sends push notification to all user's registered devices.
    Returns None if duplicate (already sent for this type+reference+period).
    """
    # Check for duplicate
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.type == notif_type,
            Notification.reference_id == reference_id,
            Notification.period_key == period_key,
        )
    )
    if result.scalar_one_or_none():
        return None  # Already sent

    # Check user notification preferences
    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    user_settings = settings_result.scalar_one_or_none()

    if user_settings:
        # Check specific notification type preferences
        if notif_type.startswith("budget_") and not user_settings.notify_budget_alerts:
            return None
        if notif_type.startswith("bill_") and not user_settings.notify_bill_reminders:
            return None

    # Create notification record
    notif = Notification(
        user_id=user_id,
        type=notif_type,
        reference_id=reference_id,
        period_key=period_key,
        channel=channel,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)

    # Send push notification
    if channel == "push" and (not user_settings or user_settings.notify_push):
        device_result = await db.execute(
            select(DeviceToken).where(DeviceToken.user_id == user_id)
        )
        tokens = device_result.scalars().all()

        for dt in tokens:
            await _send_expo_push(dt.token, title, body)

    # Send email notification
    if channel == "email" or (user_settings and user_settings.notify_email):
        # Email sending deferred -- could call email service here
        pass

    return notif


async def _send_expo_push(expo_token: str, title: str, body: str) -> bool:
    """Send a push notification via Expo Push API."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json={
                    "to": expo_token,
                    "title": title,
                    "body": body,
                    "sound": "default",
                },
                headers={"Content-Type": "application/json"},
            )
            return response.status_code == 200
    except Exception:
        # Log error but don't fail -- push is best-effort
        return False
