"""add cascade delete to transaction FKs

Revision ID: a1b2c3d4e5f6
Revises: 351e1dac0bc1
Create Date: 2026-03-18 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '351e1dac0bc1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop existing FK constraints and recreate with ON DELETE CASCADE
    op.drop_constraint(
        'transactions_user_id_fkey', 'transactions', type_='foreignkey'
    )
    op.create_foreign_key(
        'transactions_user_id_fkey', 'transactions', 'users',
        ['user_id'], ['id'], ondelete='CASCADE',
    )

    op.drop_constraint(
        'transactions_account_id_fkey', 'transactions', type_='foreignkey'
    )
    op.create_foreign_key(
        'transactions_account_id_fkey', 'transactions', 'accounts',
        ['account_id'], ['id'], ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint(
        'transactions_user_id_fkey', 'transactions', type_='foreignkey'
    )
    op.create_foreign_key(
        'transactions_user_id_fkey', 'transactions', 'users',
        ['user_id'], ['id'],
    )

    op.drop_constraint(
        'transactions_account_id_fkey', 'transactions', type_='foreignkey'
    )
    op.create_foreign_key(
        'transactions_account_id_fkey', 'transactions', 'accounts',
        ['account_id'], ['id'],
    )
