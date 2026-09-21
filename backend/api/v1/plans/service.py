"""
PlanService — odczyt planu użytkownika, liczenie zużycia i egzekwowanie limitów.

Egzekwowanie odbywa się w warstwie service innych modułów:
  - workspaces/service.py  create_workspace()  -> ensure_can_create_workspace()
  - boards/service.py      create_board()      -> ensure_can_create_board()
  - boards/service.py      get_board()         -> board_read_only_state()

ZASADY LICZENIA (decyzja Patryka, 22.09.2026):
  - own_workspaces: workspace'y, których user jest twórcą (`workspaces.created_by`).
  - boards: tablice utworzone przez usera W JEGO WŁASNYCH workspace'ach.
    Tablice tworzone w cudzych workspace'ach nie liczą się do limitu twórcy
    (limit jest "per własne workspace'y"), a tworzenie tablicy w cudzym
    workspace'ie nie jest w ogóle sprawdzane pod kątem planu twórcy.
  - elementy: liczone z tabeli `board_elements` (model legacy, is_deleted != true).
    Limit elementów obowiązuje wg planu WŁAŚCICIELA WORKSPACE'U tablicy.
    Przy tablicach synchronizowanych przez Yjs (whiteboard-sync) elementy nie
    trafiają do `board_elements` — patrz TODO w docs/plan-subskrypcje.md.

Ten moduł NIE importuje boards/workspaces (uniknięcie cyklu importów) —
korzysta wyłącznie z modeli z core.models.
"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.exceptions import PlanLimitError
from core.models import Board, BoardElement, Workspace

from .limits import DEFAULT_PLAN, PlanLimits, get_limits
from .models import PLAN_PREMIUM, UserPlan
from .schemas import PlanLimitsResponse, PlanMeResponse, PlanUsageResponse

READ_ONLY_REASON_ELEMENTS = "PLAN_LIMIT_ELEMENTS"


class PlanService:
    def __init__(self, db: Session):
        self.db = db

    # ── odczyt planu ─────────────────────────────────────────────────────────

    def get_plan(self, user_id: int) -> str:
        """Nazwa planu usera; brak wiersza w user_plans == free."""
        row = self.db.get(UserPlan, user_id)
        return row.plan if row else DEFAULT_PLAN

    def get_limits(self, user_id: int) -> PlanLimits:
        return get_limits(self.get_plan(user_id))

    def is_premium(self, user_id: int) -> bool:
        return self.get_plan(user_id) == PLAN_PREMIUM

    # ── zużycie ──────────────────────────────────────────────────────────────

    def count_own_workspaces(self, user_id: int) -> int:
        stmt = select(func.count(Workspace.id)).where(Workspace.created_by == user_id)
        return int(self.db.execute(stmt).scalar_one())

    def count_own_boards(self, user_id: int) -> int:
        """Tablice utworzone przez usera w workspace'ach, których jest właścicielem."""
        stmt = (
            select(func.count(Board.id))
            .join(Workspace, Workspace.id == Board.workspace_id)
            .where(Board.created_by == user_id, Workspace.created_by == user_id)
        )
        return int(self.db.execute(stmt).scalar_one())

    def count_board_elements(self, board_id: int) -> int:
        """Nieusunięte elementy tablicy (model legacy `board_elements`)."""
        stmt = select(func.count(BoardElement.id)).where(
            BoardElement.board_id == board_id,
            BoardElement.is_deleted.isnot(True),
        )
        return int(self.db.execute(stmt).scalar_one())

    # ── egzekwowanie ─────────────────────────────────────────────────────────

    def ensure_can_create_workspace(self, user_id: int) -> None:
        limits = self.get_limits(user_id)
        if limits.max_own_workspaces is None:
            return
        used = self.count_own_workspaces(user_id)
        if used >= limits.max_own_workspaces:
            raise PlanLimitError(
                f"Plan Free pozwala na {limits.max_own_workspaces} własny workspace. "
                "Przejdź na Premium, aby tworzyć kolejne.",
                code="PLAN_LIMIT_WORKSPACES",
                details={"limit": limits.max_own_workspaces, "used": used},
            )

    def ensure_can_create_board(self, user_id: int, workspace: Workspace) -> None:
        """Sprawdza limit tablic tylko gdy user tworzy tablicę we WŁASNYM workspace'ie."""
        if workspace.created_by != user_id:
            return
        limits = self.get_limits(user_id)
        if limits.max_boards is None:
            return
        used = self.count_own_boards(user_id)
        if used >= limits.max_boards:
            raise PlanLimitError(
                f"Plan Free pozwala na {limits.max_boards} tablice. "
                "Przejdź na Premium, aby tworzyć kolejne.",
                code="PLAN_LIMIT_BOARDS",
                details={"limit": limits.max_boards, "used": used},
            )

    def board_read_only_state(self, board: Board) -> tuple[bool, str | None]:
        """
        (read_only, read_only_reason) dla szczegółów tablicy.
        Limit elementów liczony wg planu właściciela workspace'u tablicy.
        """
        owner_id = board.workspace.created_by if board.workspace else board.created_by
        limits = self.get_limits(owner_id)
        if limits.max_elements_per_board is None:
            return False, None
        if self.count_board_elements(board.id) > limits.max_elements_per_board:
            return True, READ_ONLY_REASON_ELEMENTS
        return False, None

    # ── GET /plans/me ────────────────────────────────────────────────────────

    def get_me(self, user_id: int) -> PlanMeResponse:
        plan = self.get_plan(user_id)
        limits = get_limits(plan)
        return PlanMeResponse(
            plan=plan,
            limits=PlanLimitsResponse(**limits.as_dict()),
            usage=PlanUsageResponse(
                own_workspaces=self.count_own_workspaces(user_id),
                boards=self.count_own_boards(user_id),
            ),
        )
