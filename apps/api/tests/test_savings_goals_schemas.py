import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from pydantic import ValidationError

from src.schemas.savings_goal import (
    ContributionCreate,
    GoalCreate,
    GoalReopen,
    GoalResponse,
    GoalStatus,
    PaceStatus,
)


def test_pace_status_values():
    assert PaceStatus.AHEAD.value == "ahead"
    assert PaceStatus.ON_PACE.value == "on_pace"
    assert PaceStatus.BEHIND.value == "behind"
    assert PaceStatus.TARGET_PASSED.value == "target_passed"


def test_goal_create_valid():
    req = GoalCreate(
        name="Emergency",
        target_amount=Decimal("10000.00"),
        target_date=date.today() + timedelta(days=180),
    )
    assert req.name == "Emergency"
    assert req.target_amount == Decimal("10000.00")
    assert req.linked_account_id is None


def test_goal_create_rejects_zero_target():
    with pytest.raises(ValidationError):
        GoalCreate(name="Bad", target_amount=Decimal("0"))


def test_goal_create_rejects_past_target_date():
    with pytest.raises(ValidationError):
        GoalCreate(
            name="Late",
            target_amount=Decimal("1"),
            target_date=date.today() - timedelta(days=1),
        )


def test_goal_create_trims_and_requires_name():
    with pytest.raises(ValidationError):
        GoalCreate(name="   ", target_amount=Decimal("1"))


def test_contribution_create_rejects_zero():
    with pytest.raises(ValidationError):
        ContributionCreate(
            contribution_date=date.today(), amount=Decimal("0")
        )


def test_reopen_requires_positive_new_target():
    with pytest.raises(ValidationError):
        GoalReopen(new_target_amount=Decimal("0"))


def test_response_model_roundtrip():
    gid = uuid.uuid4()
    resp = GoalResponse(
        id=gid,
        name="Test",
        target_amount=Decimal("100.00"),
        target_date=None,
        linked_account=None,
        status=GoalStatus.ACTIVE,
        current_amount=Decimal("42.00"),
        progress_pct=42,
        required_monthly=None,
        pace_status=None,
        completed_at=None,
        celebrated_at=None,
    )
    dumped = resp.model_dump(mode="json")
    assert dumped["progress_pct"] == 42
    # Pydantic serializes Decimal as string in JSON mode by default; either form is acceptable
    assert Decimal(str(dumped["target_amount"])) == Decimal("100.00")
