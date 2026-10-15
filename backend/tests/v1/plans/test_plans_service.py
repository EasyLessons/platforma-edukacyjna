"""
Testy limitów planów (free / premium)
api/v1/plans/service.py + egzekwowanie w boards/workspaces service

Decyzja A (01.10.2026): free = 2 własne przestrzenie, 3 tablice w jednej przestrzeni
(wg planu WŁAŚCICIELA przestrzeni), 1000 elementów (egzekwuje whiteboard-sync).
"""
import pytest
from datetime import datetime

from api.v1.plans.service import PlanService
from api.v1.plans.models import UserPlan
from api.v1.plans.limits import PLAN_LIMITS
from api.v1.boards.service import BoardService
from api.v1.boards.schemas import CreateBoard, UpdateBoard
from api.v1.onboarding.service import OnboardingService
from api.v1.workspaces.service import WorkspaceService
from api.v1.workspaces.schemas import WorkspaceCreate
from core.exceptions import AppException, PlanLimitError
from core.models import Board, BoardUsers, Workspace, WorkspaceMember


# -- helpers -----------------------------------------------------------------

def grant_premium(db, user_id: int) -> None:
    db.add(UserPlan(user_id=user_id, plan="premium"))
    db.commit()


def add_board(db, workspace_id: int, user_id: int, name: str = "B") -> Board:
    board = Board(
        name=name, icon="PenTool", bg_color="bg-gray-500",
        workspace_id=workspace_id, created_by=user_id,
        created_at=datetime.utcnow(), last_modified=datetime.utcnow(),
        last_modified_by=user_id,
    )
    db.add(board)
    db.flush()
    db.add(BoardUsers(board_id=board.id, user_id=user_id, is_favourite=False))
    db.commit()
    return board


def add_workspace(db, owner_id: int, name: str) -> Workspace:
    ws = Workspace(name=name, created_by=owner_id, created_at=datetime.utcnow())
    db.add(ws)
    db.flush()
    db.add(WorkspaceMember(
        workspace_id=ws.id, user_id=owner_id, role="owner",
        is_favourite=False, joined_at=datetime.utcnow(),
    ))
    db.commit()
    return ws


def board_data(workspace_id: int, name: str = "Nowa") -> CreateBoard:
    return CreateBoard(name=name, workspace_id=workspace_id)


# -- plan / limity -----------------------------------------------------------

class TestPlanLookup:

    def test_brak_wiersza_to_free(self, db_session, test_user):
        service = PlanService(db_session)
        assert service.get_plan(test_user.id) == "free"
        assert service.is_premium(test_user.id) is False
        assert service.get_limits(test_user.id) == PLAN_LIMITS["free"]

    def test_wiersz_premium(self, db_session, test_user):
        grant_premium(db_session, test_user.id)
        service = PlanService(db_session)
        assert service.get_plan(test_user.id) == "premium"
        assert service.is_premium(test_user.id) is True
        assert service.get_limits(test_user.id).max_boards_per_workspace is None

    def test_limity_free_zgodne_z_decyzja(self):
        free = PLAN_LIMITS["free"]
        assert free.max_own_workspaces == 2
        assert free.max_boards_per_workspace == 3
        assert free.max_elements_per_board == 1000

    def test_limity_premium_bez_ograniczen(self):
        premium = PLAN_LIMITS["premium"]
        assert premium.max_own_workspaces is None
        assert premium.max_boards_per_workspace is None
        assert premium.max_elements_per_board is None


# -- przestrzenie ------------------------------------------------------------

