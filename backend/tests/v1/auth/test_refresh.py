"""
Testy odświeżania sesji
POST /api/v1/auth/refresh
"""
import pytest
from datetime import datetime, timedelta

from api.v1.auth.service import AuthService
from api.v1.auth.schemas import LoginData
from api.v1.auth.utils import generate_refresh_token, hash_refresh_token
from core.exceptions import AuthenticationError
from core.models import RefreshToken


class TestRefreshSuccess:

    @pytest.mark.asyncio
    async def test_refresh_returns_new_access_token(self, db_session, test_user):
        """Refresh zwraca nowy access token"""
        _, refresh_token = await AuthService(db_session).login_user(
            LoginData(login=test_user.username, password="testpassword")
        )

        result, new_refresh_token = await AuthService(db_session).refresh_session(refresh_token)

        assert result.access_token
        assert len(result.access_token.split(".")) == 3

    @pytest.mark.asyncio
    async def test_refresh_rotates_token(self, db_session, test_user):
        """Refresh zwraca nowy refresh token (rotacja)"""
        _, refresh_token = await AuthService(db_session).login_user(
            LoginData(login=test_user.username, password="testpassword")
        )

        _, new_refresh_token = await AuthService(db_session).refresh_session(refresh_token)

        assert new_refresh_token != refresh_token
        assert len(new_refresh_token) == 64

    @pytest.mark.asyncio
    async def test_old_refresh_token_revoked_after_use(self, db_session, test_user):
        """Po użyciu stary refresh token jest unieważniony"""
        _, refresh_token = await AuthService(db_session).login_user(
            LoginData(login=test_user.username, password="testpassword")
        )

        await AuthService(db_session).refresh_session(refresh_token)

        token_hash = hash_refresh_token(refresh_token)
        db_token = db_session.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash
        ).first()

        assert db_token.revoked is True

    @pytest.mark.asyncio
    async def test_new_refresh_token_saved_to_db(self, db_session, test_user):
        """Nowy refresh token jest zapisany w bazie"""
        _, refresh_token = await AuthService(db_session).login_user(
            LoginData(login=test_user.username, password="testpassword")
        )

        _, new_refresh_token = await AuthService(db_session).refresh_session(refresh_token)

        new_hash = hash_refresh_token(new_refresh_token)
        db_token = db_session.query(RefreshToken).filter(
            RefreshToken.token_hash == new_hash,
            RefreshToken.revoked == False,
        ).first()

        assert db_token is not None
        assert db_token.user_id == test_user.id


class TestRefreshErrors:

    @pytest.mark.asyncio
    async def test_invalid_token_raises_error(self, db_session):
        """Nieistniejący token → AuthenticationError"""
        with pytest.raises(AuthenticationError):
            await AuthService(db_session).refresh_session("nieistniejacytokenxyz")

    @pytest.mark.asyncio
    async def test_revoked_token_raises_error(self, db_session, test_user):
        """Już użyty (revoked) token → AuthenticationError"""
        _, refresh_token = await AuthService(db_session).login_user(
            LoginData(login=test_user.username, password="testpassword")
        )

        # Użyj raz
        await AuthService(db_session).refresh_session(refresh_token)

        # Próba ponownego użycia
        with pytest.raises(AuthenticationError):
            await AuthService(db_session).refresh_session(refresh_token)

    @pytest.mark.asyncio
    async def test_expired_token_raises_error(self, db_session, test_user):
        """Wygasły refresh token → AuthenticationError"""
        plain_token = generate_refresh_token()
        token_hash = hash_refresh_token(plain_token)

        expired = RefreshToken(
            user_id=test_user.id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() - timedelta(days=1),
            revoked=False,
        )
        db_session.add(expired)
        db_session.commit()

        with pytest.raises(AuthenticationError) as exc:
            await AuthService(db_session).refresh_session(plain_token)

        assert "wygasł" in exc.value.message.lower()
