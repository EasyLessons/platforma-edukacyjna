"""drop legacy google columns from users

Revision ID: da956c2af27b
Revises: 277be8f6f08e
Create Date: 2026-10-22 19:28:24.432717

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da956c2af27b'
down_revision: Union[str, Sequence[str], None] = '277be8f6f08e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotentny backfill: konta Google bez tożsamości.
    op.execute(
        """
        INSERT INTO user_identities
            (user_id, provider, provider_user_id, email, email_verified, picture_url, created_at)
        SELECT u.id, 'google', u.google_id, u.email, true, u.profile_picture,
               COALESCE(u.created_at, NOW() AT TIME ZONE 'UTC')
        FROM users u
        WHERE u.google_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM user_identities i WHERE i.user_id = u.id AND i.provider = 'google'
          )
        ON CONFLICT DO NOTHING
        """
    )
    # Bezpiecznik: nie usuwamy kolumn, dopóki któryś google_id nie ma tożsamości TEGO SAMEGO
    # użytkownika (np. ten sam sub połączył już inne konto po e-mailu). Takie przypadki
    # trzeba rozstrzygnąć ręcznie.
    missing = op.get_bind().execute(
        sa.text(
            """
            SELECT count(*) FROM users u
            WHERE u.google_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM user_identities i WHERE i.user_id = u.id AND i.provider = 'google'
              )
            """
        )
    ).scalar()
    if missing:
        raise RuntimeError(
            f"{missing} users have google_id without their own user_identities row; "
            "resolve them manually before dropping the legacy columns"
        )
    # Usunięcie kolumny google_id kasuje też jej unikalny indeks (ix_users_google_id).
    op.drop_column("users", "profile_picture")
    op.drop_column("users", "auth_provider")
    op.drop_column("users", "google_id")


def downgrade() -> None:
    op.add_column("users", sa.Column("google_id", sa.String(), nullable=True))
    op.add_column(
        "users",
        sa.Column("auth_provider", sa.String(length=20), server_default="email", nullable=False),
    )
    op.add_column("users", sa.Column("profile_picture", sa.String(), nullable=True))
    op.execute(
        """
        UPDATE users
        SET google_id = i.provider_user_id, auth_provider = 'google', profile_picture = i.picture_url
        FROM user_identities i
        WHERE i.user_id = users.id AND i.provider = 'google'
        """
    )
    op.create_index(op.f("ix_users_google_id"), "users", ["google_id"], unique=True)
