"""
Testy CRUD tablic
api/v1/boards/service.py
"""
import pytest
from datetime import datetime

from api.v1.boards.service import BoardService
from api.v1.boards.schemas import (
    CreateBoard, UpdateBoard, ToggleFavourite,
    BoardResponse, BoardListResponse, ToggleFavouriteResponse,
    BoardSettings, UpdateBoardSettings
)
from core.exceptions import NotFoundError, AppException
from core.models import Board, BoardUsers, WorkspaceMember


def make_board_data(workspace_id, **kwargs):
    return CreateBoard(
        name=kwargs.get("name", "Test Board"),
        icon=kwargs.get("icon", "PenTool"),
        bg_color=kwargs.get("bg_color", "bg-gray-500"),
        workspace_id=workspace_id,
    )


class TestCreateBoard:

    @pytest.mark.asyncio
    async def test_returns_board_response(self, db_session, test_user, test_workspace):
        service = BoardService(db_session)
        result = await service.create_board(make_board_data(test_workspace.id), test_user.id)
        assert isinstance(result, BoardResponse)
        assert result.name == "Test Board"

    @pytest.mark.asyncio
    async def test_creator_is_owner(self, db_session, test_user, test_workspace):
        service = BoardService(db_session)
        result = await service.create_board(make_board_data(test_workspace.id), test_user.id)
        assert result.owner_id == test_user.id
        assert result.owner_username == test_user.username

    @pytest.mark.asyncio
    async def test_creates_board_user_relation(self, db_session, test_user, test_workspace):
        service = BoardService(db_session)
        result = await service.create_board(make_board_data(test_workspace.id), test_user.id)
        board_user = db_session.query(BoardUsers).filter(
            BoardUsers.board_id == result.id,
            BoardUsers.user_id == test_user.id,
        ).first()
        assert board_user is not None
        assert board_user.last_opened is not None

    @pytest.mark.asyncio
    async def test_nonexistent_workspace_raises_not_found(self, db_session, test_user):
        service = BoardService(db_session)
        with pytest.raises(NotFoundError):
            await service.create_board(make_board_data(99999), test_user.id)

    @pytest.mark.asyncio
    async def test_custom_icon_and_color(self, db_session, test_user, test_workspace):
        service = BoardService(db_session)
        result = await service.create_board(
            make_board_data(test_workspace.id, icon="Star", bg_color="bg-red-500"),
            test_user.id,
        )
        assert result.icon == "Star"
        assert result.bg_color == "bg-red-500"

    @pytest.mark.asyncio
    async def test_non_member_raises(self, db_session, test_user2, test_workspace):
        service = BoardService(db_session)
        with pytest.raises(NotFoundError):
            await service.create_board(make_board_data(test_workspace.id), test_user2.id)

    @pytest.mark.asyncio
    async def test_editor_can_create(self, db_session, test_user2, shared_workspace):
        service = BoardService(db_session)
        result = await service.create_board(make_board_data(shared_workspace.id), test_user2.id)
        assert isinstance(result, BoardResponse)

    @pytest.mark.asyncio
    async def test_viewer_forbidden(self, db_session, test_user2, shared_workspace):
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == shared_workspace.id,
            WorkspaceMember.user_id == test_user2.id,
        ).first()
        membership.role = "viewer"
        db_session.commit()

        service = BoardService(db_session)
        with pytest.raises(AppException) as exc:
            await service.create_board(make_board_data(shared_workspace.id), test_user2.id)
        assert exc.value.status_code == 403


class TestGetBoard:

    @pytest.mark.asyncio
    async def test_returns_board(self, db_session, test_user, test_board):
        service = BoardService(db_session)
        result = await service.get_board(test_board.id, test_user.id)
        assert result.id == test_board.id

    @pytest.mark.asyncio
    async def test_nonexistent_raises_not_found(self, db_session, test_user):
        service = BoardService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_board(99999, test_user.id)

    @pytest.mark.asyncio
    async def test_no_access_raises_404(self, db_session, test_board, test_user2):
        service = BoardService(db_session)
        with pytest.raises(NotFoundError):
            await service.get_board(test_board.id, test_user2.id)


