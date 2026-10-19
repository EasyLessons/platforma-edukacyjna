# ruff: noqa: F811  (fixture importowane z test_board_files.py pojawiaja sie tez jako argumenty testow)
"""
Limit miejsca na pliki tablic na konto wlasciciela przestrzeni (api/v1/storage_quota).

Upload idzie przez prawdziwy endpoint z atrapa Storage (tests/v1/whiteboard/test_board_files.py);
limit w bajtach podmieniamy na maly, zeby nie wgrywac 100 MB.
"""
import dataclasses

import pytest

from api.v1.boards.service import BoardService
from api.v1.plans import limits as plan_limits
from api.v1.plans.models import UserPlan
from api.v1.plans.service import PlanService
from api.v1.storage_quota import service as storage_quota
from api.v1.storage_quota.models import BoardFile
from api.v1.workspaces.service import WorkspaceService
from core.time import utcnow
from tests.v1.whiteboard.test_board_files import (  # noqa: F401  (fixture'y uploadu: atrapa Storage, klient, redis)
    auth_headers,
    client,
    count_body_reads,
    fake_storage,
    files_url,
    image_bytes,
    make_board,
    post_file,
    set_role,
    upload_ok,
    use_fake_redis_singleton,
)

LIMIT = 1024


def set_free_limit(monkeypatch, limit_bytes: int) -> None:
    """Plan Free z podanym limitem miejsca (reszta limitow bez zmian)."""
    free = dataclasses.replace(plan_limits.PLAN_LIMITS["free"], max_storage_bytes=limit_bytes)
    monkeypatch.setitem(plan_limits.PLAN_LIMITS, "free", free)


@pytest.fixture
def small_free_limit(monkeypatch):
    set_free_limit(monkeypatch, LIMIT)


def used(db_session, owner_id: int) -> int:
    return storage_quota.used_bytes(db_session, owner_id)


def add_row(db_session, board_id: int, owner_id: int, size: int, name: str = "a", **extra) -> BoardFile:
    row = BoardFile(board_id=board_id, owner_id=owner_id, file_name=f"{name * 32}.webp", size_bytes=size, **extra)
    db_session.add(row)
    db_session.commit()
    return row


class TestRejestr:

    def test_upload_dopisuje_plik_do_rejestru(self, client, db_session, test_user, test_board, fake_storage):
        name = upload_ok(client, test_board.id, test_user)

        row = db_session.query(BoardFile).one()
        assert (row.board_id, row.owner_id, row.file_name) == (test_board.id, test_user.id, name)
        assert row.size_bytes == len(fake_storage.objects[f"board-files/{test_board.id}/{name}"])
        assert row.deleted_at is None
        assert used(db_session, test_user.id) == row.size_bytes

    def test_nieudany_upload_nie_zajmuje_miejsca(self, client, db_session, test_user, test_board, fake_storage):
        assert post_file(client, test_board.id, test_user, b"to nie obraz").status_code == 400

        assert db_session.query(BoardFile).count() == 0

    def test_plans_me_pokazuje_zajete_miejsce(self, client, db_session, test_user, test_board, fake_storage):
        upload_ok(client, test_board.id, test_user)
        size = used(db_session, test_user.id)

        r = client.get("/api/v1/plans/me", headers=auth_headers(test_user.id))

        assert r.json()["data"]["usage"]["storage_bytes"] == size > 0


