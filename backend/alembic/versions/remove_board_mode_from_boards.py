"""remove_board_mode_from_boards

Revision ID: remove_board_mode
Revises: 70dce768229c
Create Date: 2026-02-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'remove_board_mode'
down_revision: Union[str, Sequence[str], None] = '70dce768229c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Usuń kolumnę board_mode z tabeli boards
    op.drop_column('boards', 'board_mode')


def downgrade() -> None:
    """Downgrade schema."""
    # Dodaj kolumnę board_mode do tabeli boards (jeśli trzeba wycofać)
    op.add_column('boards', sa.Column('board_mode', sa.String(20), nullable=False, server_default='math'))
