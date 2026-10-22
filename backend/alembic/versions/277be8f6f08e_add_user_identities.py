"""add user_identities

Revision ID: 277be8f6f08e
Revises: c4a9e1f27b3d
Create Date: 2026-10-19 20:20:40.932435

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '277be8f6f08e'
down_revision: Union[str, Sequence[str], None] = 'c4a9e1f27b3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_identities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("provider_user_id", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("email_verified", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("picture_url", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_user_id", name="uq_user_identities_provider_subject"),
        sa.UniqueConstraint("user_id", "provider", name="uq_user_identities_user_provider"),
    )
    # Konta z Google logowały się tylko ze zweryfikowanym e-mailem, stąd email_verified = true.
    op.execute(
        """
        INSERT INTO user_identities
            (user_id, provider, provider_user_id, email, email_verified, picture_url, created_at)
        SELECT id, 'google', google_id, email, true, profile_picture,
               COALESCE(created_at, NOW() AT TIME ZONE 'UTC')
        FROM users
        WHERE google_id IS NOT NULL
        """
    )


def downgrade() -> None:
    # Konta Google założone po wdrożeniu nie mają google_id: odtwarzamy je z tożsamości.
    op.execute(
        """
        UPDATE users
        SET google_id = i.provider_user_id, auth_provider = 'google', profile_picture = i.picture_url
        FROM user_identities i
        WHERE i.user_id = users.id AND i.provider = 'google' AND users.google_id IS NULL
        """
    )
    op.drop_table("user_identities")
