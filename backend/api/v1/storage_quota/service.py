"""
Limit miejsca na pliki tablic na konto wlasciciela przestrzeni + ksiegowanie w `board_files`.

ZASADY (decyzje Patryka z 12.10.2026):
  * limit: Free 100 MB, Premium 5 GB (plans/limits.py: max_storage_bytes), wg planu
    WLASCICIELA przestrzeni - tak jak pozostale limity planow,
  * po przekroczeniu blokujemy WYLACZNIE dodawanie nowych plikow; przegladanie, usuwanie
    i edycja dzialaja (grandfathering: konto ponad limitem nic nie traci, tylko nie dolozy),
  * pliki wspolne (arkusze CKE, karty wzorow) nie sa w Storage ani w rejestrze,
  * do limitu liczy sie suma `size_bytes` wierszy BEZ `deleted_at` (pliki czekajace na
    skasowanie zwalniaja miejsce od razu; fizycznie usuwa je job: cleanup.py).

DWA SPRAWDZENIA UPLOADU (files.py):
  1. `ensure_can_upload` PRZED czytaniem ciala - gdy konto jest juz na limicie, odrzucamy
     od razu (tani przypadek, bez 5 MB w RAM),
  2. `record_upload` PO zapisie w Storage - pod blokada wiersza wlasciciela
     (`FOR UPDATE`) liczy sume jeszcze raz i dopiero wtedy dopisuje plik. Tylko to sprawdzenie
     jest autorytatywne: rownolegle uploady nie przekrocza limitu, najwyzej jeden z nich
     zapisze plik w Storage na darmo i dostanie `False` (wolajacy kasuje obiekt).
     SQLite w testach ignoruje FOR UPDATE.
"""
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.v1.plans.service import PlanService
from core.exceptions import PlanLimitError
from core.models import User
from core.time import utcnow

from .models import BoardFile


def used_bytes(db: Session, owner_id: int) -> int:
    """Miejsce zajete przez konto (bez plikow czekajacych na skasowanie)."""
    stmt = select(func.coalesce(func.sum(BoardFile.size_bytes), 0)).where(
        BoardFile.owner_id == owner_id, BoardFile.deleted_at.is_(None)
    )
    return int(db.execute(stmt).scalar_one())


def storage_limit(db: Session, owner_id: int) -> int | None:
    """Limit miejsca wg planu wlasciciela (None = bez limitu)."""
    return PlanService(db).get_limits(owner_id).max_storage_bytes


def _limit_error(limit: int, used: int) -> PlanLimitError:
    return PlanLimitError(
        "Ta przestrzeń wykorzystała limit miejsca na pliki. "
        "Usuń niepotrzebne tablice albo poproś właściciela o plan Premium.",
        code="PLAN_LIMIT_STORAGE",
        details={"limit_bytes": limit, "used_bytes": used},
    )


def ensure_can_upload(db: Session, owner_id: int) -> None:
    """Odrzuca upload, gdy konto jest juz na limicie (sprawdzenie wstepne, przed czytaniem ciala)."""
    limit = storage_limit(db, owner_id)
    if limit is None:
        return
    used = used_bytes(db, owner_id)
    if used >= limit:
        raise _limit_error(limit, used)


def record_upload(db: Session, board_id: int, owner_id: int, file_name: str, size: int) -> bool:
    """
    Dopisuje zapisany plik do rejestru. False = plik NIE miesci sie w limicie (nic nie
    dopisano; wolajacy kasuje obiekt ze Storage i odpowiada `limit_error`).
    """
    limit = storage_limit(db, owner_id)
    # Blokada wiersza wlasciciela: rownolegle uploady jednego konta licza sume po kolei.
    db.query(User).filter(User.id == owner_id).with_for_update().one_or_none()
    if limit is not None and used_bytes(db, owner_id) + size > limit:
        db.rollback()
        return False
    db.add(BoardFile(board_id=board_id, owner_id=owner_id, file_name=file_name, size_bytes=size))
    db.commit()
    return True


def limit_error(db: Session, owner_id: int) -> PlanLimitError:
    """Blad `PLAN_LIMIT_STORAGE` z aktualnym limitem i zajetoscia (po `record_upload` == False)."""
    return _limit_error(storage_limit(db, owner_id) or 0, used_bytes(db, owner_id))


def mark_deleted(db: Session, board_ids: list[int], now: datetime | None = None) -> None:
    """
    Tablice usuniete (tablica albo cala przestrzen): pliki zwalniaja miejsce od razu, a ze
    Storage znikaja po okresie karencji (cleanup.py: RETENTION_DAYS) - tyle trwa "okno na pomylke".
    """
    if not board_ids:
        return
    db.query(BoardFile).filter(
        BoardFile.board_id.in_(board_ids), BoardFile.deleted_at.is_(None)
    ).update({BoardFile.deleted_at: now or utcnow()}, synchronize_session=False)
