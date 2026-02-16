"""add_board_mode_to_boards

Revision ID: 70dce768229c
Revises: 1f0e4dc36329
Create Date: 2026-02-15 23:48:52.338982

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '70dce768229c'
down_revision: Union[str, Sequence[str], None] = '1f0e4dc36329'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Dodaj kolumnę board_mode do tabeli boards
    op.add_column('boards', sa.Column('board_mode', sa.String(20), nullable=False, server_default='math'))


def downgrade() -> None:
    """Downgrade schema."""
    # Usuń kolumnę board_mode z tabeli boards
    op.drop_column('boards', 'board_mode')
