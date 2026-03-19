import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: uuid.UUID
    type: str
    reference_id: uuid.UUID
    period_key: str
    channel: str
    sent_at: datetime
    read_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int
    next_cursor: str | None = None


class DeviceTokenCreateRequest(BaseModel):
    token: str
    platform: str  # ios, android


class DeviceTokenResponse(BaseModel):
    id: uuid.UUID
    token: str
    platform: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
