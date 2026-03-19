import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel


class Bill(BaseModel):
    __tablename__ = "bills"
    __table_args__ = (
        Index("ix_bills_user_next_due", "user_id", "next_due_date"),
        Index("ix_bills_user_active", "user_id", "is_active"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    frequency: Mapped[str] = mapped_column(String(20), nullable=False)
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    day_of_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_of_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True
    )
    next_due_date: Mapped[date] = mapped_column(Date, nullable=False)
    reminder_days: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    is_auto_pay: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    plaid_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    min_payment: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    statement_balance: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    auto_update: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    category = relationship("Category")
    account = relationship("Account")
