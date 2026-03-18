import uuid
from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel


class TransactionCreateRequest(BaseModel):
    account_id: uuid.UUID
    amount: str
    date: date_type
    description: str
    merchant_name: str | None = None
    category_id: uuid.UUID | None = None
    notes: str | None = None


class TransactionUpdateRequest(BaseModel):
    description: str | None = None
    merchant_name: str | None = None
    category_id: uuid.UUID | None = None
    notes: str | None = None


class TransactionResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    amount: str
    date: date_type
    description: str
    merchant_name: str | None
    category_id: uuid.UUID | None
    is_pending: bool
    is_manual: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    next_cursor: str | None = None


class TransactionSummaryItem(BaseModel):
    category_id: uuid.UUID | None
    category_name: str | None
    total: str
    count: int


class TransactionSummaryResponse(BaseModel):
    period_start: date_type
    period_end: date_type
    items: list[TransactionSummaryItem]
    total_spending: str
    total_income: str


class ImportResponse(BaseModel):
    imported: int
    skipped_duplicates: int
    errors: list[dict]