class TestListBoards:

    @pytest.mark.asyncio
    async def test_returns_board_list_response(self, db_session, test_user, test_workspace):
        service = BoardService(db_session)
        result = await service.list_boards(test_workspace.id, test_user.id)
        assert isinstance(result, BoardListResponse)

    @pytest.mark.asyncio
    async def test_empty_workspace(self, db_session, test_user, test_workspace):
        service = BoardService(db_session)
        result = await service.list_boards(test_workspace.id, test_user.id)
        assert result.total == 0
        assert result.boards == []

    @pytest.mark.asyncio
    async def test_lists_boards_in_workspace(self, db_session, test_user, test_workspace, multiple_boards):
        service = BoardService(db_session)
        result = await service.list_boards(test_workspace.id, test_user.id, limit=20)
        assert result.total == 15

    @pytest.mark.asyncio
    async def test_pagination(self, db_session, test_user, test_workspace, multiple_boards):
        service = BoardService(db_session)
        page1 = await service.list_boards(test_workspace.id, test_user.id, limit=5, offset=0)
        page2 = await service.list_boards(test_workspace.id, test_user.id, limit=5, offset=5)
        assert len(page1.boards) == 5
        assert len(page2.boards) == 5
        ids1 = {b.id for b in page1.boards}
        ids2 = {b.id for b in page2.boards}
        assert ids1.isdisjoint(ids2)

    @pytest.mark.asyncio
    async def test_limit_respected(self, db_session, test_user, test_workspace, multiple_boards):
        service = BoardService(db_session)
        result = await service.list_boards(test_workspace.id, test_user.id, limit=3)
        assert len(result.boards) == 3

    @pytest.mark.asyncio
    async def test_non_member_raises(self, db_session, test_user2, test_workspace):
        service = BoardService(db_session)
        with pytest.raises(NotFoundError):
            await service.list_boards(test_workspace.id, test_user2.id)


class TestUpdateBoard:

    @pytest.mark.asyncio
    async def test_updates_name(self, db_session, test_user, test_board):
        service = BoardService(db_session)
        result = await service.update_board(test_board.id, UpdateBoard(name="New Name"), test_user.id)
        assert result.name == "New Name"

    @pytest.mark.asyncio
    async def test_updates_last_modified(self, db_session, test_user, test_board):
        original = test_board.last_modified
        service = BoardService(db_session)
        result = await service.update_board(test_board.id, UpdateBoard(name="X"), test_user.id)
        assert result.last_modified >= original

    @pytest.mark.asyncio
    async def test_no_access_raises_404(self, db_session, test_board, test_user2):
        service = BoardService(db_session)
        with pytest.raises(NotFoundError):
            await service.update_board(test_board.id, UpdateBoard(name="X"), test_user2.id)

    @pytest.mark.asyncio
    async def test_nonexistent_raises_not_found(self, db_session, test_user):
        service = BoardService(db_session)
        with pytest.raises(NotFoundError):
            await service.update_board(99999, UpdateBoard(name="X"), test_user.id)


class TestDeleteBoard:

    @pytest.mark.asyncio
    async def test_deletes_board(self, db_session, test_user, test_board):
        board_id = test_board.id
        service = BoardService(db_session)
        await service.delete_board(board_id, test_user.id)
        assert db_session.query(Board).filter(Board.id == board_id).first() is None

    @pytest.mark.asyncio
    async def test_returns_success(self, db_session, test_user, test_board):
        service = BoardService(db_session)
        result = await service.delete_board(test_board.id, test_user.id)
        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_non_member_raises_404(self, db_session, test_board, test_user2):
        service = BoardService(db_session)
        with pytest.raises(NotFoundError):
            await service.delete_board(test_board.id, test_user2.id)

    @pytest.mark.asyncio
    async def test_member_non_owner_raises_403(self, db_session, test_user, test_user2, shared_workspace):
        board = Board(
            name="Shared Board", icon="PenTool", bg_color="bg-gray-500",
            workspace_id=shared_workspace.id, created_by=test_user.id,
            created_at=datetime.utcnow(), last_modified=datetime.utcnow(),
            last_modified_by=test_user.id,
        )
        db_session.add(board)
        db_session.commit()
        db_session.refresh(board)

        service = BoardService(db_session)
        with pytest.raises(AppException) as exc:
            await service.delete_board(board.id, test_user2.id)
        assert exc.value.status_code == 403

    @pytest.mark.asyncio
    async def test_nonexistent_raises_not_found(self, db_session, test_user):
        service = BoardService(db_session)
        with pytest.raises(NotFoundError):
            await service.delete_board(99999, test_user.id)


