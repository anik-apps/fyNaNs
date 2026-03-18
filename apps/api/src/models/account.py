import uuid
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel


class Account(BaseModel):
    __tablename__ = "accounts"
    __table_args__ = (
        Index(
            "ix_accounts_plaid_account_id",
            "plaid_account_id",
            unique=True,
            postgresql_where="plaid_account_id IS NOT NULL",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    plaid_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plaid_items.id"), nullable=True
    )
    plaid_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    institution_name: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    mask: Mapped[str | None] = mapped_column(String(4), nullable=True)
    is_manual: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    plaid_item = relationship("PlaidItem", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")
