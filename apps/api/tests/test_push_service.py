import uuid
from unittest.mock import patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.device_token import DeviceToken
from src.models.notification import Notification
from src.models.user import User


@pytest.mark.asyncio
@patch("src.services.notification._send_expo_push")
async def test_create_and_send_notification(mock_push, db_session: AsyncSession):
    from src.services.notification import create_notification

    mock_push.return_value = True

    user = User(email="push@example.com", name="Push User", password_hash="fake")
    db_session.add(user)
    await db_session.flush()

    # Register a device token
    dt = DeviceToken(
        user_id=user.id, token="ExponentPushToken[test123]", platform="ios"
    )
    db_session.add(dt)
    await db_session.commit()

    notif = await create_notification(
        db_session,
        user_id=user.id,
        notif_type="budget_80",
        reference_id=uuid.uuid4(),
        period_key="2026-03",
        title="Budget Alert",
        body="You've spent 80% of your Food budget",
    )

    assert notif is not None
    assert notif.type == "budget_80"
    assert notif.channel == "push"
    mock_push.assert_called_once()


@pytest.mark.asyncio
async def test_duplicate_notification_skipped(db_session: AsyncSession):
    from src.services.notification import create_notification

    user = User(email="dedup@example.com", name="Dedup User", password_hash="fake")
    db_session.add(user)
    await db_session.flush()

    ref_id = uuid.uuid4()

    # First notification
    with patch("src.services.notification._send_expo_push", return_value=True):
        notif1 = await create_notification(
            db_session,
            user_id=user.id,
            notif_type="budget_100",
            reference_id=ref_id,
            period_key="2026-03",
            title="Budget Exceeded",
            body="Budget exceeded",
        )
        assert notif1 is not None

    # Duplicate (same user, type, reference_id, period_key)
    with patch("src.services.notification._send_expo_push", return_value=True):
        notif2 = await create_notification(
            db_session,
            user_id=user.id,
            notif_type="budget_100",
            reference_id=ref_id,
            period_key="2026-03",
            title="Budget Exceeded",
            body="Budget exceeded",
        )
        assert notif2 is None  # Dedup -- already sent
