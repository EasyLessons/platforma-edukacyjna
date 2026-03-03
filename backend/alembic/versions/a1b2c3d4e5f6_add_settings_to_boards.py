"""add_settings_to_boards

Revision ID: a1b2c3d4e5f6
Revises: 1f0e4dc36329
Create Date: 2026-03-03

Dodanie kolumny settings (JSONB) do tabeli boards.
Przechowuje ustawienia tablicy zarządzane przez właściciela:
  - ai_enabled: bool
  - grid_visible: bool
  - smartsearch_visible: bool
  - toolbar_visible: bool
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'remove_board_mode'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('boards', sa.Column('settings', JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('boards', 'settings')
