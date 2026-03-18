import uuid
from datetime import date as date_type
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TransactionCreateRequest(BaseModel):
    account_id: uuid.UUID
    amount: str
    date: date_type
    description: str
    merchant_name: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None


class TransactionUpdateRequest(BaseModel):
    description: Optional[str] = None
    merchant_name: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    amount: Optional[str] = None
    date: Optional[date_type] = None


class TransactionResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    amount: str
    date: date_type
    description: str
    merchant_name: Optional[str]
    category_id: Optional[uuid.UUID]
    is_pending: bool
    is_manual: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    next_cursor: Optional[str] = None


class TransactionSummaryItem(BaseModel):
    category_id: Optional[uuid.UUID]
    category_name: Optional[str]
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