class TestLimitNaKonto:

    def test_ponizej_limitu_upload_przechodzi(self, client, test_user, test_board, fake_storage):
        assert post_file(client, test_board.id, test_user, image_bytes()).status_code == 200

    def test_przekroczenie_limitu_blokuje_dodanie_i_nie_zostawia_pliku(
        self, client, db_session, test_user, test_board, fake_storage, monkeypatch
    ):
        upload_ok(client, test_board.id, test_user)
        size = used(db_session, test_user.id)
        set_free_limit(monkeypatch, size + 1)  # miesci sie jeden plik, drugi juz nie
        stored = fake_storage.keys()

        r = post_file(client, test_board.id, test_user, image_bytes())

        assert r.status_code == 403
        assert r.json()["code"] == "PLAN_LIMIT_STORAGE"
        assert r.json()["data"] == {"limit_bytes": size + 1, "used_bytes": size}
        assert fake_storage.keys() == stored  # obiekt zapisany przed sprawdzeniem zostal skasowany
        assert used(db_session, test_user.id) == size

    def test_pojedynczy_plik_wiekszy_niz_limit_jest_odrzucony(
        self, client, db_session, test_user, test_board, fake_storage, monkeypatch
    ):
        set_free_limit(monkeypatch, 10)

        r = post_file(client, test_board.id, test_user, image_bytes())

        assert r.status_code == 403
        assert r.json()["code"] == "PLAN_LIMIT_STORAGE"
        assert fake_storage.keys() == []
        assert db_session.query(BoardFile).count() == 0

    def test_konto_na_limicie_jest_odrzucone_bez_czytania_ciala(
        self, client, db_session, test_user, test_board, fake_storage, small_free_limit, monkeypatch
    ):
        add_row(db_session, test_board.id, test_user.id, LIMIT)
        calls = count_body_reads(monkeypatch)

        r = post_file(client, test_board.id, test_user, image_bytes())

        assert r.status_code == 403
        assert r.json()["code"] == "PLAN_LIMIT_STORAGE"
        assert calls["n"] == 0
        assert fake_storage.requests == []

    def test_premium_ma_wiekszy_limit(self, client, db_session, test_user, test_board, fake_storage, small_free_limit):
        db_session.add(UserPlan(user_id=test_user.id, plan="premium"))
        add_row(db_session, test_board.id, test_user.id, LIMIT * 10)

        assert post_file(client, test_board.id, test_user, image_bytes()).status_code == 200

    def test_przegladanie_dziala_na_limicie(self, client, db_session, test_user, test_board, fake_storage):
        name = upload_ok(client, test_board.id, test_user)
        add_row(db_session, test_board.id, test_user.id, plan_limits.PLAN_LIMITS["free"].max_storage_bytes, name="b")
        assert post_file(client, test_board.id, test_user, image_bytes()).status_code == 403

        r = client.get(f"{files_url(test_board.id)}/{name}", headers=auth_headers(test_user.id))

        assert r.status_code == 200

    def test_edytor_wgrywa_na_koszt_wlasciciela(
        self, client, db_session, test_user, test_user2, shared_workspace, fake_storage
    ):
        board = make_board(db_session, shared_workspace, test_user)
        set_role(db_session, shared_workspace, test_user2, "editor")

        upload_ok(client, board.id, test_user2)

        assert db_session.query(BoardFile).one().owner_id == test_user.id  # wlasciciel przestrzeni, nie edytor
        assert used(db_session, test_user2.id) == 0

    def test_limit_wlasciciela_blokuje_edytora_nawet_gdy_edytor_ma_premium(
        self, client, db_session, test_user, test_user2, shared_workspace, fake_storage, small_free_limit
    ):
        board = make_board(db_session, shared_workspace, test_user)
        set_role(db_session, shared_workspace, test_user2, "editor")
        db_session.add(UserPlan(user_id=test_user2.id, plan="premium"))
        add_row(db_session, board.id, test_user.id, LIMIT)

        r = post_file(client, board.id, test_user2, image_bytes())

        assert r.status_code == 403
        assert r.json()["code"] == "PLAN_LIMIT_STORAGE"

    def test_limit_jest_na_konto_a_nie_na_tablice(
        self, client, db_session, test_user, test_workspace, test_board, fake_storage, small_free_limit
    ):
        other = make_board(db_session, test_workspace, test_user, name="Druga")
        add_row(db_session, test_board.id, test_user.id, LIMIT)

        assert post_file(client, other.id, test_user, image_bytes()).status_code == 403

    def test_cudze_pliki_nie_licza_sie(
        self, client, db_session, test_user, test_user2, test_board, fake_storage, small_free_limit
    ):
        add_row(db_session, 999, test_user2.id, LIMIT * 5)

        assert post_file(client, test_board.id, test_user, image_bytes()).status_code == 200

    def test_pliki_czekajace_na_skasowanie_nie_licza_sie(
        self, client, db_session, test_user, test_board, fake_storage, small_free_limit
    ):
        add_row(db_session, test_board.id, test_user.id, LIMIT * 5, deleted_at=utcnow())

        assert post_file(client, test_board.id, test_user, image_bytes()).status_code == 200

    def test_limit_free_z_env(self, monkeypatch):
        monkeypatch.setenv("PLAN_FREE_MAX_STORAGE_MB", "7")

        assert plan_limits._build_plan_limits()["free"].max_storage_bytes == 7 * 1024 * 1024


class TestZwalnianieMiejsca:

    @pytest.mark.asyncio
    async def test_usuniecie_tablicy_zwalnia_miejsce(self, client, db_session, test_user, test_board, fake_storage):
        upload_ok(client, test_board.id, test_user)
        board_id = test_board.id
        assert used(db_session, test_user.id) > 0

        await BoardService(db_session).delete_board(board_id, test_user.id)

        assert used(db_session, test_user.id) == 0
        assert db_session.query(BoardFile).count() == 0

    def test_usuniecie_przestrzeni_zwalnia_miejsce(
        self, client, db_session, test_user, test_workspace, test_board, fake_storage
    ):
        upload_ok(client, test_board.id, test_user)
        assert used(db_session, test_user.id) > 0

        WorkspaceService(db_session).delete_workspace(test_workspace.id, test_user.id)

        assert used(db_session, test_user.id) == 0
        # wiersz zostaje z `deleted_at` - fizyczne skasowanie to zadanie joba sprzatajacego
        assert db_session.query(BoardFile).filter(BoardFile.deleted_at.isnot(None)).count() == 1

    @pytest.mark.asyncio
    async def test_po_usunieciu_tablicy_mozna_znow_dodawac(
        self, client, db_session, test_user, test_workspace, test_board, fake_storage, small_free_limit
    ):
        other = make_board(db_session, test_workspace, test_user, name="Druga")
        add_row(db_session, test_board.id, test_user.id, LIMIT)
        assert post_file(client, other.id, test_user, image_bytes()).status_code == 403

        await BoardService(db_session).delete_board(test_board.id, test_user.id)

        assert post_file(client, other.id, test_user, image_bytes()).status_code == 200


class TestPlanService:

    def test_get_me_zawiera_zajete_miejsce(self, db_session, test_user):
        add_row(db_session, 1, test_user.id, 1234)

        assert PlanService(db_session).get_me(test_user.id).usage.storage_bytes == 1234
