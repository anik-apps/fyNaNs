"""add savings_goals

Revision ID: 2ceca98f0ddb
Revises: cd3a428d235e
Create Date: 2026-04-16 23:25:42.727618

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '2ceca98f0ddb'
down_revision: str | None = 'cd3a428d235e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column(
            "notify_savings_goals",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
    )

    op.create_table(
        "savings_goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("target_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column(
            "linked_account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="active"
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("celebrated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "uq_goal_active_account",
        "savings_goals",
        ["linked_account_id"],
        unique=True,
        postgresql_where=sa.text(
            "linked_account_id IS NOT NULL AND status = 'active'"
        ),
    )
    op.create_index(
        "ix_savings_goals_user_status",
        "savings_goals",
        ["user_id", "status"],
    )

    op.create_table(
        "savings_goal_contributions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "goal_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("savings_goals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("contribution_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_savings_goal_contribs_goal_date",
        "savings_goal_contributions",
        ["goal_id", "contribution_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_savings_goal_contribs_goal_date", table_name="savings_goal_contributions")
    op.drop_table("savings_goal_contributions")
    op.drop_index("ix_savings_goals_user_status", table_name="savings_goals")
    op.drop_index("uq_goal_active_account", table_name="savings_goals")
    op.drop_table("savings_goals")
    op.drop_column("user_settings", "notify_savings_goals")
