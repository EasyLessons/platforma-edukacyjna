"""
Cykliczne sprzatanie (job): pliki w Storage, powiadomienia, zaproszenia i linki.

Decyzje Patryka z 12.10.2026:
  2. stare pliki, powiadomienia i zaproszenia sprzata job,
  3. sierota = plik, do ktorego nie odwoluje sie zaden snapshot `board_documents` ani awatar,
  4. pliki usunietych tablic/przestrzeni znikaja ze Storage po 30 dniach (okres na pomylke).

KOLEJNOSC KROKOW (kazdy w osobnym try/except - blad jednego nie zatrzymuje reszty):
  1. sync_registry        - rejestr `board_files` = zawartosc bucketu `board-files` (dopisuje pliki
                            sprzed rejestru, usuwa wpisy bez obiektu),
  2. mark_vanished_boards - pliki tablic, ktorych nie ma w `boards` (kaskady, usuniete konta)
                            dostaja `deleted_at`,
  3. mark_orphans         - plik starszy niz 7 dni, ktorego nazwy nie ma w snapshocie swojej
                            tablicy, dostaje `deleted_at`,
  4. purge_deleted        - `deleted_at` starsze niz 30 dni: PONOWNIE sprawdza snapshot (plik, do
                            ktorego jest odwolanie, wraca do uzycia - nigdy go nie kasujemy), reszte
                            kasuje ze Storage i z rejestru,
  5. cleanup_avatars      - obiekty bucketu `avatars` bez zadnego `users.avatar_url`, starsze niz 7 dni,
  6. cleanup_database     - powiadomienia, zaproszenia i linki po terminie.

CO ZNACZY "ODWOLANIE": snapshot Yjs trzyma nazwe pliku jako zwykly tekst UTF-8 (wpis
`{v: 1, name: "<32 hex>.webp"}` w mapie `excalidraw-files`), wiec wystarczy szukac nazwy w
bajtach snapshotu - bez dekodowania Yjs. Trafienie przypadkowe moze tylko ZATRZYMAC skasowanie,
nigdy go wywolac.

BEZPIECZENSTWO:
  * nic nie jest kasowane od razu: najpierw `deleted_at` (przestaje liczyc sie do limitu), fizyczne
    skasowanie dopiero po 30 dniach i po ponownym sprawdzeniu odwolan,
  * bezpiecznik masowy: krok, ktory oznaczylby ponad polowe plikow (min. 20), jest pomijany i
    zglaszany jako blad - tak wygladaloby zle podpiete DB albo uszkodzony odczyt snapshotow,
  * listowanie Storage, ktore sie nie udalo, nigdy nie jest traktowane jak "plikow nie ma",
  * `dry_run=True`: ten sam przebieg bez zadnego zapisu i kasowania - raport mowi, co by zrobil.

Uruchomienie: petla w `lifespan` (main.py, `start_cleanup_loop`) albo recznie
`python scripts/storage_cleanup.py [--dry-run]`. Jeden przebieg naraz (blokada w Redis).
"""
import asyncio
import json
import secrets
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta

from redis.exceptions import RedisError
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.v1.whiteboard.files import BOARD_FILES_BUCKET, FILE_NAME_PATTERN, delete_board_usage_counters
from core import redis_client as redis_client_module
from core.config import get_settings
from core.database import SessionLocal
from core.logging import get_logger
from core.models import (
    Board,
    BoardDocument,
    Notification,
    User,
    Workspace,
    WorkspaceInvite,
    WorkspaceShareLink,
)
from core.storage import delete_objects, list_folder, object_path_from_public_url
from core.time import utcnow

from .models import BoardFile

logger = get_logger(__name__)

AVATAR_BUCKET = "avatars"

RETENTION_DAYS = 30  # pliki usunietych tablic i sierot: tyle dni od oznaczenia do skasowania
ORPHAN_GRACE_DAYS = 7  # nowszy plik bez odwolania moze czekac na zapis snapshotu - nie ruszamy
AVATAR_GRACE_DAYS = 7
NOTIFICATION_READ_DAYS = 30
NOTIFICATION_ANY_DAYS = 90
EXPIRED_AFTER_DAYS = 30  # zaproszenia i linki po terminie
REGISTRY_RACE_MARGIN = timedelta(hours=1)  # wpis nowszy niz listowanie moze dopiero czekac na obiekt
PURGE_BATCH = 100
MASS_GUARD_MIN_FILES = 20
MASS_GUARD_SHARE = 0.5

