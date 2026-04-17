import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GoalStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class PaceStatus(str, Enum):
    AHEAD = "ahead"
    ON_PACE = "on_pace"
    BEHIND = "behind"
    TARGET_PASSED = "target_passed"


class LinkedAccountSummary(BaseModel):
    id: uuid.UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


_MoneyField = Annotated[Decimal, Field(max_digits=14, decimal_places=2)]


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    target_amount: _MoneyField
    target_date: date | None = None
    linked_account_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def _trim_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("name cannot be blank")
        return trimmed

    @field_validator("target_amount")
    @classmethod
    def _positive_target(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("target_amount must be > 0")
        return v

    @field_validator("target_date")
    @classmethod
    def _target_date_future(cls, v: date | None) -> date | None:
        if v is not None and v < date.today():
            raise ValueError("target_date must be today or later")
        return v


class GoalUpdate(BaseModel):
    # PATCH — all fields optional; does NOT allow status mutation.
    name: str | None = Field(default=None, min_length=1, max_length=255)
    target_amount: _MoneyField | None = None
    target_date: date | None = None
    linked_account_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("target_amount")
    @classmethod
    def _positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("target_amount must be > 0")
        return v


class GoalReopen(BaseModel):
    new_target_amount: _MoneyField

    @field_validator("new_target_amount")
    @classmethod
    def _positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("new_target_amount must be > 0")
        return v


class ContributionCreate(BaseModel):
    contribution_date: date
    amount: _MoneyField
    note: str | None = Field(default=None, max_length=500)

    @field_validator("amount")
    @classmethod
    def _non_zero(cls, v: Decimal) -> Decimal:
        if v == 0:
            raise ValueError("amount must be non-zero")
        return v


class ContributionResponse(BaseModel):
    id: uuid.UUID
    contribution_date: date
    amount: Decimal
    note: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GoalResponse(BaseModel):
    id: uuid.UUID
    name: str
    target_amount: Decimal
    target_date: date | None
    linked_account: LinkedAccountSummary | None
    status: GoalStatus
    current_amount: Decimal
    progress_pct: int
    required_monthly: Decimal | None
    pace_status: PaceStatus | None
    completed_at: datetime | None
    celebrated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class GoalDetailResponse(GoalResponse):
    contributions: list[ContributionResponse] = []
    notes: str | None = None
