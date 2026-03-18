import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CategoryCreateRequest(BaseModel):
    name: str
    icon: str = "tag"
    color: str = "#6B7280"
    parent_id: Optional[uuid.UUID] = None


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    icon: str
    color: str
    parent_id: Optional[uuid.UUID]
    is_system: bool
    plaid_category: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
