"""
Reguły łączenia tożsamości z kontami (api/v1/auth/oauth/linking.py), niezależnie od providera.
"""
import pytest
from sqlalchemy.exc import IntegrityError, OperationalError

from api.v1.auth.oauth import linking
from api.v1.auth.oauth.base import ProviderIdentity
from api.v1.auth.oauth.linking import resolve_user
from core.exceptions import AppException, AuthenticationError
from core.models import User, UserIdentity, Workspace


def make_identity(**overrides) -> ProviderIdentity:
    data = dict(
        provider="google", subject="sub-1", email="new@example.com",
        email_verified=True, name="New User", picture_url="https://lh3.googleusercontent.com/a/x",
    )
    return ProviderIdentity(**{**data, **overrides})


class TestNewAccount:

    def test_creates_user_identity_and_workspace(self, db_session):
        result = resolve_user(db_session, make_identity())

        assert result.created is True
        user = result.user
        assert user.email == "new@example.com"
        assert user.full_name == "New User"
        assert user.is_active is True
        assert user.hashed_password is None
        assert user.terms_accepted_at is None
        assert [(i.provider, i.provider_user_id) for i in user.identities] == [("google", "sub-1")]
        assert db_session.query(Workspace).filter(Workspace.created_by == user.id).first() is not None

    def test_provider_without_name_leaves_full_name_empty(self, db_session):
        result = resolve_user(db_session, make_identity(name=None))

        assert result.user.full_name is None

    def test_unverified_email_creates_nothing(self, db_session):
        with pytest.raises(AuthenticationError):
            resolve_user(db_session, make_identity(email_verified=False))

        assert db_session.query(User).count() == 0
        assert db_session.query(UserIdentity).count() == 0


class TestExistingIdentity:

    def test_login_refreshes_metadata_and_keeps_avatar(self, db_session, test_user):
        test_user.avatar_url = "https://example.com/own-avatar.webp"
        db_session.add(UserIdentity(
            user_id=test_user.id, provider="google", provider_user_id="sub-1",
            email=test_user.email, email_verified=True,
        ))
        db_session.commit()

        result = resolve_user(db_session, make_identity(email=test_user.email, picture_url="https://lh3.googleusercontent.com/a/new"))

        assert result.created is False
        assert result.user.id == test_user.id
        identity = db_session.query(UserIdentity).one()
        assert identity.picture_url == "https://lh3.googleusercontent.com/a/new"
        assert identity.last_login_at is not None
        db_session.refresh(test_user)
        assert test_user.avatar_url == "https://example.com/own-avatar.webp"


class TestLinkingExistingAccount:

    def test_unverified_email_does_not_link(self, db_session, test_user):
        with pytest.raises(AuthenticationError):
            resolve_user(db_session, make_identity(email=test_user.email, email_verified=False))

        assert db_session.query(UserIdentity).count() == 0

    def test_link_keeps_avatar_and_terms_untouched(self, db_session, test_user):
        test_user.avatar_url = "https://example.com/own-avatar.webp"
        db_session.commit()

        result = resolve_user(db_session, make_identity(email=test_user.email))

        assert result.created is False
        db_session.refresh(test_user)
        assert test_user.avatar_url == "https://example.com/own-avatar.webp"
        assert test_user.terms_accepted_at is None


class TestErrorHandling:

    def test_retries_once_after_concurrent_signup(self, db_session, monkeypatch):
        real_resolve = linking._resolve
        calls = {"n": 0}

        def flaky(db, identity):
            calls["n"] += 1
            if calls["n"] == 1:
                raise IntegrityError("INSERT", {}, Exception("duplicate"))
            return real_resolve(db, identity)

        monkeypatch.setattr(linking, "_resolve", flaky)

        result = resolve_user(db_session, make_identity())

        assert result.created is True
        assert calls["n"] == 2

    def test_database_outage_maps_to_503(self, db_session, monkeypatch):
        def broken(db, identity):
            raise OperationalError("SELECT", {}, Exception("db down"))

        monkeypatch.setattr(linking, "_resolve", broken)

        with pytest.raises(AppException) as exc:
            resolve_user(db_session, make_identity())

        assert exc.value.status_code == 503
        assert exc.value.code == "DB_ERROR"

    def test_unexpected_error_maps_to_500(self, db_session, monkeypatch):
        def broken(db, identity):
            raise RuntimeError("boom")

        monkeypatch.setattr(linking, "_resolve", broken)

        with pytest.raises(AppException) as exc:
            resolve_user(db_session, make_identity())

        assert exc.value.status_code == 500