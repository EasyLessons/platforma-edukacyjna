"""
Podglad zajetosci Storage dla admina: GET /api/v1/whiteboard/storage/usage.

W stylu `GET /whiteboard/call/usage` (whiteboard/call_usage.py): ten sam krag adminow
(`CALL_ADMIN_USER_IDS`), osobny kubelek limitu zadan, odpowiedz bez sekretow.

Skad liczby:
  * rejestr `board_files` - zajetosc wg kont (aktywne pliki i takie, ktore czekaja na skasowanie),
  * ostatni przebieg sprzatania (Redis) - pomiar prawdziwego Storage: bajty bucketow
    `board-files` i `avatars`. Bez dodatkowych zapytan do Supabase przy kazdym wejsciu na ekran.
Stary silnik (`board-images`) nie jest mierzony - nie ma rejestru i listing bylby kosztowny.

Ocena wzgledem budzetu (plan Supabase Free = 1 GB): od 70% `warning`, od 90% `critical`;
w obu stanach `hint` przypomina o decyzji Patryka (12.10.2026): przy zblizaniu sie do 1 GB
rozwazyc Cloudflare R2 (10 GB free) zamiast Supabase Pro.
"""
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.v1.plans.limits import GB, get_limits
from api.v1.plans.models import UserPlan
from api.v1.whiteboard import call_guard as guard
from core.exceptions import AppException
from core.models import User

from .cleanup import last_report
from .models import BoardFile
from .schemas import OwnerUsage, StorageUsageResponse

SUPABASE_FREE_BUDGET_BYTES = 1 * GB
WARNING_RATIO = 0.7
CRITICAL_RATIO = 0.9
TOP_OWNERS = 10
USAGE_RATE_LIMIT_SCOPE = "storage-usage"

R2_HINT = (
    "Zajętość zbliża się do limitu 1 GB planu Supabase Free. Zgodnie z decyzją z 12.10.2026 "
    "rozważ Cloudflare R2 (10 GB za darmo) zamiast Supabase Pro - pliki idą przez backend, "
    "więc zmiana magazynu jest niewidoczna dla frontu."
)


def _state(estimated_bytes: int) -> str:
    ratio = estimated_bytes / SUPABASE_FREE_BUDGET_BYTES
    if ratio >= CRITICAL_RATIO:
        return "critical"
    return "warning" if ratio >= WARNING_RATIO else "ok"


def _owner_rows(db: Session) -> list[OwnerUsage]:
    """Konta z aktywnymi plikami, od najwiekszego; plan i limit kazdego."""
    grouped = (
        db.query(BoardFile.owner_id, func.sum(BoardFile.size_bytes), func.count(BoardFile.id))
        .filter(BoardFile.deleted_at.is_(None))
        .group_by(BoardFile.owner_id)
        .order_by(func.sum(BoardFile.size_bytes).desc())
        .all()
    )
    owner_ids = [int(owner_id) for owner_id, _, _ in grouped]
    plans = {int(uid): plan for uid, plan in db.query(UserPlan.user_id, UserPlan.plan).filter(UserPlan.user_id.in_(owner_ids))}
    names = {int(uid): username for uid, username in db.query(User.id, User.username).filter(User.id.in_(owner_ids))}
    result = []
    for owner_id, total, files in grouped:
        owner_id = int(owner_id)
        plan = plans.get(owner_id, "free")
        limit = get_limits(plan).max_storage_bytes
        used = int(total or 0)
        result.append(OwnerUsage(
            user_id=owner_id,
            username=names.get(owner_id),
            plan=plan,
            files=int(files),
            used_bytes=used,
            limit_bytes=limit,
            percent=round(used * 100 / limit, 1) if limit else None,
        ))
    return result


async def usage_report(db: Session, user_id: int) -> StorageUsageResponse:
    """Zajetosc Storage dla admina (CALL_ADMIN_USER_IDS)."""
    if not guard.is_call_admin(user_id):
        raise AppException("Brak dostępu", code="FORBIDDEN", status_code=403)
    await guard.enforce_user_rate_limit(user_id, USAGE_RATE_LIMIT_SCOPE)

    active_files, active_bytes = db.query(
        func.count(BoardFile.id), func.coalesce(func.sum(BoardFile.size_bytes), 0)
    ).filter(BoardFile.deleted_at.is_(None)).one()
    pending_files, pending_bytes = db.query(
        func.count(BoardFile.id), func.coalesce(func.sum(BoardFile.size_bytes), 0)
    ).filter(BoardFile.deleted_at.isnot(None)).one()
    owners = _owner_rows(db)

    cleanup = await last_report()
    totals = (cleanup or {}).get("totals") or {}
    board_files_bytes = totals.get("board_files_bytes")
    avatars_bytes = totals.get("avatars_bytes")
    # Rejestr bywa niepelny (pliki sprzed rejestru, zanim job je dopisze) - bierzemy wiekszy odczyt.
    registry_bytes = int(active_bytes) + int(pending_bytes)
    estimated = max(registry_bytes, board_files_bytes or 0) + (avatars_bytes or 0)
    state = _state(estimated)

    return StorageUsageResponse(
        state=state,
        hint=R2_HINT if state != "ok" else None,
        budget_bytes=SUPABASE_FREE_BUDGET_BYTES,
        estimated_bytes=estimated,
        percent_of_budget=round(estimated * 100 / SUPABASE_FREE_BUDGET_BYTES, 1),
        registry_files=int(active_files),
        registry_bytes=int(active_bytes),
        pending_delete_files=int(pending_files),
        pending_delete_bytes=int(pending_bytes),
        measured_board_files_bytes=board_files_bytes,
        measured_avatars_bytes=avatars_bytes,
        measured_at=(cleanup or {}).get("finished_at"),
        accounts_with_files=len(owners),
        accounts_over_limit=sum(1 for o in owners if o.limit_bytes is not None and o.used_bytes > o.limit_bytes),
        top_accounts=owners[:TOP_OWNERS],
        last_cleanup=cleanup,
    )
