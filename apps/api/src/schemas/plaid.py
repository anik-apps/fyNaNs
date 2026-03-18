import uuid
from datetime import datetime

from pydantic import BaseModel


class LinkTokenResponse(BaseModel):
    link_token: str
    expiration: str


class ExchangeTokenRequest(BaseModel):
    public_token: str
    institution_id: str
    institution_name: str


class ExchangeTokenResponse(BaseModel):
    plaid_item_id: uuid.UUID
    institution_name: str
    accounts_linked: int


class PlaidItemResponse(BaseModel):
    id: uuid.UUID
    institution_name: str
    status: str
    last_synced_at: datetime | None
    account_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
