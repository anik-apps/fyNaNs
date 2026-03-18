import uuid
from typing import Literal

from pydantic import BaseModel


class ProfileResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar_url: str | None
    has_mfa: bool

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    avatar_url: str | None = None


class SettingsResponse(BaseModel):
    theme: str
    notify_bill_reminders: bool
    notify_budget_alerts: bool
    notify_email: bool
    notify_push: bool

    model_config = {"from_attributes": True}


class SettingsUpdateRequest(BaseModel):
    theme: Literal["light", "dark", "system"] | None = None
    notify_bill_reminders: bool | None = None
    notify_budget_alerts: bool | None = None
    notify_email: bool | None = None
    notify_push: bool | None = None