LOCK_KEY = "storage_cleanup:lock"
LOCK_TTL_SECONDS = 3600
LAST_REPORT_KEY = "storage_cleanup:last_report"


@dataclass
class CleanupReport:
    dry_run: bool
    started_at: str
    finished_at: str | None = None
    skipped: str | None = None
    counts: dict[str, int] = field(default_factory=dict)
    # Stan zmierzony na listingu Storage (nie zmiana): obiekty i bajty w kazdym buckecie.
    totals: dict[str, int] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)

    def add(self, name: str, value: int = 1) -> None:
        self.counts[name] = self.counts.get(name, 0) + value

    def as_dict(self) -> dict:
        return asdict(self)


def _board_owners(db: Session, board_ids: list[int]) -> dict[int, int]:
    """board_id -> id wlasciciela przestrzeni (tylko tablice, ktore jeszcze istnieja)."""
    if not board_ids:
        return {}
    rows = (
        db.query(Board.id, Workspace.created_by)
        .join(Workspace, Workspace.id == Board.workspace_id)
        .filter(Board.id.in_(board_ids))
        .all()
    )
    return {int(board_id): int(owner_id) for board_id, owner_id in rows}


def _snapshot(db: Session, board_id: int) -> bytes | None:
    return db.query(BoardDocument.snapshot).filter(BoardDocument.board_id == board_id).scalar()


def _referenced(snapshot: bytes | None, file_name: str) -> bool:
    return snapshot is not None and file_name.encode("utf-8") in bytes(snapshot)


def _mass_guard(step: str, affected: int, total: int, report: CleanupReport) -> bool:
    """True = wolno dzialac. Zbyt duzy odsetek plikow naraz wyglada na blad, nie na sprzatanie."""
    if total >= MASS_GUARD_MIN_FILES and affected > total * MASS_GUARD_SHARE:
        message = f"{step}: pominieto - {affected} z {total} plikow to ponad {int(MASS_GUARD_SHARE * 100)}%"
        logger.error(f"Sprzatanie Storage: {message}")
        report.errors.append(message)
        return False
    return True


# -- 1. rejestr = bucket ---------------------------------------------------------------------------

async def sync_registry(db: Session, now: datetime, dry_run: bool, report: CleanupReport) -> None:
    """Rejestr `board_files` zgodny z zawartoscia bucketu `board-files`."""
    root = await list_folder(BOARD_FILES_BUCKET)
    if root is None:
        report.errors.append("sync_registry: nie udalo sie wylistowac bucketu board-files")
        return
    listed_at = now
    storage_boards = {int(name) for name in root[1] if name.isdigit()}
    ledger_boards = {int(b) for (b,) in db.query(BoardFile.board_id).distinct()}
    measured_objects = measured_bytes = 0
    complete = True

    for board_id in sorted(storage_boards | ledger_boards):
        folder = await list_folder(BOARD_FILES_BUCKET, str(board_id))
        if folder is None:
            report.add("registry_folders_unreadable")
            complete = False
            continue
        objects = {obj.path.rsplit("/", 1)[-1]: obj for obj in folder[0]}
        measured_objects += len(folder[0])
        measured_bytes += sum(obj.size for obj in folder[0])
        rows = {row.file_name: row for row in db.query(BoardFile).filter(BoardFile.board_id == board_id)}
        owner = _board_owners(db, [board_id]).get(board_id)

        for name, obj in objects.items():
            if name in rows or not FILE_NAME_PATTERN.fullmatch(name):
                continue
            report.add("registry_added")
            if dry_run:
                continue
            # Tablicy juz nie ma - plik od razu czeka na skasowanie (owner 0 = nikt).
            db.add(BoardFile(
                board_id=board_id, owner_id=owner or 0, file_name=name, size_bytes=obj.size,
                created_at=obj.created_at or now, deleted_at=None if owner else now,
            ))
            try:
                db.commit()
            except IntegrityError:  # rownolegly upload zdazyl dopisac ten sam plik
                db.rollback()

        for name, row in rows.items():
            if name in objects or row.created_at > listed_at - REGISTRY_RACE_MARGIN:
                continue
            report.add("registry_removed")
            if not dry_run:
                db.delete(row)
        if not dry_run:
            db.commit()

    if complete:  # niepelny listing dalby zanizony obraz zajetosci
        report.totals["board_files_objects"] = measured_objects
        report.totals["board_files_bytes"] = measured_bytes


