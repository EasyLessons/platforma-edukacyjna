"""
Testy OnboardingService
api/v1/onboarding/service.py — setup_new_user() = create_starter_workspace() + create_starter_board()
"""
import pytest

from api.v1.onboarding import service as onboarding_module
from api.v1.onboarding.service import OnboardingService
from core.models import Board, BoardUsers, Workspace, WorkspaceMember


def _workspaces_of(db_session, user_id: int) -> list[Workspace]:
    return db_session.query(Workspace).filter(Workspace.created_by == user_id).all()


# ─── happy path ───────────────────────────────────────────────────────────────

class TestSetupNewUser:

    def test_tworzy_startowy_workspace(self, db_session, test_user):
        """setup_new_user → workspace 'Moja przestrzeń' należący do usera"""
        workspace = OnboardingService(db_session).setup_new_user(test_user.id)
        db_session.commit()

        assert isinstance(workspace, Workspace)
        assert workspace.id is not None
        assert workspace.name == "Moja przestrzeń"
        assert workspace.icon == "Home"
        assert workspace.bg_color == "bg-green-500"
        assert workspace.created_by == test_user.id

        saved = db_session.query(Workspace).filter(Workspace.id == workspace.id).first()
        assert saved is not None

    def test_user_jest_ownerem_i_ma_workspace_w_ulubionych(self, db_session, test_user):
        """setup_new_user → WorkspaceMember(role=owner, is_favourite=True) dla usera"""
        workspace = OnboardingService(db_session).setup_new_user(test_user.id)
        db_session.commit()

        memberships = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace.id
        ).all()
        assert len(memberships) == 1
        assert memberships[0].user_id == test_user.id
        assert memberships[0].role == "owner"
        assert memberships[0].is_favourite is True

    def test_tworzy_startowa_tablice_w_workspace(self, db_session, test_user):
        """setup_new_user → jedna tablica 'Moja pierwsza tablica' w nowym workspace, user jej twórcą"""
        workspace = OnboardingService(db_session).setup_new_user(test_user.id)
        db_session.commit()

        boards = db_session.query(Board).filter(Board.workspace_id == workspace.id).all()
        assert len(boards) == 1
        board = boards[0]
        assert board.name == "Moja pierwsza tablica"
        assert board.icon == "PenTool"
        assert board.bg_color == "bg-gray-500"
        assert board.created_by == test_user.id
        assert board.last_modified_by == test_user.id

    def test_user_jest_przypisany_do_tablicy(self, db_session, test_user):
        """setup_new_user → wpis BoardUsers łączący usera ze startową tablicą"""
        workspace = OnboardingService(db_session).setup_new_user(test_user.id)
        db_session.commit()

        board = db_session.query(Board).filter(Board.workspace_id == workspace.id).first()
        board_users = db_session.query(BoardUsers).filter(BoardUsers.board_id == board.id).all()
        assert len(board_users) == 1
        assert board_users[0].user_id == test_user.id
        assert board_users[0].is_favourite is False


# ─── granica transakcji ───────────────────────────────────────────────────────

class TestTransactionBoundary:

    def test_nie_commituje_rollback_usuwa_wszystko(self, db_session, test_user):
        """setup_new_user tylko flushuje — rollback wołającego cofa workspace, membership i tablicę"""
        workspace = OnboardingService(db_session).setup_new_user(test_user.id)
        workspace_id = workspace.id
        assert workspace_id is not None  # flush nadał id

        db_session.rollback()

        assert db_session.query(Workspace).filter(Workspace.id == workspace_id).first() is None
        assert db_session.query(WorkspaceMember).filter(WorkspaceMember.user_id == test_user.id).count() == 0
        assert db_session.query(Board).filter(Board.created_by == test_user.id).count() == 0

    def test_blad_w_tworzeniu_tablicy_nie_zostawia_workspace_po_rollbacku(self, db_session, test_user, monkeypatch):
        """Wyjątek w create_starter_board propaguje się, a rollback wołającego
        (tak robi AuthService.register / google login) nie zostawia półproduktu w bazie."""

        def _boom(db, workspace_id, user_id):
            raise RuntimeError("symulowany błąd tworzenia tablicy")

        monkeypatch.setattr(onboarding_module, "create_starter_board", _boom)

        with pytest.raises(RuntimeError, match="symulowany błąd"):
            OnboardingService(db_session).setup_new_user(test_user.id)

        db_session.rollback()

        assert _workspaces_of(db_session, test_user.id) == []
        assert db_session.query(WorkspaceMember).filter(WorkspaceMember.user_id == test_user.id).count() == 0
        assert db_session.query(Board).filter(Board.created_by == test_user.id).count() == 0

    def test_blad_w_tworzeniu_tablicy_zostawia_workspace_w_sesji_bez_rollbacku(self, db_session, test_user, monkeypatch):
        """Dokumentuje: serwis sam nie sprząta — bez rollbacku wołającego
        zflushowany workspace + membership wiszą w otwartej transakcji (i commit by je utrwalił)."""

        def _boom(db, workspace_id, user_id):
            raise RuntimeError("symulowany błąd tworzenia tablicy")

        monkeypatch.setattr(onboarding_module, "create_starter_board", _boom)

        with pytest.raises(RuntimeError):
            OnboardingService(db_session).setup_new_user(test_user.id)

        assert len(_workspaces_of(db_session, test_user.id)) == 1
        assert db_session.query(Board).filter(Board.created_by == test_user.id).count() == 0


# ─── ponowne wywołanie ────────────────────────────────────────────────────────

class TestRepeatedCall:

    def test_ponowne_wywolanie_nie_jest_idempotentne(self, db_session, test_user):
        """Dokumentuje: drugie setup_new_user dla tego samego usera tworzy DRUGI komplet
        (workspace + membership + tablica), nie reużywa istniejącego."""
        service = OnboardingService(db_session)
        first = service.setup_new_user(test_user.id)
        db_session.commit()
        second = service.setup_new_user(test_user.id)
        db_session.commit()

        assert first.id != second.id
        workspaces = _workspaces_of(db_session, test_user.id)
        assert len(workspaces) == 2
        assert {w.name for w in workspaces} == {"Moja przestrzeń"}
        assert db_session.query(WorkspaceMember).filter(
            WorkspaceMember.user_id == test_user.id, WorkspaceMember.role == "owner"
        ).count() == 2
        assert db_session.query(Board).filter(Board.created_by == test_user.id).count() == 2

    def test_dwoch_userow_dostaje_osobne_workspace(self, db_session, test_user, test_user2):
        """setup_new_user dla dwóch userów → każdy ma własny workspace, bez krzyżowych członkostw"""
        service = OnboardingService(db_session)
        ws1 = service.setup_new_user(test_user.id)
        ws2 = service.setup_new_user(test_user2.id)
        db_session.commit()

        assert ws1.id != ws2.id
        members_ws1 = {m.user_id for m in db_session.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws1.id)}
        members_ws2 = {m.user_id for m in db_session.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws2.id)}
        assert members_ws1 == {test_user.id}
        assert members_ws2 == {test_user2.id}
