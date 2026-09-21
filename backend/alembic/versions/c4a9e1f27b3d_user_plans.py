"""user_plans (plany free/premium)

Revision ID: c4a9e1f27b3d
Revises: 0059c60824f3
Create Date: 2026-09-22 12:00:00.000000

Osobna tabela zamiast kolumny w `users` — `core/models.py` jest w strefie
równoległej pracy nad Yjs; brak wiersza == plan "free", więc migracja nie
wymaga backfillu istniejących użytkowników.

Nadanie premium ręcznie (bez UI):
    INSERT INTO user_plans (user_id, plan, updated_at)
    VALUES (<id>, 'premium', NOW())
    ON CONFLICT (user_id) DO UPDATE SET plan = 'premium', updated_at = NOW();
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4a9e1f27b3d'
down_revision: Union[str, Sequence[str], None] = '0059c60824f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'user_plans',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('plan', sa.String(length=20), server_default='free', nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint("plan IN ('free', 'premium')", name='ck_user_plans_plan'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('user_plans')