# -- 2. i 3. oznaczanie ------------------------------------------------------------------------------

def mark_vanished_boards(db: Session, now: datetime, dry_run: bool, report: CleanupReport) -> None:
    """Pliki tablic, ktorych nie ma juz w `boards`, dostaja `deleted_at`."""
    active = [int(b) for (b,) in db.query(BoardFile.board_id).filter(BoardFile.deleted_at.is_(None)).distinct()]
    if not active:
        return
    existing = {int(b) for (b,) in db.query(Board.id).filter(Board.id.in_(active))}
    gone = [b for b in active if b not in existing]
    if not gone:
        return
    affected = db.query(BoardFile).filter(BoardFile.board_id.in_(gone), BoardFile.deleted_at.is_(None)).count()
    total = db.query(BoardFile).filter(BoardFile.deleted_at.is_(None)).count()
    if not _mass_guard("mark_vanished_boards", affected, total, report):
        return
    report.add("marked_board_gone", affected)
    if not dry_run:
        db.query(BoardFile).filter(
            BoardFile.board_id.in_(gone), BoardFile.deleted_at.is_(None)
        ).update({BoardFile.deleted_at: now}, synchronize_session=False)
        db.commit()


def mark_orphans(db: Session, now: datetime, dry_run: bool, report: CleanupReport) -> None:
    """Plik starszy niz ORPHAN_GRACE_DAYS bez odwolania w snapshocie swojej tablicy dostaje `deleted_at`."""
    cutoff = now - timedelta(days=ORPHAN_GRACE_DAYS)
    candidates: dict[int, list[BoardFile]] = {}
    for row in db.query(BoardFile).filter(BoardFile.deleted_at.is_(None), BoardFile.created_at < cutoff):
        candidates.setdefault(row.board_id, []).append(row)
    existing = {int(b) for (b,) in db.query(Board.id).filter(Board.id.in_(list(candidates)))} if candidates else set()

    orphans: list[BoardFile] = []
    for board_id, rows in candidates.items():
        if board_id not in existing:
            continue  # tablicy nie ma - zajmuje sie tym mark_vanished_boards
        snapshot = _snapshot(db, board_id)
        orphans.extend(row for row in rows if not _referenced(snapshot, row.file_name))

    total = db.query(BoardFile).filter(BoardFile.deleted_at.is_(None)).count()
    if not orphans or not _mass_guard("mark_orphans", len(orphans), total, report):
        return
    report.add("marked_orphans", len(orphans))
    if not dry_run:
        for row in orphans:
            row.deleted_at = now
        db.commit()


# -- 4. fizyczne skasowanie --------------------------------------------------------------------------

