"""
Ograniczenia tabeli user_identities (core/models.py): jeden subject = jedno konto,
jedno konto = jedna tożsamość na providera, kaskada przy usunięciu użytkownika.
"""
import pytest
from sqlalchemy.exc import IntegrityError

from core.models import UserIdentity


def make_identity(user_id: int, *, provider: str = "google", subject: str = "sub-1") -> UserIdentity:
    return UserIdentity(
        user_id=user_id, provider=provider, provider_user_id=subject,
        email="x@example.com", email_verified=True,
    )


class TestUserIdentityConstraints:

    def test_same_subject_cannot_belong_to_two_users(self, db_session, test_user, test_user2):
        db_session.add(make_identity(test_user.id))
        db_session.commit()

        db_session.add(make_identity(test_user2.id))
        with pytest.raises(IntegrityError):
            db_session.commit()
        db_session.rollback()

    def test_user_cannot_have_two_identities_of_one_provider(self, db_session, test_user):
        db_session.add(make_identity(test_user.id, subject="sub-1"))
        db_session.commit()

        db_session.add(make_identity(test_user.id, subject="sub-2"))
        with pytest.raises(IntegrityError):
            db_session.commit()
        db_session.rollback()

    def test_same_subject_allowed_for_different_providers(self, db_session, test_user, test_user2):
        db_session.add(make_identity(test_user.id, provider="google", subject="same"))
        db_session.add(make_identity(test_user2.id, provider="microsoft", subject="same"))
        db_session.commit()

        assert db_session.query(UserIdentity).count() == 2

    def test_deleting_user_deletes_identities(self, db_session, test_user):
        db_session.add(make_identity(test_user.id))
        db_session.commit()

        db_session.delete(test_user)
        db_session.commit()

        assert db_session.query(UserIdentity).count() == 0