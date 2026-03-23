import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AccountCreateRequest(BaseModel):
    institution_name: str
    name: str
    type: str = Field(pattern="^(checking|savings|credit|loan|investment)$")
    balance: str = "0"
    currency: str = "USD"
    mask: str | None = None


class AccountUpdateRequest(BaseModel):
    name: str | None = None
    balance: str | None = None
    institution_name: str | None = None


class AccountResponse(BaseModel):
    id: uuid.UUID
    institution_name: str
    name: str
    type: str
    balance: str
    currency: str
    mask: str | None
    is_manual: bool
    plaid_item_id: uuid.UUID | None
    last_synced_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountBalanceResponse(BaseModel):
    account_id: uuid.UUID
    balance: str
    currency: str
    last_updated: datetime