async def purge_deleted(db: Session, now: datetime, dry_run: bool, report: CleanupReport) -> None:
    """Kasuje ze Storage pliki z `deleted_at` starszym niz RETENTION_DAYS (po ponownym sprawdzeniu odwolan)."""
    cutoff = now - timedelta(days=RETENTION_DAYS)
    due: dict[int, list[BoardFile]] = {}
    for row in db.query(BoardFile).filter(BoardFile.deleted_at.isnot(None), BoardFile.deleted_at < cutoff):
        due.setdefault(row.board_id, []).append(row)

    for board_id, rows in due.items():
        board_exists = bool(db.query(Board.id).filter(Board.id == board_id).first())
        snapshot = _snapshot(db, board_id) if board_exists else None
        # Odwolanie pojawilo sie po oznaczeniu (np. falszywa sierota) -> plik wraca do uzycia.
        keep = [row for row in rows if board_exists and _referenced(snapshot, row.file_name)]
        remove = [row for row in rows if row not in keep]

        if keep:
            report.add("restored", len(keep))
            if not dry_run:
                for row in keep:
                    row.deleted_at = None
                db.commit()

        for start in range(0, len(remove), PURGE_BATCH):
            batch = remove[start:start + PURGE_BATCH]
            if dry_run:
                report.add("purged_files", len(batch))
                continue
            if not await delete_objects(BOARD_FILES_BUCKET, [f"{board_id}/{row.file_name}" for row in batch]):
                report.add("purge_failed", len(batch))
                continue
            freed = sum(row.size_bytes for row in batch)
            for row in batch:
                db.delete(row)
            db.commit()
            report.add("purged_files", len(batch))
            report.add("purged_bytes", freed)
        if remove and not dry_run and not board_exists:
            await delete_board_usage_counters(board_id)


# -- 5. awatary ------------------------------------------------------------------------------------------

async def cleanup_avatars(db: Session, now: datetime, dry_run: bool, report: CleanupReport) -> None:
    """Obiekty `avatars/` bez zadnego `users.avatar_url` (starsze niz AVATAR_GRACE_DAYS) sa kasowane."""
    listing = await list_folder(AVATAR_BUCKET)
    if listing is None:
        report.errors.append("cleanup_avatars: nie udalo sie wylistowac bucketu avatars")
        return
    report.totals["avatars_objects"] = len(listing[0])
    report.totals["avatars_bytes"] = sum(obj.size for obj in listing[0])
    used = set()
    for (url,) in db.query(User.avatar_url).filter(User.avatar_url.isnot(None)):
        path = object_path_from_public_url(AVATAR_BUCKET, url)
        if path:
            used.add(path)
    cutoff = now - timedelta(days=AVATAR_GRACE_DAYS)
    # Bez daty utworzenia nie wiemy, czy plik jest nowy - zostawiamy.
    stale = [obj for obj in listing[0] if obj.path not in used and obj.created_at and obj.created_at < cutoff]
    if not stale or not _mass_guard("cleanup_avatars", len(stale), len(listing[0]), report):
        return
    report.add("avatars_removed", len(stale))
    if dry_run:
        return
    for start in range(0, len(stale), PURGE_BATCH):
        if not await delete_objects(AVATAR_BUCKET, [obj.path for obj in stale[start:start + PURGE_BATCH]]):
            report.add("avatars_failed", len(stale[start:start + PURGE_BATCH]))


# -- 6. baza ---------------------------------------------------------------------------------------------

def cleanup_database(db: Session, now: datetime, dry_run: bool, report: CleanupReport) -> None:
    """Przeczytane powiadomienia >30 dni, wszystkie >90 dni, zaproszenia i linki 30 dni po terminie."""
    read_cutoff = now - timedelta(days=NOTIFICATION_READ_DAYS)
    any_cutoff = now - timedelta(days=NOTIFICATION_ANY_DAYS)
    expired_cutoff = now - timedelta(days=EXPIRED_AFTER_DAYS)

    queries = {
        "notifications_removed": db.query(Notification).filter(or_(
            Notification.created_at < any_cutoff,
            (Notification.is_read.is_(True))
            & (func.coalesce(Notification.read_at, Notification.created_at) < read_cutoff),
        )),
        "invites_removed": db.query(WorkspaceInvite).filter(WorkspaceInvite.expires_at < expired_cutoff),
        "share_links_removed": db.query(WorkspaceShareLink).filter(or_(
            WorkspaceShareLink.expires_at < expired_cutoff,
            WorkspaceShareLink.revoked_at < expired_cutoff,
        )),
    }
    for name, query in queries.items():
        count = query.count()
        if not count:
            continue
        report.add(name, count)
        if not dry_run:
            query.delete(synchronize_session=False)
    if not dry_run:
        db.commit()


# -- przebieg ----------------------------------------------------------------------------------------------

