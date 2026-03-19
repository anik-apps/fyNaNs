import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class BillCreateRequest(BaseModel):
    name: str
    amount: str
    frequency: str = Field(pattern="^(weekly|monthly|yearly)$")
    day_of_week: int | None = Field(None, ge=0, le=6)
    day_of_month: int | None = Field(None, ge=1, le=31)
    month_of_year: int | None = Field(None, ge=1, le=12)
    category_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    next_due_date: date
    reminder_days: int = 3
    is_auto_pay: bool = False


class BillUpdateRequest(BaseModel):
    name: str | None = None
    amount: str | None = None
    frequency: str | None = None
    day_of_week: int | None = None
    day_of_month: int | None = None
    month_of_year: int | None = None
    category_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    next_due_date: date | None = None
    reminder_days: int | None = None
    is_auto_pay: bool | None = None
    is_active: bool | None = None


class BillResponse(BaseModel):
    id: uuid.UUID
    name: str
    amount: str
    frequency: str
    day_of_week: int | None
    day_of_month: int | None
    month_of_year: int | None
    category_id: uuid.UUID | None
    account_id: uuid.UUID | None
    next_due_date: date
    reminder_days: int
    is_auto_pay: bool
    is_active: bool
    source: str
    min_payment: str | None
    statement_balance: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
