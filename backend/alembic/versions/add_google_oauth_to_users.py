"""Add Google OAuth fields to users

Revision ID: b4e7a9c3f2d1
Revises: 7db6d9ac37e6
Create Date: 2026-02-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4e7a9c3f2d1'
down_revision: Union[str, Sequence[str], None] = '7db6d9ac37e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add Google OAuth fields."""
    # Dodaj nowe kolumny
    op.add_column('users', sa.Column('google_id', sa.String(), nullable=True))
    op.add_column('users', sa.Column('auth_provider', sa.String(length=20), nullable=False, server_default='email'))
    op.add_column('users', sa.Column('profile_picture', sa.String(), nullable=True))
    
    # Zmień hashed_password na nullable
    op.alter_column('users', 'hashed_password',
                    existing_type=sa.String(),
                    nullable=True)
    
    # Dodaj indeks i unique constraint na google_id
    op.create_index(op.f('ix_users_google_id'), 'users', ['google_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema - remove Google OAuth fields."""
    # Usuń indeks
    op.drop_index(op.f('ix_users_google_id'), table_name='users')
    
    # Przywróć hashed_password jako nullable=False (tylko jeśli wszystkie rekordy mają hasło)
    op.alter_column('users', 'hashed_password',
                    existing_type=sa.String(),
                    nullable=False)
    
    # Usuń kolumny
    op.drop_column('users', 'profile_picture')
    op.drop_column('users', 'auth_provider')
    op.drop_column('users', 'google_id')