async def _step(name: str, report: CleanupReport, db: Session, call) -> None:
    try:
        result = call()
        if asyncio.iscoroutine(result):
            await result
    except Exception:
        db.rollback()
        logger.exception(f"Sprzatanie Storage: krok {name} nieudany")
        report.errors.append(f"{name}: wyjatek (szczegoly w logu)")


async def _acquire_lock() -> str | None:
    """Token blokady; None = inny przebieg trwa. Brak Redis nie blokuje (kroki sa idempotentne)."""
    token = secrets.token_hex(8)
    try:
        if await redis_client_module.get_redis_client().set(LOCK_KEY, token, nx=True, ex=LOCK_TTL_SECONDS):
            return token
        return None
    except RedisError:
        logger.warning("Sprzatanie Storage: Redis niedostepny - przebieg bez blokady")
        return ""


async def _release_lock(token: str) -> None:
    if not token:
        return
    try:
        redis = redis_client_module.get_redis_client()
        if await redis.get(LOCK_KEY) == token:
            await redis.delete(LOCK_KEY)
    except RedisError:
        pass


async def last_report() -> dict | None:
    """Raport ostatniego przebiegu (dla endpointu admina); None = jeszcze nie bylo albo Redis niedostepny."""
    try:
        raw = await redis_client_module.get_redis_client().get(LAST_REPORT_KEY)
    except RedisError:
        return None
    try:
        return json.loads(raw) if raw else None
    except ValueError:
        return None


async def run_cleanup(*, dry_run: bool = False, now: datetime | None = None, session_factory=None) -> dict:
    """Jeden pelny przebieg sprzatania. Zwraca raport (dict); nie rzuca wyjatkow z krokow."""
    now = now or utcnow()
    report = CleanupReport(dry_run=dry_run, started_at=now.isoformat())
    token = await _acquire_lock()
    if token is None:
        report.skipped = "inny przebieg trwa"
        return report.as_dict()

    db = (session_factory or SessionLocal)()
    try:
        await _step("sync_registry", report, db, lambda: sync_registry(db, now, dry_run, report))
        await _step("mark_vanished_boards", report, db, lambda: mark_vanished_boards(db, now, dry_run, report))
        await _step("mark_orphans", report, db, lambda: mark_orphans(db, now, dry_run, report))
        await _step("purge_deleted", report, db, lambda: purge_deleted(db, now, dry_run, report))
        await _step("cleanup_avatars", report, db, lambda: cleanup_avatars(db, now, dry_run, report))
        await _step("cleanup_database", report, db, lambda: cleanup_database(db, now, dry_run, report))
    finally:
        db.close()
        await _release_lock(token)

    report.finished_at = utcnow().isoformat()
    logger.info(f"Sprzatanie Storage zakonczone (dry_run={dry_run}): {report.counts}, bledy: {report.errors}")
    if not dry_run:
        try:
            await redis_client_module.get_redis_client().set(LAST_REPORT_KEY, json.dumps(report.as_dict()))
        except RedisError:
            logger.warning("Sprzatanie Storage: nie udalo sie zapisac raportu w Redis")
    return report.as_dict()


# -- petla w procesie ----------------------------------------------------------------------------------

LOOP_CHECK_SECONDS = 3600


async def _is_due(interval: timedelta) -> bool:
    """Czy od ostatniego (nie-dry) przebiegu minal interwal. Brak raportu albo Redis = tak."""
    previous = await last_report()
    finished = previous.get("finished_at") if previous else None
    if not finished:
        return True
    try:
        return utcnow() - datetime.fromisoformat(finished) >= interval
    except ValueError:
        return True


async def cleanup_loop() -> None:
    """Co godzine sprawdza, czy pora na przebieg (domyslnie raz na 24 h - restart procesu nic nie zmienia)."""
    settings = get_settings()
    interval = timedelta(hours=max(settings.storage_cleanup_interval_hours, 1))
    await asyncio.sleep(max(settings.storage_cleanup_initial_delay_minutes, 0) * 60)
    while True:
        try:
            if await _is_due(interval):
                await run_cleanup()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Sprzatanie Storage: petla zlapala wyjatek")
        await asyncio.sleep(LOOP_CHECK_SECONDS)
