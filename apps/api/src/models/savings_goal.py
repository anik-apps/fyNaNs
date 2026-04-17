import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import BaseModel


class SavingsGoal(BaseModel):
    __tablename__ = "savings_goals"
    __table_args__ = (
        Index(
            "uq_goal_active_account",
            "linked_account_id",
            unique=True,
            postgresql_where="linked_account_id IS NOT NULL AND status = 'active'",
        ),
        Index("ix_savings_goals_user_status", "user_id", "status"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    linked_account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    celebrated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # lazy="selectin" is required — async lazy-load of this relationship
    # outside of an explicit eager-load path raises MissingGreenlet.
    linked_account = relationship(
        "Account", foreign_keys=[linked_account_id], lazy="selectin"
    )
    contributions = relationship(
        "SavingsGoalContribution",
        back_populates="goal",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class SavingsGoalContribution(BaseModel):
    __tablename__ = "savings_goal_contributions"
    __table_args__ = (
        Index(
            "ix_savings_goal_contribs_goal_date",
            "goal_id",
            "contribution_date",
        ),
    )

    goal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("savings_goals.id", ondelete="CASCADE"),
        nullable=False,
    )
    contribution_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    goal = relationship("SavingsGoal", back_populates="contributions")
