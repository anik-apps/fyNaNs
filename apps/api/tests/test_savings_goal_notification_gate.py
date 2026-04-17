import uuid

import pytest

from src.models.user import User
from src.models.user_settings import UserSettings
from src.services.notification import create_notification


@pytest.mark.asyncio
async def test_gate_blocks_when_disabled(db_session):
    user = User(email="gate@example.com", name="Gate", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserSettings(user_id=user.id, notify_savings_goals=False))
    await db_session.commit()

    result = await create_notification(
        db_session,
        user_id=user.id,
        notif_type="savings_goal_completed",
        reference_id=uuid.uuid4(),
        period_key="completion",
        title="x", body="y",
    )
    assert result is None


@pytest.mark.asyncio
async def test_gate_allows_when_enabled(db_session):
    user = User(email="gate2@example.com", name="Gate2", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserSettings(user_id=user.id, notify_savings_goals=True))
    await db_session.commit()

    result = await create_notification(
        db_session,
        user_id=user.id,
        notif_type="savings_goal_completed",
        reference_id=uuid.uuid4(),
        period_key="completion",
        title="x", body="y",
    )
    assert result is not None
    assert result.type == "savings_goal_completed"
