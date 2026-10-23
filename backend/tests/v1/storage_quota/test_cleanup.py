# ruff: noqa: F811  (fixture importowane z test_board_files.py pojawiaja sie tez jako argumenty testow)
"""
Job sprzatajacy (api/v1/storage_quota/cleanup.py): rejestr, sieroty, karencja 30 dni,
awatary, powiadomienia, zaproszenia. Storage to atrapa w pamieci z listowaniem w stylu
Supabase (foldery = pozycje z `id: null`, metadane z rozmiarem i data).
"""
import json
from datetime import datetime, timedelta

import httpx
import pytest

import api.v1.storage_quota.cleanup as cleanup
from api.v1.boards.service import BoardService
from api.v1.storage_quota import service as storage_quota
from api.v1.storage_quota.models import BoardFile
from core.models import Board, BoardDocument, Notification, WorkspaceInvite, WorkspaceShareLink
from tests.v1.whiteboard.test_board_files import (  # noqa: F401  (fixture'y: atrapa Storage, klient, redis)
    FakeStorage,
    install_storage,
    use_fake_redis_singleton,
)

NOW = datetime(2026, 10, 19, 12, 0, 0)
LONG_AGO = "2026-01-01T00:00:00.000Z"

# Prawdziwy snapshot Yjs (yjs 13, encodeStateAsUpdate): mapa `excalidraw-files` z wpisem
# {ref: {v: 1, name: "0123456789abcdef0123456789abcdef.webp"}}; drugi wpis (fedcba98...) byl
# skasowany przed zapisem, wiec jego nazwy w snapshocie nie ma.
REFERENCED = "0123456789abcdef0123456789abcdef.webp"
GONE_FROM_SNAPSHOT = "fedcba9876543210fedcba9876543210.webp"
SNAPSHOT_B64 = (
    "AQLq0MoVACgBEGV4Y2FsaWRyYXctZmlsZXMDYWJjAXYEAmlkdwNhYmMIbWltZVR5cGV3CmltYWdlL3dlYnAHY3JlYXRlZH0BA3JlZnYCAXZ9"
    "AQRuYW1ldyUwMTIzNDU2Nzg5YWJjZGVmMDEyMzQ1Njc4OWFiY2RlZi53ZWJwIQEQZXhjYWxpZHJhdy1maWxlcwNkZWYBAerQyhUBAQE="
)


def snapshot_bytes() -> bytes:
    import base64

    return base64.b64decode(SNAPSHOT_B64)


