"""add board_elements table

Revision ID: de74c1c104a3
Revises: 8647bf7f8acd
Create Date: 2025-11-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'de74c1c104a3'
down_revision: Union[str, Sequence[str], None] = '8647bf7f8acd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Tworzenie tabeli board_elements
    op.create_table(
        'board_elements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('board_id', sa.Integer(), nullable=False),
        sa.Column('element_id', sa.String(length=36), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['board_id'], ['boards.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Indeksy dla wydajności
    op.create_index(op.f('ix_board_elements_board_id'), 'board_elements', ['board_id'], unique=False)
    op.create_index(op.f('ix_board_elements_element_id'), 'board_elements', ['element_id'], unique=False)
    op.create_index(op.f('ix_board_elements_created_at'), 'board_elements', ['created_at'], unique=False)
    op.create_index(op.f('ix_board_elements_is_deleted'), 'board_elements', ['is_deleted'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_board_elements_is_deleted'), table_name='board_elements')
    op.drop_index(op.f('ix_board_elements_created_at'), table_name='board_elements')
    op.drop_index(op.f('ix_board_elements_element_id'), table_name='board_elements')
    op.drop_index(op.f('ix_board_elements_board_id'), table_name='board_elements')
    op.drop_table('board_elements')
