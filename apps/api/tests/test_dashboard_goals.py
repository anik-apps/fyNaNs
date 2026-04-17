from datetime import date
from decimal import Decimal

import pytest

from src.models.savings_goal import SavingsGoal
from src.models.user import User
from src.services.dashboard import get_dashboard


@pytest.mark.asyncio
async def test_dashboard_includes_top_goals_and_count(db_session):
    user = User(email="dash-g@example.com", name="Dash", password_hash="x")
    db_session.add(user)
    await db_session.flush()

    for i, name in enumerate(["a", "b", "c", "d"]):
        db_session.add(SavingsGoal(
            user_id=user.id, name=name,
            target_amount=Decimal(str((i + 1) * 100)),
            status="active",
        ))
    db_session.add(SavingsGoal(
        user_id=user.id, name="old", target_amount=Decimal("1"),
        status="archived",
    ))
    await db_session.commit()

    # get_dashboard takes user_id as str (matches existing sig in services/dashboard.py)
    resp = await get_dashboard(db_session, str(user.id), today=date(2026, 4, 16))
    assert resp.active_goals_count == 4
    assert len(resp.top_goals) == 3  # capped at 3