class TestWorkspaceLimit:

    def test_free_dwie_przestrzenie_ok(self, db_session, test_user):
        service = WorkspaceService(db_session)
        service.create_workspace(WorkspaceCreate(name="Pierwsza"), test_user.id)
        result = service.create_workspace(WorkspaceCreate(name="Druga"), test_user.id)
        assert result.name == "Druga"

    def test_free_trzecia_przestrzen_403(self, db_session, test_user, test_workspace):
        service = WorkspaceService(db_session)
        service.create_workspace(WorkspaceCreate(name="Druga"), test_user.id)
        with pytest.raises(PlanLimitError) as exc:
            service.create_workspace(WorkspaceCreate(name="Trzecia"), test_user.id)
        assert exc.value.status_code == 403
        assert exc.value.code == "PLAN_LIMIT_WORKSPACES"
        assert exc.value.details == {"limit": 2, "used": 2}
        assert db_session.query(Workspace).filter(Workspace.name == "Trzecia").first() is None

    def test_cudza_przestrzen_nie_liczy_sie(self, db_session, test_user, test_user2, test_workspace2):
        """Członkostwo w cudzych przestrzeniach nie ma limitu."""
        db_session.add(WorkspaceMember(
            workspace_id=test_workspace2.id, user_id=test_user.id,
            role="editor", is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.commit()
        service = WorkspaceService(db_session)
        service.create_workspace(WorkspaceCreate(name="Własna 1"), test_user.id)
        result = service.create_workspace(WorkspaceCreate(name="Własna 2"), test_user.id)
        assert result.is_owner is True

    def test_premium_bez_limitu(self, db_session, test_user, test_workspace):
        grant_premium(db_session, test_user.id)
        service = WorkspaceService(db_session)
        for i in range(4):
            service.create_workspace(WorkspaceCreate(name=f"WS{i}"), test_user.id)
        assert PlanService(db_session).count_own_workspaces(test_user.id) == 5

    def test_grandfathering_istniejace_ponad_limit_dzialaja(self, db_session, test_user, multiple_workspaces):
        """10 przestrzeni (ponad limit) - lista, edycja i usuwanie działają, nowa nie powstaje."""
        service = WorkspaceService(db_session)
        assert len(service.get_user_workspaces(test_user.id)) == 10
        with pytest.raises(PlanLimitError):
            service.create_workspace(WorkspaceCreate(name="Kolejna"), test_user.id)


# -- tablice -----------------------------------------------------------------

class TestBoardLimit:

    @pytest.mark.asyncio
    async def test_free_trzy_tablice_ok(self, db_session, test_user, test_workspace):
        service = BoardService(db_session)
        for i in range(3):
            await service.create_board(board_data(test_workspace.id, f"T{i}"), test_user.id)
        assert PlanService(db_session).count_workspace_boards(test_workspace.id) == 3

    @pytest.mark.asyncio
    async def test_free_czwarta_tablica_403(self, db_session, test_user, test_workspace):
        for i in range(3):
            add_board(db_session, test_workspace.id, test_user.id, f"T{i}")
        service = BoardService(db_session)
        with pytest.raises(PlanLimitError) as exc:
            await service.create_board(board_data(test_workspace.id, "Czwarta"), test_user.id)
        assert exc.value.status_code == 403
        assert exc.value.code == "PLAN_LIMIT_BOARDS"
        assert exc.value.details == {"limit": 3, "used": 3, "workspace_id": test_workspace.id}
        assert db_session.query(Board).filter(Board.name == "Czwarta").first() is None

    @pytest.mark.asyncio
    async def test_limit_jest_na_przestrzen_nie_globalny(self, db_session, test_user, test_workspace):
        """3 tablice w przestrzeni A nie blokują tworzenia w przestrzeni B."""
        ws_b = add_workspace(db_session, test_user.id, "B")
        for i in range(3):
            add_board(db_session, test_workspace.id, test_user.id, f"A{i}")
        result = await BoardService(db_session).create_board(board_data(ws_b.id, "B1"), test_user.id)
        assert result.workspace_id == ws_b.id

    @pytest.mark.asyncio
    async def test_tablice_edytora_licza_sie_do_limitu_przestrzeni(
        self, db_session, test_user, test_user2, shared_workspace
    ):
        for i in range(3):
            add_board(db_session, shared_workspace.id, test_user2.id, f"E{i}")
        with pytest.raises(PlanLimitError) as exc:
            await BoardService(db_session).create_board(board_data(shared_workspace.id, "Moja"), test_user.id)
        assert exc.value.code == "PLAN_LIMIT_BOARDS"

    @pytest.mark.asyncio
    async def test_editor_nie_tworzy_tablicy_403_roli_przed_limitem(
        self, db_session, test_user2, shared_workspace
    ):
        """Decyzja B ma pierwszeństwo: editor dostaje zwykłe 403, nie PLAN_LIMIT_*."""
        with pytest.raises(AppException) as exc:
            await BoardService(db_session).create_board(board_data(shared_workspace.id), test_user2.id)
        assert exc.value.status_code == 403
        assert not isinstance(exc.value, PlanLimitError)

    @pytest.mark.asyncio
    async def test_limit_wedlug_planu_wlasciciela_premium(
        self, db_session, test_user, shared_workspace
    ):
        """Właściciel Premium: bez limitu tablic w swojej przestrzeni."""
        grant_premium(db_session, test_user.id)
        service = BoardService(db_session)
        for i in range(5):
            await service.create_board(board_data(shared_workspace.id, f"P{i}"), test_user.id)
        assert PlanService(db_session).count_workspace_boards(shared_workspace.id) == 5

    def test_limit_wedlug_planu_wlasciciela_a_nie_tworzacego(
        self, db_session, test_user, test_user2, shared_workspace
    ):
        """Premium po stronie editora nie zwiększa limitu przestrzeni właściciela Free."""
        grant_premium(db_session, test_user2.id)
        for i in range(3):
            add_board(db_session, shared_workspace.id, test_user.id, f"T{i}")
        with pytest.raises(PlanLimitError):
            PlanService(db_session).ensure_can_create_board(shared_workspace)

    @pytest.mark.asyncio
    async def test_grandfathering_tablice_ponad_limit_dzialaja(
        self, db_session, test_user, test_workspace, multiple_boards
    ):
        """15 tablic (ponad limit): lista, odczyt, zmiana nazwy i usunięcie działają; nowa nie powstaje."""
        service = BoardService(db_session)
        listing = await service.list_boards(test_workspace.id, test_user.id, limit=50)
        assert listing.total == 15
        first = multiple_boards[0]
        assert (await service.get_board(first.id, test_user.id)).id == first.id
        renamed = await service.update_board(first.id, UpdateBoard(name="Zmiana"), test_user.id)
        assert renamed.name == "Zmiana"
        await service.delete_board(first.id, test_user.id)
        with pytest.raises(PlanLimitError):
            await service.create_board(board_data(test_workspace.id, "Nowa"), test_user.id)


# -- onboarding --------------------------------------------------------------

class TestOnboarding:

    def test_starter_liczy_sie_do_limitu_ale_go_nie_omija(self, db_session, test_user):
        """Nowy user startuje z 1/2 przestrzeni i 1/3 tablic; onboarding nie sprawdza limitu."""
        OnboardingService(db_session).setup_new_user(test_user.id)
        db_session.commit()
        plans = PlanService(db_session)
        assert plans.count_own_workspaces(test_user.id) == 1
        by_ws = plans.boards_by_own_workspace(test_user.id)
        assert list(by_ws.values()) == [1]


# -- GET /plans/me (warstwa service) -----------------------------------------

class TestGetMe:

    def test_free_z_uzyciem(self, db_session, test_user, test_workspace):
        add_board(db_session, test_workspace.id, test_user.id, "A")
        add_board(db_session, test_workspace.id, test_user.id, "B")
        add_workspace(db_session, test_user.id, "Pusta")
        me = PlanService(db_session).get_me(test_user.id)
        assert me.plan == "free"
        assert me.limits.max_boards_per_workspace == 3
        assert me.limits.max_own_workspaces == 2
        assert me.limits.max_elements_per_board == 1000
        assert me.usage.own_workspaces == 2
        assert me.usage.boards_by_workspace[str(test_workspace.id)] == 2
        assert sorted(me.usage.boards_by_workspace.values()) == [0, 2]

    def test_premium(self, db_session, test_user):
        grant_premium(db_session, test_user.id)
        me = PlanService(db_session).get_me(test_user.id)
        assert me.plan == "premium"
        assert me.limits.max_boards_per_workspace is None
        assert me.usage.own_workspaces == 0
        assert me.usage.boards_by_workspace == {}
