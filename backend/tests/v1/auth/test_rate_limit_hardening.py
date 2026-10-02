"""
Testy odporności rate limitu na złe body (SEC-21), limitów per IP na /refresh i /logout
oraz logowania hasłem na konto Google bez hasła (SEC-25).
"""
import secrets
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import ResponseError as RedisResponseError
from redis.exceptions import TimeoutError as RedisTimeoutError

import core.rate_limit as rl
from api.v1.auth.schemas import (
    LoginData,
    RequestPasswordReset,
    ResetPassword,
    VerifyEmail,
    VerifyPasswordResetCode,
)
from api.v1.auth.service import MAX_CODE_ATTEMPTS, AuthService
from core.database import get_db
from core.exceptions import AppException, AuthenticationError, ValidationError
from core.models import User
from core.rate_limit import normalize_identifier, rate_limit
from main import app

# Hasła generowane w runtime — żadnych literałów haseł w repo (skanery sekretów).
ANY_PASSWORD = secrets.token_urlsafe(12)
NEW_PASSWORD = secrets.token_urlsafe(12)


@pytest.fixture(autouse=True)
def use_fake_redis_singleton(monkeypatch, redis_client):
    import core.redis_client as redis_client_module

    monkeypatch.setattr(redis_client_module, "_redis_client", redis_client)


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def google_user(db_session):
    user = User(
        username="googleuser",
        email="google@example.com",
        hashed_password=None,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


class TestBadBody:
    """Złe body ma kończyć się 422 z walidacji, a nie 500 z zależności rate limitu."""

    @pytest.mark.parametrize(
        "content",
        [
            b"{not json",
            b"[]",
            b'["login", "password"]',
            b'"string"',
            b"123",
            b"null",
            b"",
        ],
    )
    def test_login_returns_422(self, client, content):
        r = client.post(
            "/api/v1/auth/login",
            content=content,
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 422
        assert r.json()["code"] == "VALIDATION_ERROR"

    def test_undecodable_body_returns_400(self, client):
        """Body nie-UTF-8: FastAPI samo odpowiada 400 ("error parsing the body") - ważne, że nie 500."""
        r = client.post(
            "/api/v1/auth/login",
            content=b"\xff\xfe\x00",
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 400

    def test_non_scalar_identifier_returns_422(self, client):
        r = client.post("/api/v1/auth/login", json={"login": {"a": 1}, "password": ["x"]})
        assert r.status_code == 422

    def test_bad_body_still_counts_towards_ip_limit(self, client):
        last = None
        for _ in range(11):
            last = client.post(
                "/api/v1/auth/login",
                content=b"[]",
                headers={"Content-Type": "application/json"},
            )
        assert last.status_code == 429


class TestSessionEndpointsLimits:
    def test_refresh_is_limited_per_ip(self, client):
        statuses = [client.post("/api/v1/auth/refresh").status_code for _ in range(301)]
        assert set(statuses[:300]) == {401}  # brak cookie -> 401, ale w limicie
        assert statuses[300] == 429

    def test_logout_is_limited_per_ip(self, client):
        statuses = [client.post("/api/v1/auth/logout").status_code for _ in range(61)]
        assert set(statuses[:60]) == {200}
        assert statuses[60] == 429

    def test_refresh_survives_redis_outage(self, client, monkeypatch):
        """fail_open: awaria Redis nie może blokować odświeżania sesji (401 = brak cookie)."""

        class BrokenRedis:
            async def incr(self, key):
                raise RedisConnectionError("connection refused")

        monkeypatch.setattr(rl, "get_redis_client", lambda: BrokenRedis())
        assert client.post("/api/v1/auth/refresh").status_code == 401

    @pytest.mark.asyncio
    async def test_fail_closed_is_still_the_default(self, monkeypatch):
        from unittest.mock import MagicMock

        from core.exceptions import AppException

        class BrokenRedis:
            async def incr(self, key):
                raise RedisConnectionError("connection refused")

        monkeypatch.setattr(rl, "get_redis_client", lambda: BrokenRedis())
        request = MagicMock()
        request.client.host = "1.1.1.1"
        with pytest.raises(AppException) as exc:
            await rate_limit("scope", limit=1, window_seconds=60)(request)
        assert exc.value.status_code == 503


class TestForwardedForCannotBypassIpLimit:
    """Regresja: na Render zmiana (lewego) wpisu X-Forwarded-For dawała nowy kubełek per żądanie."""

    def test_rotating_xff_still_hits_ip_limit(self, client, monkeypatch, sync_redis_client):
        monkeypatch.setenv("RENDER", "true")
        statuses = [
            client.post(
                "/api/v1/auth/login",
                content=b"[]",
                headers={"Content-Type": "application/json", "X-Forwarded-For": f"10.8.{i}.1, 198.51.100.9"},
            ).status_code
            for i in range(11)
        ]
        assert statuses[:10] == [422] * 10
        assert statuses[10] == 429
        assert sync_redis_client.keys("ratelimit:login:ip:*") == ["ratelimit:login:ip:198.51.100.9"]

    def test_oversized_xff_does_not_create_long_keys(self, client, monkeypatch, sync_redis_client):
        monkeypatch.setenv("RENDER", "true")
        client.post("/api/v1/auth/logout", headers={"X-Forwarded-For": "A" * 30000})
        assert sync_redis_client.keys("ratelimit:logout:ip:*") == ["ratelimit:logout:ip:unknown"]


class TestRedisErrors:
    """Każdy RedisError (nie tylko brak połączenia) ma dać fail-open albo 503, nigdy 500."""

    @pytest.mark.parametrize("error", [RedisResponseError("OOM command not allowed"), RedisTimeoutError("timeout")])
    def test_fail_open_endpoints_survive(self, client, monkeypatch, error):
        class BrokenRedis:
            async def incr(self, key):
                raise error

        monkeypatch.setattr(rl, "get_redis_client", lambda: BrokenRedis())
        assert client.post("/api/v1/auth/refresh").status_code == 401
        assert client.post("/api/v1/auth/logout").status_code == 200

    def test_fail_closed_endpoint_returns_503(self, client, monkeypatch):
        class BrokenRedis:
            async def incr(self, key):
                raise RedisResponseError("READONLY")

        monkeypatch.setattr(rl, "get_redis_client", lambda: BrokenRedis())
        r = client.post("/api/v1/auth/login", json={"login": "a", "password": ANY_PASSWORD})
        assert r.status_code == 503
        assert r.json()["code"] == "REDIS_ERROR"

    def test_redis_client_has_timeouts(self, monkeypatch):
        import core.redis_client as redis_client_module

        monkeypatch.setattr(redis_client_module, "_redis_client", None)
        kwargs = redis_client_module.get_redis_client().connection_pool.connection_kwargs
        assert kwargs["socket_timeout"] == redis_client_module.REDIS_TIMEOUT_SECONDS
        assert kwargs["socket_connect_timeout"] == redis_client_module.REDIS_TIMEOUT_SECONDS


class TestIdentifierNormalization:
    """Warianty zapisu tej samej wartości mają trafiać do jednego kubełka per identyfikator."""

    @pytest.mark.parametrize("variant", [1, 1.0, True, "1", "01", "001", " 1", "1 ", "+1", "1.0", "1e0"])
    def test_user_id_variants(self, variant):
        assert normalize_identifier(variant) == "1"

    @pytest.mark.parametrize(
        "variant", ["Test@Example.com", " test@example.com", "test@example.com   ", "\ttest@example.com\n"]
    )
    def test_email_variants(self, variant):
        assert normalize_identifier(variant) == "test@example.com"

    @pytest.mark.parametrize("value", [None, "", "   ", 1.5, [], {}, ["1"]])
    def test_unusable_values(self, value):
        assert normalize_identifier(value) is None

    def test_long_values_are_truncated(self):
        assert len(normalize_identifier("a" * 5000)) == 256
        assert normalize_identifier("9" * 5000) == "9" * 256

    def test_non_finite_numbers_do_not_crash(self):
        assert normalize_identifier("inf") == "inf"
        assert normalize_identifier("nan") == "nan"
        assert normalize_identifier("1e999") == "1e999"

    def test_email_variants_share_bucket_on_endpoint(self, client, test_user, sync_redis_client):
        """Regresja: 'email' + N spacji dawał N osobnych kubełków (limit 5/10 min)."""
        statuses = []
        for i in range(7):
            r = client.post(
                "/api/v1/auth/reset-password",
                json={
                    "email": test_user.email + " " * i,
                    "code": "000000",
                    "password": NEW_PASSWORD,
                    "password_confirm": NEW_PASSWORD,
                },
            )
            statuses.append(r.status_code)
        assert statuses[5:] == [429, 429]
        keys = sync_redis_client.keys("ratelimit:reset_password:id:*")
        assert keys == [f"ratelimit:reset_password:id:{test_user.email}"]

    def test_user_id_variants_share_bucket_on_endpoint(self, client, unverified_user, sync_redis_client):
        uid = unverified_user.id
        for variant in [uid, float(uid), f"0{uid}", f" {uid}"]:
            client.post("/api/v1/auth/verify-email", json={"user_id": variant, "code": "000000"})
        keys = sync_redis_client.keys("ratelimit:verify_email:id:*")
        assert keys == [f"ratelimit:verify_email:id:{uid}"]


class TestCodeAttemptsLimit:
    """
    Licznik prób per kod (per user.id) w AuthService - niezależny od IP i kształtu body.
    Regresja: 6-cyfrowy kod dało się zgadywać bez ograniczeń, omijając limity z rate_limit.
    """

    @pytest.fixture
    def service(self, db_session, redis_client):
        return AuthService(db_session, redis_client)

    @pytest.fixture
    def reset_user(self, test_user, sync_redis_client):
        sync_redis_client.setex(f"auth:password_reset:{test_user.id}", 900, "123456")
        return test_user

    @staticmethod
    def _reset(email, code):
        return ResetPassword(email=email, code=code, password=NEW_PASSWORD, password_confirm=NEW_PASSWORD)

    @pytest.mark.asyncio
    async def test_verify_email_code_is_burned_after_max_attempts(self, service, unverified_user, redis_client):
        for _ in range(MAX_CODE_ATTEMPTS):
            with pytest.raises(ValidationError):
                await service.verify_email(VerifyEmail(user_id=unverified_user.id, code="000000"))

        # kolejna próba - nawet z POPRAWNYM kodem - jest odrzucana, a kod skasowany
        with pytest.raises(AppException) as exc:
            await service.verify_email(VerifyEmail(user_id=unverified_user.id, code="123456"))
        assert exc.value.status_code == 429
        assert await redis_client.get(f"auth:email_verification:{unverified_user.id}") is None

    @pytest.mark.asyncio
    async def test_reset_password_code_is_burned_after_max_attempts(self, service, reset_user, db_session):
        old_hash = reset_user.hashed_password
        for _ in range(MAX_CODE_ATTEMPTS):
            with pytest.raises(ValidationError):
                await service.reset_password(self._reset(reset_user.email, "000000"))
        with pytest.raises(AppException) as exc:
            await service.reset_password(self._reset(reset_user.email, "123456"))
        assert exc.value.status_code == 429
        db_session.refresh(reset_user)
        assert reset_user.hashed_password == old_hash

    @pytest.mark.asyncio
    async def test_verify_reset_code_shares_the_counter(self, service, reset_user):
        """verify-reset-code nie może być osobną wyrocznią z własną pulą prób."""
        for _ in range(MAX_CODE_ATTEMPTS):
            with pytest.raises(ValidationError):
                await service.verify_reset_code(VerifyPasswordResetCode(email=reset_user.email, code="000000"))
        with pytest.raises(AppException) as exc:
            await service.reset_password(self._reset(reset_user.email, "123456"))
        assert exc.value.status_code == 429

    @pytest.mark.asyncio
    async def test_new_code_does_not_reset_the_counter(self, service, reset_user, redis_client):
        for _ in range(MAX_CODE_ATTEMPTS):
            with pytest.raises(ValidationError):
                await service.reset_password(self._reset(reset_user.email, "000000"))
        await service.request_password_reset(RequestPasswordReset(email=reset_user.email))
        new_code = await redis_client.get(f"auth:password_reset:{reset_user.id}")
        assert new_code is not None
        with pytest.raises(AppException) as exc:
            await service.reset_password(self._reset(reset_user.email, new_code))
        assert exc.value.status_code == 429

    @pytest.mark.asyncio
    async def test_counter_expires_with_the_code_window(self, service, reset_user, redis_client):
        with pytest.raises(ValidationError):
            await service.reset_password(self._reset(reset_user.email, "000000"))
        ttl = await redis_client.ttl(f"auth:password_reset:{reset_user.id}:attempts")
        assert 0 < ttl <= 900

    @pytest.mark.asyncio
    async def test_normal_flow_with_typos_still_works(self, service, reset_user, redis_client):
        for _ in range(MAX_CODE_ATTEMPTS - 2):
            with pytest.raises(ValidationError):
                await service.verify_reset_code(VerifyPasswordResetCode(email=reset_user.email, code="000000"))
        result = await service.verify_reset_code(VerifyPasswordResetCode(email=reset_user.email, code="123456"))
        assert result.valid is True
        await service.reset_password(self._reset(reset_user.email, "123456"))
        assert await redis_client.get(f"auth:password_reset:{reset_user.id}:attempts") is None

    @pytest.mark.asyncio
    async def test_non_ascii_code_is_a_wrong_code_not_a_crash(self, service, reset_user):
        with pytest.raises(ValidationError):
            await service.reset_password(self._reset(reset_user.email, "ąęćłóż"))

    def test_brute_force_through_endpoint_with_body_and_ip_variants(self, client, unverified_user, monkeypatch):
        """Scenariusz recenzenta: rotacja IP/X-Forwarded-For + warianty user_id - kod i tak pada po 5 próbach."""
        monkeypatch.setenv("RENDER", "true")
        uid = unverified_user.id
        variants = [uid, float(uid), f"0{uid}", f" {uid}", f"+{uid}"]
        statuses = []
        for i in range(40):
            r = client.post(
                "/api/v1/auth/verify-email",
                json={"user_id": variants[i % len(variants)], "code": f"{i:06d}"},
                headers={"X-Forwarded-For": f"10.8.{i}.1, 1.2.3.{i}", "CF-Connecting-IP": f"1.2.3.{i}"},
            )
            statuses.append(r.status_code)
        correct = client.post(
            "/api/v1/auth/verify-email",
            json={"user_id": uid, "code": "123456"},
            headers={"CF-Connecting-IP": "1.2.9.9"},
        )
        assert statuses[:MAX_CODE_ATTEMPTS] == [400] * MAX_CODE_ATTEMPTS
        assert set(statuses[MAX_CODE_ATTEMPTS:]) == {429}
        assert correct.status_code == 429


class TestPasswordLoginOnGoogleAccount:
    @pytest.mark.asyncio
    async def test_service_raises_authentication_error(self, db_session, google_user):
        with pytest.raises(AuthenticationError) as exc:
            await AuthService(db_session).login_user(
                LoginData(login=google_user.email, password=ANY_PASSWORD)
            )
        assert exc.value.status_code == 401

    def test_endpoint_returns_401_not_500(self, client, google_user):
        r = client.post(
            "/api/v1/auth/login",
            json={"login": google_user.email, "password": ANY_PASSWORD},
        )
        assert r.status_code == 401
        assert r.json()["code"] == "AUTH_ERROR"
