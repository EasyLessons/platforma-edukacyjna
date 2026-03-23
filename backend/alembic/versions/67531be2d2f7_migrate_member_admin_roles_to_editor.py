"""migrate_member_admin_roles_to_editor

Revision ID: 67531be2d2f7
Revises: 0cf1f201a1cc
Create Date: 2026-03-23 08:56:22.907529

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '67531be2d2f7'
down_revision: Union[str, Sequence[str], None] = '0cf1f201a1cc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f('ix_notifications_user_unread'), table_name='notifications', postgresql_where='(is_read = false)')
    
    op.execute("UPDATE workspace_members SET role = 'editor' WHERE role = 'member'")
    op.execute("UPDATE workspace_members SET role = 'editor' WHERE role = 'admin'")


def downgrade() -> None:
    op.create_index(op.f('ix_notifications_user_unread'), 'notifications', ['user_id'], unique=False, postgresql_where='(is_read = false)')