class TestToggleFavourite:

    @pytest.mark.asyncio
    async def test_sets_favourite(self, db_session, test_user, test_board):
        service = BoardService(db_session)
        result = await service.toggle_favourite(
            test_board.id, ToggleFavourite(is_favourite=True), test_user.id
        )
        assert isinstance(result, ToggleFavouriteResponse)
        assert result.is_favourite is True

    @pytest.mark.asyncio
    async def test_unsets_favourite(self, db_session, test_user, test_board):
        service = BoardService(db_session)
        await service.toggle_favourite(test_board.id, ToggleFavourite(is_favourite=True), test_user.id)
        result = await service.toggle_favourite(test_board.id, ToggleFavourite(is_favourite=False), test_user.id)
        assert result.is_favourite is False

    @pytest.mark.asyncio
    async def test_non_member_raises_404(self, db_session, test_board, test_user2):
        """Non-member nie może polubić cudzej tablicy."""
        service = BoardService(db_session)
        with pytest.raises(NotFoundError):
            await service.toggle_favourite(
                test_board.id, ToggleFavourite(is_favourite=True), test_user2.id
            )

    @pytest.mark.asyncio
    async def test_creates_board_user_for_member_without_row(
        self, db_session, test_user, test_user2, shared_workspace
    ):
        """Członek bez wiersza BoardUsers — toggle tworzy rekord."""
        board = Board(
            name="Shared Board",
            icon="PenTool",
            bg_color="bg-gray-500",
            workspace_id=shared_workspace.id,
            created_by=test_user.id,
            created_at=datetime.utcnow(),
            last_modified=datetime.utcnow(),
            last_modified_by=test_user.id,
        )
        db_session.add(board)
        db_session.commit()
        db_session.refresh(board)

        service = BoardService(db_session)
        result = await service.toggle_favourite(
            board.id, ToggleFavourite(is_favourite=True), test_user2.id
        )
        assert result.is_favourite is True
        row = db_session.query(BoardUsers).filter(
            BoardUsers.board_id == board.id,
            BoardUsers.user_id == test_user2.id,
        ).first()
        assert row is not None




class TestUpdateSettings:

    @pytest.mark.asyncio
    async def test_owner_can_update(self, db_session, test_user, test_board):
        service = BoardService(db_session)
        result = await service.update_settings(
            test_board.id, UpdateBoardSettings(settings=BoardSettings(ai_enabled=False)), test_user.id
        )
        assert result["settings"]["ai_enabled"] is False

    @pytest.mark.asyncio
    async def test_non_member_raises_404(self, db_session, test_board, test_user2):
        service = BoardService(db_session)
        with pytest.raises(NotFoundError):
            await service.update_settings(
                test_board.id, UpdateBoardSettings(settings=BoardSettings()), test_user2.id
            )

    @pytest.mark.asyncio
    async def test_member_non_owner_raises_403(self, db_session, test_user, test_user2, shared_workspace):
        board = Board(
            name="Shared Board", icon="PenTool", bg_color="bg-gray-500",
            workspace_id=shared_workspace.id, created_by=test_user.id,
            created_at=datetime.utcnow(), last_modified=datetime.utcnow(),
            last_modified_by=test_user.id,
        )
        db_session.add(board)
        db_session.commit()
        db_session.refresh(board)

        service = BoardService(db_session)
        with pytest.raises(AppException) as exc:
            await service.update_settings(
                board.id, UpdateBoardSettings(settings=BoardSettings()), test_user2.id
            )
        assert exc.value.status_code == 403