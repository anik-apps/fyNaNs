import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel


class PlaidItem(BaseModel):
    __tablename__ = "plaid_items"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    access_token: Mapped[str] = mapped_column(String(500), nullable=False)
    item_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    institution_name: Mapped[str] = mapped_column(String(255), nullable=False)
    cursor: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    environment: Mapped[str] = mapped_column(String(20), default="production", server_default="production")
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user = relationship("User", backref="plaid_items")
    accounts = relationship("Account", back_populates="plaid_item", cascade="save-update, merge")
