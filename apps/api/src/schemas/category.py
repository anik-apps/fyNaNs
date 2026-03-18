import uuid
from datetime import datetime

from pydantic import BaseModel


class CategoryCreateRequest(BaseModel):
    name: str
    icon: str = "tag"
    color: str = "#6B7280"
    parent_id: uuid.UUID | None = None


class CategoryUpdateRequest(BaseModel):
    name: str | None = None
    icon: str | None = None
    color: str | None = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    icon: str
    color: str
    parent_id: uuid.UUID | None
    is_system: bool
    plaid_category: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
