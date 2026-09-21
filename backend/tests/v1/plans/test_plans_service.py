"""
Testy limitów planów (free / premium)
api/v1/plans/service.py + egzekwowanie w boards/workspaces service
"""
import pytest
from datetime import datetime

from api.v1.plans.service import PlanService
from api.v1.plans.models import UserPlan
from api.v1.plans.limits import PLAN_LIMITS
from api.v1.boards.service import BoardService
from api.v1.boards.schemas import CreateBoard
from api.v1.workspaces.service import WorkspaceService
from api.v1.workspaces.schemas import WorkspaceCreate
from core.exceptions import PlanLimitError
from core.models import Board, BoardElement, BoardUsers, Workspace, WorkspaceMember


# ── helpers ──────────────────────────────────────────────────────────────────

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


def add_elements(db, board_id: int, user_id: int, count: int, deleted: int = 0) -> None:
    for i in range(count):
        db.add(BoardElement(
            board_id=board_id, element_id=f"el-{board_id}-{i}", type="path",
            data={"i": i}, created_by=user_id, is_deleted=False,
        ))
    for i in range(deleted):
        db.add(BoardElement(
            board_id=board_id, element_id=f"del-{board_id}-{i}", type="path",
            data={"i": i}, created_by=user_id, is_deleted=True,
        ))
    db.commit()


def board_data(workspace_id: int, name: str = "Nowa") -> CreateBoard:
    return CreateBoard(name=name, workspace_id=workspace_id)


# ── plan / limity ────────────────────────────────────────────────────────────

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
        assert service.get_limits(test_user.id).max_boards is None

    def test_limity_free_zgodne_z_decyzja(self):
        free = PLAN_LIMITS["free"]
        assert free.max_own_workspaces == 1
        assert free.max_boards == 3
        assert free.max_elements_per_board == 300

    def test_limity_premium_bez_ograniczen(self):
        premium = PLAN_LIMITS["premium"]
        assert premium.max_own_workspaces is None
        assert premium.max_boards is None
        assert premium.max_elements_per_board is None


# ── workspace'y ──────────────────────────────────────────────────────────────

