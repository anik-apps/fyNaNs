"""add CASCADE ondelete to budgets, bills, notifications, device_tokens user FKs

Revision ID: b3c4d5e6f7a8
Revises: ff7cd81d0509
Create Date: 2026-03-18 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'ff7cd81d0509'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table_name, constraint_name, column, referent_table, referent_column)
_FK_SPECS = [
    ("budgets", "budgets_user_id_fkey", "user_id", "users", "id"),
    ("bills", "bills_user_id_fkey", "user_id", "users", "id"),
    ("notifications", "notifications_user_id_fkey", "user_id", "users", "id"),
    ("device_tokens", "device_tokens_user_id_fkey", "user_id", "users", "id"),
]


def upgrade() -> None:
    for table, constraint, col, ref_table, ref_col in _FK_SPECS:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint, table, ref_table, [col], [ref_col], ondelete="CASCADE"
        )


def downgrade() -> None:
    for table, constraint, col, ref_table, ref_col in _FK_SPECS:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint, table, ref_table, [col], [ref_col]
        )