class ListingStorage(FakeStorage):
    """FakeStorage z listowaniem jak Supabase: pozycje jednego poziomu, foldery z `id: null`, metadane."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.created: dict[str, str] = {}  # "bucket/sciezka" -> ISO, domyslnie LONG_AGO
        self.fail_listing: set[str] = set()  # buckety, ktorych listowanie konczy sie HTTP 500
        self.fail_delete = False

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.startswith("/storage/v1/object/list/") and request.method == "POST":
            self.requests.append(request)
            bucket = path[len("/storage/v1/object/list/"):]
            if bucket in self.fail_listing:
                return httpx.Response(500, json={"message": "boom"})
            if bucket not in self.buckets:
                return self._bucket_not_found()
            body = json.loads(request.content)
            prefix = body["prefix"]
            level: dict[str, dict] = {}
            for key in sorted(self.objects):
                if not key.startswith(f"{bucket}/{prefix}"):
                    continue
                rest = key[len(bucket) + 1 + len(prefix):]
                head, _, tail = rest.partition("/")
                if tail:
                    level.setdefault(head, {"name": head, "id": None})
                else:
                    level[head] = {
                        "name": head,
                        "id": f"id-{head}",
                        "created_at": self.created.get(key, LONG_AGO),
                        "metadata": {"size": len(self.objects[key])},
                    }
            entries = list(level.values())
            return httpx.Response(200, json=entries[body.get("offset", 0):][: body.get("limit", 100)])
        if request.method == "DELETE" and self.fail_delete:
            self.requests.append(request)
            return httpx.Response(500, json={"message": "boom"})
        return super().handler(request)

    def put(self, bucket: str, path: str, data: bytes = b"x" * 10, created: str | None = None) -> None:
        self.buckets.add(bucket)
        self.objects[f"{bucket}/{path}"] = data
        if created:
            self.created[f"{bucket}/{path}"] = created


@pytest.fixture
def storage(monkeypatch):
    return install_storage(monkeypatch, ListingStorage(buckets=("board-files", "avatars")))


def name(char: str) -> str:
    return f"{char * 32}.webp"


def add_row(db, board_id, owner_id=1, char="a", days_old=0, deleted_days_ago=None, size=10) -> BoardFile:
    row = BoardFile(
        board_id=board_id, owner_id=owner_id, file_name=name(char), size_bytes=size,
        created_at=NOW - timedelta(days=days_old),
        deleted_at=None if deleted_days_ago is None else NOW - timedelta(days=deleted_days_ago),
    )
    db.add(row)
    db.commit()
    return row


def add_snapshot(db, board_id: int, data: bytes) -> None:
    db.add(BoardDocument(board_id=board_id, snapshot=data))
    db.commit()


async def run(db, dry_run=False, now=NOW) -> dict:
    # run_cleanup zamyka sesje po przebiegu; w tescie ta sama sesja ma zostac otwarta dla asercji.
    db.close = lambda: None
    return await cleanup.run_cleanup(dry_run=dry_run, now=now, session_factory=lambda: db)


def rows(db) -> dict[str, BoardFile]:
    db.expire_all()
    return {r.file_name: r for r in db.query(BoardFile)}


class TestSyncRegistry:

    @pytest.mark.asyncio
    async def test_plik_sprzed_rejestru_jest_dopisywany_na_konto_wlasciciela(
        self, db_session, test_user, test_board, storage
    ):
        # swiezy plik (poza karencja sierot), zeby ten sam przebieg go nie oznaczyl
        storage.put("board-files", f"{test_board.id}/{name('a')}", b"x" * 123, created="2026-10-18T12:00:00.000Z")

        report = await run(db_session)

        row = rows(db_session)[name("a")]
        assert (row.board_id, row.owner_id, row.size_bytes, row.deleted_at) == (test_board.id, test_user.id, 123, None)
        assert report["counts"]["registry_added"] == 1
        assert report["totals"]["board_files_objects"] == 1
        assert report["totals"]["board_files_bytes"] == 123
        assert storage_quota.used_bytes(db_session, test_user.id) == 123

    @pytest.mark.asyncio
    async def test_plik_nieistniejacej_tablicy_od_razu_czeka_na_skasowanie(self, db_session, storage):
        storage.put("board-files", f"777/{name('b')}")

        await run(db_session)

        row = rows(db_session)[name("b")]
        assert row.owner_id == 0
        assert row.deleted_at == NOW

    @pytest.mark.asyncio
    async def test_obce_nazwy_w_buckecie_sa_ignorowane(self, db_session, test_board, storage):
        storage.put("board-files", f"{test_board.id}/notatki.txt")
        storage.put("board-files", f"abc/{name('c')}")

        await run(db_session)

        assert rows(db_session) == {}

    @pytest.mark.asyncio
    async def test_wpis_bez_obiektu_jest_usuwany_ale_swiezy_zostaje(self, db_session, test_user, test_board, storage):
        add_row(db_session, test_board.id, test_user.id, "a", days_old=3)
        fresh = add_row(db_session, test_board.id, test_user.id, "b")
        fresh.created_at = NOW - timedelta(minutes=5)  # upload tuz po listowaniu: obiekt moze byc "niewidoczny"
        db_session.commit()
        storage.put("board-files", f"{test_board.id}/{name('d')}")  # tablica ma folder w Storage

        report = await run(db_session)

        assert set(rows(db_session)) == {name("b"), name("d")}
        assert report["counts"]["registry_removed"] == 1

    @pytest.mark.asyncio
    async def test_nieudane_listowanie_nie_oznacza_ze_plikow_nie_ma(self, db_session, test_user, test_board, storage):
        add_row(db_session, test_board.id, test_user.id, "a", days_old=3)
        storage.fail_listing.add("board-files")

        report = await run(db_session)

        assert name("a") in rows(db_session)
        assert any("sync_registry" in e for e in report["errors"])


class TestMarkVanishedBoards:

    @pytest.mark.asyncio
    async def test_pliki_nieistniejacej_tablicy_dostaja_deleted_at(self, db_session, test_user, test_board, storage):
        add_row(db_session, test_board.id, test_user.id, "a")
        add_row(db_session, 999, test_user.id, "b")
        storage.put("board-files", f"{test_board.id}/{name('a')}")
        storage.put("board-files", f"999/{name('b')}")

        report = await run(db_session)

        assert rows(db_session)[name("b")].deleted_at == NOW
        assert rows(db_session)[name("a")].deleted_at is None
        assert report["counts"]["marked_board_gone"] == 1


class TestOrphans:

    @pytest.mark.asyncio
    async def test_prawdziwy_snapshot_yjs_zawiera_nazwe_pliku_jako_tekst(self):
        snapshot = snapshot_bytes()

        assert cleanup._referenced(snapshot, REFERENCED) is True
        assert cleanup._referenced(snapshot, GONE_FROM_SNAPSHOT) is False
        assert cleanup._referenced(None, REFERENCED) is False

    @pytest.mark.asyncio
    async def test_stary_plik_bez_odwolania_jest_oznaczany_a_z_odwolaniem_zostaje(
        self, db_session, test_user, test_board, storage
    ):
        add_snapshot(db_session, test_board.id, snapshot_bytes())
        for file_name in (REFERENCED, GONE_FROM_SNAPSHOT):
            db_session.add(BoardFile(
                board_id=test_board.id, owner_id=test_user.id, file_name=file_name, size_bytes=10,
                created_at=NOW - timedelta(days=30),
            ))
            storage.put("board-files", f"{test_board.id}/{file_name}")
        db_session.commit()

        report = await run(db_session)

        assert rows(db_session)[REFERENCED].deleted_at is None
        assert rows(db_session)[GONE_FROM_SNAPSHOT].deleted_at == NOW
        assert report["counts"]["marked_orphans"] == 1
        assert f"board-files/{test_board.id}/{GONE_FROM_SNAPSHOT}" in storage.objects  # karencja, nie kasujemy

    @pytest.mark.asyncio
    async def test_swiezy_plik_bez_snapshotu_zostaje_bo_zapis_moze_jeszcze_nie_dojsc(
        self, db_session, test_user, test_board, storage
    ):
        add_row(db_session, test_board.id, test_user.id, "a", days_old=2)
        storage.put("board-files", f"{test_board.id}/{name('a')}")

        await run(db_session)

        assert rows(db_session)[name("a")].deleted_at is None

    @pytest.mark.asyncio
    async def test_stary_plik_tablicy_bez_snapshotu_jest_sierota(self, db_session, test_user, test_board, storage):
        add_row(db_session, test_board.id, test_user.id, "a", days_old=20)
        storage.put("board-files", f"{test_board.id}/{name('a')}")

        await run(db_session)

        assert rows(db_session)[name("a")].deleted_at == NOW

    @pytest.mark.asyncio
    async def test_bezpiecznik_masowy_nie_oznacza_ponad_polowy_plikow(self, db_session, test_user, test_board, storage):
        for i in range(30):
            file_name = f"{i:032x}.webp"
            db_session.add(BoardFile(
                board_id=test_board.id, owner_id=test_user.id, file_name=file_name, size_bytes=1,
                created_at=NOW - timedelta(days=30),
            ))
            storage.put("board-files", f"{test_board.id}/{file_name}")
        db_session.commit()

        report = await run(db_session)

        assert all(r.deleted_at is None for r in rows(db_session).values())
        assert any("mark_orphans" in e and "pominieto" in e for e in report["errors"])


class TestPurge:

    @pytest.mark.asyncio
    async def test_po_30_dniach_plik_znika_ze_storage_i_z_rejestru(self, db_session, test_user, storage):
        add_row(db_session, 999, test_user.id, "a", deleted_days_ago=31, size=50)
        add_row(db_session, 999, test_user.id, "b", deleted_days_ago=10)
        storage.put("board-files", f"999/{name('a')}")
        storage.put("board-files", f"999/{name('b')}")

        report = await run(db_session)

        assert storage.keys() == [f"999/{name('b')}"]
        assert set(rows(db_session)) == {name("b")}
        assert report["counts"]["purged_files"] == 1
        assert report["counts"]["purged_bytes"] == 50

    @pytest.mark.asyncio
    async def test_plik_z_odwolaniem_nie_jest_kasowany_tylko_wraca_do_uzycia(
        self, db_session, test_user, test_board, storage
    ):
        add_snapshot(db_session, test_board.id, snapshot_bytes())
        db_session.add(BoardFile(
            board_id=test_board.id, owner_id=test_user.id, file_name=REFERENCED, size_bytes=10,
            created_at=NOW - timedelta(days=90), deleted_at=NOW - timedelta(days=60),
        ))
        db_session.commit()
        storage.put("board-files", f"{test_board.id}/{REFERENCED}")

        report = await run(db_session)

        assert f"board-files/{test_board.id}/{REFERENCED}" in storage.objects
        assert rows(db_session)[REFERENCED].deleted_at is None
        assert report["counts"]["restored"] == 1
        assert "purged_files" not in report["counts"]

    @pytest.mark.asyncio
    async def test_blad_kasowania_zostawia_wpis_do_nastepnego_przebiegu(self, db_session, test_user, storage):
        add_row(db_session, 999, test_user.id, "a", deleted_days_ago=40)
        storage.put("board-files", f"999/{name('a')}")
        storage.fail_delete = True

        report = await run(db_session)

        assert name("a") in rows(db_session)
        assert f"board-files/999/{name('a')}" in storage.objects
        assert report["counts"]["purge_failed"] == 1

    @pytest.mark.asyncio
    async def test_dry_run_niczego_nie_zmienia(self, db_session, test_user, test_board, storage):
        add_row(db_session, 999, test_user.id, "a", deleted_days_ago=40)
        add_row(db_session, test_board.id, test_user.id, "b", days_old=20)
        storage.put("board-files", f"999/{name('a')}")
        storage.put("board-files", f"{test_board.id}/{name('b')}")
        storage.put("avatars", "stary.webp")
        before = dict(storage.objects)

        report = await run(db_session, dry_run=True)

        assert report["dry_run"] is True
        assert report["counts"]["purged_files"] == 1
        assert report["counts"]["marked_orphans"] == 1
        assert storage.objects == before
        assert all(r.deleted_at in (None, NOW - timedelta(days=40)) for r in rows(db_session).values())
        assert await cleanup.last_report() is None  # podglad nie nadpisuje raportu prawdziwego przebiegu


class TestUsuwanieTablic:

    @pytest.mark.asyncio
    async def test_usuniecie_tablicy_zwalnia_miejsce_ale_plik_zostaje_na_30_dni(
        self, db_session, test_user, test_workspace, test_board, storage
    ):
        board_id = test_board.id
        add_row(db_session, board_id, test_user.id, "a", size=70)
        storage.put("board-files", f"{board_id}/{name('a')}")
        assert storage_quota.used_bytes(db_session, test_user.id) == 70

        await BoardService(db_session).delete_board(board_id, test_user.id)

        assert storage_quota.used_bytes(db_session, test_user.id) == 0
        assert f"board-files/{board_id}/{name('a')}" in storage.objects
        assert db_session.query(Board).filter(Board.id == board_id).count() == 0

        later = NOW + timedelta(days=31)
        row = db_session.query(BoardFile).one()
        row.deleted_at = later - timedelta(days=31)  # oznaczone 31 dni temu
        db_session.commit()
        report = await run(db_session, now=later)

        assert storage.keys() == []
        assert db_session.query(BoardFile).count() == 0
        assert report["counts"]["purged_files"] == 1


class TestAvatars:

    def avatar_url(self, path: str) -> str:
        return f"https://test.supabase.co/storage/v1/object/public/avatars/{path}"

    @pytest.mark.asyncio
    async def test_kasuje_tylko_stare_obiekty_bez_uzytkownika(self, db_session, test_user, storage):
        test_user.avatar_url = self.avatar_url("uzywany.webp")
        db_session.commit()
        storage.put("avatars", "uzywany.webp")
        storage.put("avatars", "stary.webp")
        storage.put("avatars", "swiezy.webp", created="2026-10-18T12:00:00.000Z")

        report = await run(db_session)

        assert storage.keys("avatars") == ["swiezy.webp", "uzywany.webp"]
        assert report["counts"]["avatars_removed"] == 1

    @pytest.mark.asyncio
    async def test_bezpiecznik_gdy_prawie_nic_nie_jest_przypisane(self, db_session, storage):
        for i in range(25):
            storage.put("avatars", f"{i:032x}.webp")

        report = await run(db_session)

        assert len(storage.keys("avatars")) == 25
        assert any("cleanup_avatars" in e and "pominieto" in e for e in report["errors"])


class TestBaza:

    @pytest.mark.asyncio
    async def test_powiadomienia(self, db_session, test_user, storage):
        def notification(created_days, read_days=None):
            return Notification(
                user_id=test_user.id, type="invite", payload={}, is_read=read_days is not None,
                created_at=NOW - timedelta(days=created_days),
                read_at=None if read_days is None else NOW - timedelta(days=read_days),
            )

        db_session.add_all([
            notification(40, read_days=35),  # przeczytane 35 dni temu -> kasowane
            notification(40, read_days=5),   # przeczytane niedawno -> zostaje
            notification(40),                # nieprzeczytane, 40 dni -> zostaje
            notification(100),               # nieprzeczytane, 100 dni -> kasowane
            notification(2),
        ])
        db_session.commit()

        report = await run(db_session)

        assert db_session.query(Notification).count() == 3
        assert report["counts"]["notifications_removed"] == 2

    @pytest.mark.asyncio
    async def test_zaproszenia_i_linki(self, db_session, test_user, test_user2, test_workspace, storage):
        def invite(token, expires_days_ago):
            return WorkspaceInvite(
                workspace_id=test_workspace.id, invited_by=test_user.id, invited_id=test_user2.id,
                invite_token=token, expires_at=NOW - timedelta(days=expires_days_ago), created_at=NOW - timedelta(days=60),
            )

        def link(token, expires_days_ago, revoked_days_ago=None):
            return WorkspaceShareLink(
                workspace_id=test_workspace.id, token=token, expires_at=NOW - timedelta(days=expires_days_ago),
                revoked_at=None if revoked_days_ago is None else NOW - timedelta(days=revoked_days_ago),
            )

        db_session.add_all([
            invite("stary", 45), invite("niedawno", 5), invite("aktywny", -3),
            link("l-stary", 45), link("l-aktywny", -3), link("l-odwolany", -3, revoked_days_ago=40),
        ])
        db_session.commit()

        report = await run(db_session)

        assert sorted(i.invite_token for i in db_session.query(WorkspaceInvite)) == ["aktywny", "niedawno"]
        assert [x.token for x in db_session.query(WorkspaceShareLink)] == ["l-aktywny"]
        assert report["counts"]["invites_removed"] == 1
        assert report["counts"]["share_links_removed"] == 2


class TestPrzebieg:

    @pytest.mark.asyncio
    async def test_blad_jednego_kroku_nie_zatrzymuje_reszty(self, db_session, test_user, storage, monkeypatch):
        add_row(db_session, 999, test_user.id, "a", deleted_days_ago=40)
        storage.put("board-files", f"999/{name('a')}")

        def broken(*args, **kwargs):
            raise RuntimeError("boom")

        monkeypatch.setattr(cleanup, "mark_vanished_boards", broken)

        report = await run(db_session)

        assert any(e.startswith("mark_vanished_boards") for e in report["errors"])
        assert report["counts"]["purged_files"] == 1

    @pytest.mark.asyncio
    async def test_raport_trafia_do_redis_a_blokada_jest_zwalniana(self, db_session, storage, redis_client):
        report = await run(db_session)

        assert await cleanup.last_report() == report
        assert report["finished_at"]
        assert await redis_client.get(cleanup.LOCK_KEY) is None

    @pytest.mark.asyncio
    async def test_rownolegly_przebieg_jest_pomijany(self, db_session, storage, redis_client):
        await redis_client.set(cleanup.LOCK_KEY, "ktos-inny", ex=60)

        report = await run(db_session)

        assert report["skipped"] == "inny przebieg trwa"
        assert storage.requests == []

    @pytest.mark.asyncio
    async def test_petla_uruchamia_przebieg_dopiero_gdy_minal_interwal(self, redis_client):
        interval = timedelta(hours=24)
        assert await cleanup._is_due(interval) is True  # brak raportu

        recent = (cleanup.utcnow() - timedelta(hours=2)).isoformat()
        await redis_client.set(cleanup.LAST_REPORT_KEY, json.dumps({"finished_at": recent}))
        assert await cleanup._is_due(interval) is False

        old = (cleanup.utcnow() - timedelta(hours=30)).isoformat()
        await redis_client.set(cleanup.LAST_REPORT_KEY, json.dumps({"finished_at": old}))
        assert await cleanup._is_due(interval) is True

    def test_wlasciciel_tablicy_to_wlasciciel_przestrzeni(self, db_session, test_user, test_board):
        assert cleanup._board_owners(db_session, [test_board.id, 12345]) == {test_board.id: test_user.id}
