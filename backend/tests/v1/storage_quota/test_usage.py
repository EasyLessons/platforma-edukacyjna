# ruff: noqa: F811  (fixture importowane z test_board_files.py pojawiaja sie tez jako argumenty testow)
"""Podglad zajetosci Storage dla admina: GET /api/v1/whiteboard/storage/usage (storage_quota/usage.py)."""
import json
from datetime import timedelta

import pytest

import api.v1.storage_quota.cleanup as cleanup
import api.v1.storage_quota.usage as usage
from api.v1.plans.models import UserPlan
from api.v1.storage_quota.models import BoardFile
from core.config import get_settings
from core.time import utcnow
from tests.v1.storage_quota.test_cleanup import ListingStorage, run, storage  # noqa: F401
from tests.v1.whiteboard.test_board_files import (  # noqa: F401  (fixture'y: klient, auth, redis)
    auth_headers,
    client,
    use_fake_redis_singleton,
)

URL = "/api/v1/whiteboard/storage/usage"
MB = 1024 * 1024


def add_file(db, owner_id: int, size: int, char: str = "a", board_id: int = 1, deleted: bool = False) -> None:
    db.add(BoardFile(
        board_id=board_id, owner_id=owner_id, file_name=f"{char * 32}.webp", size_bytes=size,
        deleted_at=utcnow() - timedelta(days=1) if deleted else None,
    ))
    db.commit()


@pytest.fixture
def admin(monkeypatch, test_user):
    monkeypatch.setattr(get_settings(), "call_admin_user_ids", str(test_user.id))
    return test_user


def get(client, user):
    return client.get(URL, headers=auth_headers(user.id))


class TestDostep:

    def test_401_bez_tokenu(self, client):
        assert client.get(URL).status_code == 401

    def test_zwykly_uzytkownik_403(self, client, test_user, monkeypatch):
        monkeypatch.setattr(get_settings(), "call_admin_user_ids", "")

        r = get(client, test_user)

        assert r.status_code == 403
        assert r.json()["code"] == "FORBIDDEN"

    def test_inny_admin_nie_wpuszcza_cudzego_konta(self, client, test_user, test_user2, monkeypatch):
        monkeypatch.setattr(get_settings(), "call_admin_user_ids", str(test_user2.id))

        assert get(client, test_user).status_code == 403
        assert get(client, test_user2).status_code == 200


class TestRaport:

    def test_pusty_stan(self, client, admin):
        r = get(client, admin)

        assert r.status_code == 200
        data = r.json()["data"]
        assert data["state"] == "ok"
        assert data["hint"] is None
        assert data["budget_bytes"] == 1024 * MB
        assert data["registry_files"] == 0 and data["estimated_bytes"] == 0
        assert data["top_accounts"] == []
        assert data["last_cleanup"] is None
        assert r.headers["cache-control"] == "no-store"

    def test_rejestr_konta_i_pliki_do_skasowania(self, client, db_session, admin, test_user2):
        add_file(db_session, admin.id, 3 * MB, "a")
        add_file(db_session, admin.id, 2 * MB, "b")
        add_file(db_session, test_user2.id, 90 * MB, "c")
        add_file(db_session, test_user2.id, 10 * MB, "d", deleted=True)
        db_session.add(UserPlan(user_id=admin.id, plan="premium"))
        db_session.commit()

        data = get(client, admin).json()["data"]

        assert (data["registry_files"], data["registry_bytes"]) == (3, 95 * MB)
        assert (data["pending_delete_files"], data["pending_delete_bytes"]) == (1, 10 * MB)
        assert data["estimated_bytes"] == 105 * MB
        assert data["accounts_with_files"] == 2
        top = data["top_accounts"]
        assert [a["user_id"] for a in top] == [test_user2.id, admin.id]  # od najwiekszego
        assert top[0] == {
            "user_id": test_user2.id, "username": "testuser2", "plan": "free", "files": 1,
            "used_bytes": 90 * MB, "limit_bytes": 100 * MB, "percent": 90.0,
        }
        assert top[1]["plan"] == "premium" and top[1]["limit_bytes"] == 5 * 1024 * MB

    def test_konta_ponad_limitem_sa_liczone(self, client, db_session, admin, test_user2):
        add_file(db_session, test_user2.id, 150 * MB)  # ponad 100 MB planu Free
        add_file(db_session, admin.id, 1 * MB, "b")

        data = get(client, admin).json()["data"]

        assert data["accounts_over_limit"] == 1

    @pytest.mark.parametrize(
        "bytes_used, state",
        [(699, "ok"), (700, "warning"), (899, "warning"), (900, "critical"), (2000, "critical")],
    )
    def test_progi_wzgledem_budzetu(self, client, db_session, admin, monkeypatch, bytes_used, state):
        monkeypatch.setattr(usage, "SUPABASE_FREE_BUDGET_BYTES", 1000)
        add_file(db_session, admin.id, bytes_used)

        data = get(client, admin).json()["data"]

        assert data["state"] == state
        assert (data["hint"] is not None and "Cloudflare R2" in data["hint"]) == (state != "ok")

    def test_odpowiedz_nie_zawiera_sekretow_ani_adresu_storage(self, client, admin):
        r = get(client, admin)

        assert get_settings().supabase_service_role_key not in r.text
        assert get_settings().supabase_url not in r.text


class TestPomiarZPrzebiegu:

    @pytest.mark.asyncio
    async def test_raport_zawiera_pomiar_prawdziwego_storage(self, client, db_session, admin, test_board, storage):
        storage.put("board-files", f"{test_board.id}/{'a' * 32}.webp", b"x" * 400, created="2026-10-18T12:00:00.000Z")
        storage.put("avatars", "a.webp", b"x" * 50, created="2026-10-18T12:00:00.000Z")
        await run(db_session)

        data = get(client, admin).json()["data"]

        assert data["measured_board_files_bytes"] == 400
        assert data["measured_avatars_bytes"] == 50
        assert data["estimated_bytes"] == 450  # rejestr (dopisany przez przebieg) = 400, + awatary
        assert data["measured_at"]
        assert data["last_cleanup"]["counts"]["registry_added"] == 1
        assert data["last_cleanup"]["errors"] == []

    @pytest.mark.asyncio
    async def test_wiekszy_odczyt_wygrywa_gdy_rejestr_jest_niepelny(self, client, db_session, admin, redis_client):
        add_file(db_session, admin.id, 100)
        report = {"finished_at": "2026-10-19T00:00:00", "totals": {"board_files_bytes": 5000, "avatars_bytes": 7}}
        await redis_client.set(cleanup.LAST_REPORT_KEY, json.dumps(report))

        data = get(client, admin).json()["data"]

        assert data["estimated_bytes"] == 5007