class TestWorkspaceLimit:

    def test_free_pierwszy_workspace_ok(self, db_session, test_user):
        service = WorkspaceService(db_session)
        result = service.create_workspace(WorkspaceCreate(name="Pierwszy"), test_user.id)
        assert result.name == "Pierwszy"

    def test_free_drugi_workspace_403(self, db_session, test_user, test_workspace):
        service = WorkspaceService(db_session)
        with pytest.raises(PlanLimitError) as exc:
            service.create_workspace(WorkspaceCreate(name="Drugi"), test_user.id)
        assert exc.value.status_code == 403
        assert exc.value.code == "PLAN_LIMIT_WORKSPACES"
        assert exc.value.details == {"limit": 1, "used": 1}
        assert db_session.query(Workspace).filter(Workspace.name == "Drugi").first() is None

    def test_cudzy_workspace_nie_liczy_sie(self, db_session, test_user, test_user2, test_workspace2):
        """test_user jest tylko członkiem workspace'u test_user2 — może utworzyć własny."""
        db_session.add(WorkspaceMember(
            workspace_id=test_workspace2.id, user_id=test_user.id,
            role="editor", is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.commit()
        service = WorkspaceService(db_session)
        result = service.create_workspace(WorkspaceCreate(name="Własny"), test_user.id)
        assert result.is_owner is True

    def test_premium_bez_limitu(self, db_session, test_user, test_workspace):
        grant_premium(db_session, test_user.id)
        service = WorkspaceService(db_session)
        for i in range(3):
            service.create_workspace(WorkspaceCreate(name=f"WS{i}"), test_user.id)
        assert PlanService(db_session).count_own_workspaces(test_user.id) == 4


# ── tablice ──────────────────────────────────────────────────────────────────

class TestBoardLimit:

    @pytest.mark.asyncio
    async def test_free_trzy_tablice_ok(self, db_session, test_user, test_workspace):
        service = BoardService(db_session)
        for i in range(3):
            await service.create_board(board_data(test_workspace.id, f"T{i}"), test_user.id)
        assert PlanService(db_session).count_own_boards(test_user.id) == 3

    @pytest.mark.asyncio
    async def test_free_czwarta_tablica_403(self, db_session, test_user, test_workspace):
        for i in range(3):
            add_board(db_session, test_workspace.id, test_user.id, f"T{i}")
        service = BoardService(db_session)
        with pytest.raises(PlanLimitError) as exc:
            await service.create_board(board_data(test_workspace.id, "Czwarta"), test_user.id)
        assert exc.value.status_code == 403
        assert exc.value.code == "PLAN_LIMIT_BOARDS"
        assert exc.value.details == {"limit": 3, "used": 3}
        assert db_session.query(Board).filter(Board.name == "Czwarta").first() is None

    @pytest.mark.asyncio
    async def test_limit_globalny_na_wlasne_workspacey(self, db_session, test_user, test_workspace):
        """3 tablice w dwóch własnych workspace'ach sumują się do limitu."""
        ws2 = Workspace(name="WS2", created_by=test_user.id, created_at=datetime.utcnow())
        db_session.add(ws2)
        db_session.flush()
        db_session.add(WorkspaceMember(
            workspace_id=ws2.id, user_id=test_user.id, role="owner",
            is_favourite=False, joined_at=datetime.utcnow(),
        ))
        db_session.commit()
        add_board(db_session, test_workspace.id, test_user.id, "A")
        add_board(db_session, test_workspace.id, test_user.id, "B")
        add_board(db_session, ws2.id, test_user.id, "C")

        service = BoardService(db_session)
        with pytest.raises(PlanLimitError) as exc:
            await service.create_board(board_data(ws2.id, "D"), test_user.id)
        assert exc.value.code == "PLAN_LIMIT_BOARDS"

    @pytest.mark.asyncio
    async def test_tablice_w_cudzym_workspace_nie_licza_sie(
        self, db_session, test_user, test_user2, shared_workspace
    ):
        """test_user2 (editor u test_user) tworzy tablice w cudzym workspace'ie — bez limitu."""
        service = BoardService(db_session)
        for i in range(4):
            await service.create_board(board_data(shared_workspace.id, f"S{i}"), test_user2.id)
        assert PlanService(db_session).count_own_boards(test_user2.id) == 0

    @pytest.mark.asyncio
    async def test_cudze_tablice_nie_blokuja_wlasciciela(
        self, db_session, test_user, test_user2, shared_workspace
    ):
        """Tablice utworzone przez editora w moim workspace'ie nie wliczają się w mój limit."""
        for i in range(3):
            add_board(db_session, shared_workspace.id, test_user2.id, f"E{i}")
        service = BoardService(db_session)
        result = await service.create_board(board_data(shared_workspace.id, "Moja"), test_user.id)
        assert result.owner_id == test_user.id

    @pytest.mark.asyncio
    async def test_premium_bez_limitu(self, db_session, test_user, test_workspace):
        grant_premium(db_session, test_user.id)
        service = BoardService(db_session)
        for i in range(5):
            await service.create_board(board_data(test_workspace.id, f"P{i}"), test_user.id)
        assert PlanService(db_session).count_own_boards(test_user.id) == 5


# ── read_only przy limicie elementów ─────────────────────────────────────────

class TestElementsReadOnly:

    @pytest.mark.asyncio
    async def test_ponizej_limitu_edytowalna(self, db_session, test_user, test_board):
        add_elements(db_session, test_board.id, test_user.id, count=300)
        result = await BoardService(db_session).get_board(test_board.id, test_user.id)
        assert result.read_only is False
        assert result.read_only_reason is None

    @pytest.mark.asyncio
    async def test_powyzej_limitu_read_only(self, db_session, test_user, test_board):
        add_elements(db_session, test_board.id, test_user.id, count=301)
        result = await BoardService(db_session).get_board(test_board.id, test_user.id)
        assert result.read_only is True
        assert result.read_only_reason == "PLAN_LIMIT_ELEMENTS"

    @pytest.mark.asyncio
    async def test_usuniete_elementy_nie_licza_sie(self, db_session, test_user, test_board):
        add_elements(db_session, test_board.id, test_user.id, count=250, deleted=100)
        result = await BoardService(db_session).get_board(test_board.id, test_user.id)
        assert result.read_only is False

    @pytest.mark.asyncio
    async def test_premium_wlasciciel_workspace_bez_limitu(self, db_session, test_user, test_board):
        grant_premium(db_session, test_user.id)
        add_elements(db_session, test_board.id, test_user.id, count=400)
        result = await BoardService(db_session).get_board(test_board.id, test_user.id)
        assert result.read_only is False
        assert result.read_only_reason is None

    @pytest.mark.asyncio
    async def test_lista_tablic_nie_ustawia_read_only(self, db_session, test_user, test_board):
        """Na liście nie liczymy elementów (N zapytań) — flaga zawsze False."""
        add_elements(db_session, test_board.id, test_user.id, count=301)
        result = await BoardService(db_session).list_boards(test_board.workspace_id, test_user.id)
        assert result.boards[0].read_only is False


# ── GET /plans/me (warstwa service) ──────────────────────────────────────────

class TestGetMe:

    def test_free_z_uzyciem(self, db_session, test_user, test_workspace):
        add_board(db_session, test_workspace.id, test_user.id, "A")
        add_board(db_session, test_workspace.id, test_user.id, "B")
        me = PlanService(db_session).get_me(test_user.id)
        assert me.plan == "free"
        assert me.limits.max_boards == 3
        assert me.limits.max_own_workspaces == 1
        assert me.limits.max_elements_per_board == 300
        assert me.usage.own_workspaces == 1
        assert me.usage.boards == 2

    def test_premium(self, db_session, test_user):
        grant_premium(db_session, test_user.id)
        me = PlanService(db_session).get_me(test_user.id)
        assert me.plan == "premium"
        assert me.limits.max_boards is None
        assert me.usage.own_workspaces == 0
