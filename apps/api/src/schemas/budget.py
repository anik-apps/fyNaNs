import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class BudgetCreateRequest(BaseModel):
    category_id: uuid.UUID
    amount_limit: str
    period: str = Field(default="monthly", pattern="^(monthly|weekly|yearly)$")


class BudgetUpdateRequest(BaseModel):
    amount_limit: str | None = None
    period: str | None = None


class BudgetResponse(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    category_name: str | None = None
    amount_limit: str
    period: str
    current_spend: str = "0.00"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BudgetOverviewItem(BaseModel):
    id: uuid.UUID
    category_id: uuid.UUID
    category_name: str | None = None
    category_color: str | None = None
    amount_limit: str
    period: str
    current_spend: str
    percent_spent: float
