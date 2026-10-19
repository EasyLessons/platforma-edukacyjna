"""board_files (rejestr plikow tablic, limit miejsca na konto)

Revision ID: e5b2d8a47c10
Revises: c4a9e1f27b3d
Create Date: 2026-10-19 12:00:00.000000

Bez backfillu: pliki wgrane przed ta migracja dopisze job sprzatajacy, gdy porowna
zawartosc bucketu `board-files` z rejestrem. Do tego czasu nie licza sie do limitu.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5b2d8a47c10'
down_revision: Union[str, Sequence[str], None] = 'c4a9e1f27b3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'board_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('board_id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('file_name', sa.String(length=64), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('board_id', 'file_name', name='uq_board_files_board_file'),
    )
    op.create_index('ix_board_files_board_id', 'board_files', ['board_id'])
    op.create_index('ix_board_files_owner_id', 'board_files', ['owner_id'])
    op.create_index('ix_board_files_deleted_at', 'board_files', ['deleted_at'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_board_files_deleted_at', table_name='board_files')
    op.drop_index('ix_board_files_owner_id', table_name='board_files')
    op.drop_index('ix_board_files_board_id', table_name='board_files')
    op.drop_table('board_files')
