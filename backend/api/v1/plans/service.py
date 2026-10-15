"""
PlanService - odczyt planu użytkownika, liczenie zużycia i egzekwowanie limitów.

Egzekwowanie odbywa się w warstwie service innych modułów:
  - workspaces/service.py  create_workspace()  -> ensure_can_create_workspace()
  - boards/service.py      create_board()      -> ensure_can_create_board()
Limit elementów tablicy egzekwuje whiteboard-sync (PR 3), limit bierze z `/access`.

ZASADY LICZENIA (decyzja A, Patryk, 01.10.2026):
  - własne przestrzenie: `workspaces.created_by == user_id`; limit wg planu użytkownika.
  - tablice: liczba tablic w DANEJ przestrzeni (niezależnie od `boards.created_by`);
    limit wg planu WŁAŚCICIELA tej przestrzeni, sprawdzany zawsze.
  - grandfathering: limity sprawdzane tylko przy tworzeniu; istniejące zasoby ponad limitem
    zostają i działają normalnie.

WYŚCIG RÓWNOLEGŁYCH ŻĄDAŃ: przed `count` blokujemy wiersz nadrzędny (`FOR UPDATE` na
Workspace / User) w tej samej transakcji, trzymany do `commit()` w serwisie wołającym.
SQLite (testy) ignoruje FOR UPDATE.

Ten moduł NIE importuje boards/workspaces (uniknięcie cyklu importów) -
korzysta wyłącznie z modeli z core.models.
"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.exceptions import PlanLimitError
from core.models import Board, User, Workspace

from .limits import DEFAULT_PLAN, PlanLimits, get_limits
from .models import PLAN_PREMIUM, UserPlan
from .schemas import PlanLimitsResponse, PlanMeResponse, PlanUsageResponse


class PlanService:
    def __init__(self, db: Session):
        self.db = db

    # -- odczyt planu ----------------------------------------------------

    def get_plan(self, user_id: int) -> str:
        """Nazwa planu usera; brak wiersza w user_plans == free."""
        row = self.db.get(UserPlan, user_id)
        return row.plan if row else DEFAULT_PLAN

    def get_limits(self, user_id: int) -> PlanLimits:
        return get_limits(self.get_plan(user_id))

    def is_premium(self, user_id: int) -> bool:
        return self.get_plan(user_id) == PLAN_PREMIUM

    # -- zużycie ---------------------------------------------------------

    def count_own_workspaces(self, user_id: int) -> int:
        stmt = select(func.count(Workspace.id)).where(Workspace.created_by == user_id)
        return int(self.db.execute(stmt).scalar_one())

    def count_workspace_boards(self, workspace_id: int) -> int:
        """Wszystkie tablice w przestrzeni, bez względu na twórcę."""
        stmt = select(func.count(Board.id)).where(Board.workspace_id == workspace_id)
        return int(self.db.execute(stmt).scalar_one())

    def boards_by_own_workspace(self, user_id: int) -> dict[int, int]:
        """id własnej przestrzeni -> liczba tablic (przestrzenie bez tablic: 0)."""
        stmt = (
            select(Workspace.id, func.count(Board.id))
            .outerjoin(Board, Board.workspace_id == Workspace.id)
            .where(Workspace.created_by == user_id)
            .group_by(Workspace.id)
        )
        return {int(ws_id): int(n) for ws_id, n in self.db.execute(stmt).all()}

    # -- egzekwowanie ----------------------------------------------------

    def ensure_can_create_workspace(self, user_id: int) -> None:
        limits = self.get_limits(user_id)
        if limits.max_own_workspaces is None:
            return
        # Blokada wiersza usera: równoległe POST /workspaces nie przejdą oba przy N-1/N.
        self.db.query(User).filter(User.id == user_id).with_for_update().one_or_none()
        used = self.count_own_workspaces(user_id)
        if used >= limits.max_own_workspaces:
            raise PlanLimitError(
                f"Plan Free pozwala na {limits.max_own_workspaces} własne przestrzenie. "
                "Przejdź na Premium, aby tworzyć kolejne.",
                code="PLAN_LIMIT_WORKSPACES",
                details={"limit": limits.max_own_workspaces, "used": used},
            )

    def ensure_can_create_board(self, workspace: Workspace) -> None:
        """Limit tablic w przestrzeni wg planu jej właściciela - sprawdzany dla każdego tworzącego."""
        limits = self.get_limits(workspace.created_by)
        if limits.max_boards_per_workspace is None:
            return
        # Blokada wiersza przestrzeni: równoległe POST /boards nie przejdą oba przy N-1/N.
        self.db.query(Workspace).filter(Workspace.id == workspace.id).with_for_update().one_or_none()
        used = self.count_workspace_boards(workspace.id)
        if used >= limits.max_boards_per_workspace:
            raise PlanLimitError(
                f"Plan Free pozwala na {limits.max_boards_per_workspace} tablice w jednej przestrzeni. "
                "Przejdź na Premium, aby tworzyć kolejne.",
                code="PLAN_LIMIT_BOARDS",
                details={
                    "limit": limits.max_boards_per_workspace,
                    "used": used,
                    "workspace_id": workspace.id,
                },
            )

    # -- GET /plans/me ---------------------------------------------------

    def get_me(self, user_id: int) -> PlanMeResponse:
        plan = self.get_plan(user_id)
        limits = get_limits(plan)
        by_ws = self.boards_by_own_workspace(user_id)
        return PlanMeResponse(
            plan=plan,
            limits=PlanLimitsResponse(**limits.as_dict()),
            usage=PlanUsageResponse(
                own_workspaces=self.count_own_workspaces(user_id),
                boards_by_workspace={str(k): v for k, v in by_ws.items()},
            ),
        )
