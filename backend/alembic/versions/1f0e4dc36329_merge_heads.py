"""merge_heads

Revision ID: 1f0e4dc36329
Revises: 8cb110d44501, b4e7a9c3f2d1
Create Date: 2026-02-15 09:50:18.126938

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1f0e4dc36329'
down_revision: Union[str, Sequence[str], None] = ('8cb110d44501', 'b4e7a9c3f2d1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
