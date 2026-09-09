"""
Testy serwisu whiteboard (sesja tablicy)
api/v1/whiteboard/service.py
"""
from datetime import datetime
import pytest

from api.v1.whiteboard.service import WhiteboardService
from api.v1.whiteboard.schemas import (
    SaveElementsResponse, BoardElementWithAuthor,
    BoardSettings, BoardSettingsPatch
)
from core.exceptions import NotFoundError, AppException, ValidationError
from core.models import Board, BoardUsers, BoardElement
from core.presence import PresenceService


ELEMENT = {"element_id": "uuid-1", "type": "path", "data": {"color": "#000"}}


class TestOnlinePresence:

    @pytest.mark.asyncio
    async def test_mark_opened_updates_last_opened(self, db_session, redis_client, test_user, test_board):
        service = WhiteboardService(db_session, PresenceService(db_session, redis_client))
        await service.mark_opened(test_board.id, test_user.id)

        bu = db_session.query(BoardUsers).filter(
            BoardUsers.board_id == test_board.id,
            BoardUsers.user_id == test_user.id,
        ).first()
        assert bu.last_opened is not None

    @pytest.mark.asyncio
    async def test_mark_opened_marks_presence_in_redis(self, db_session, redis_client, test_user, test_board):
        presence = PresenceService(db_session, redis_client)
        service = WhiteboardService(db_session, presence)
        await service.mark_opened(test_board.id, test_user.id)

        result = await presence.get_online_users([test_board.id])
        assert any(u.user_id == test_user.id for u in result[test_board.id])

    @pytest.mark.asyncio
    async def test_mark_opened_no_access_raises_404(self, db_session, redis_client, test_board, test_user2):
        service = WhiteboardService(db_session, PresenceService(db_session, redis_client))
        with pytest.raises(NotFoundError):
            await service.mark_opened(test_board.id, test_user2.id)


class TestSaveElements:

    def test_saves_new_element(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        result = service.save_elements(test_board.id, [ELEMENT], test_user.id)
        assert isinstance(result, SaveElementsResponse)
        assert result.saved == 1

    def test_element_stored_in_db(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        service.save_elements(test_board.id, [ELEMENT], test_user.id)
        el = db_session.query(BoardElement).filter(
            BoardElement.board_id == test_board.id,
            BoardElement.element_id == "uuid-1",
        ).first()
        assert el is not None
        assert el.type == "path"

    def test_updates_existing_element(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        service.save_elements(test_board.id, [ELEMENT], test_user.id)

        updated = {"element_id": "uuid-1", "type": "rect", "data": {"color": "#fff"}}
        service.save_elements(test_board.id, [updated], test_user.id)

        el = db_session.query(BoardElement).filter(
            BoardElement.board_id == test_board.id,
            BoardElement.element_id == "uuid-1",
        ).first()
        assert el.type == "rect"

    def test_empty_list_raises_validation_error(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        with pytest.raises(ValidationError):
            service.save_elements(test_board.id, [], test_user.id)

    def test_over_100_elements_raises_validation_error(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        elements = [
            {"element_id": f"uuid-{i}", "type": "path", "data": {}}
            for i in range(101)
        ]
        with pytest.raises(ValidationError):
            service.save_elements(test_board.id, elements, test_user.id)

    def test_no_access_raises_404(self, db_session, test_board, test_user2):
        service = WhiteboardService(db_session)
        with pytest.raises(NotFoundError):
            service.save_elements(test_board.id, [ELEMENT], test_user2.id)

    def test_updates_board_last_modified(self, db_session, test_user, test_board):
        original = test_board.last_modified
        service = WhiteboardService(db_session)
        service.save_elements(test_board.id, [ELEMENT], test_user.id)
        db_session.refresh(test_board)
        assert test_board.last_modified >= original


class TestLoadElements:

    def test_returns_empty_for_new_board(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        result = service.load_elements(test_board.id, test_user.id)
        assert result == []

    def test_returns_saved_elements(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        service.save_elements(test_board.id, [ELEMENT], test_user.id)
        result = service.load_elements(test_board.id, test_user.id)
        assert len(result) == 1
        assert isinstance(result[0], BoardElementWithAuthor)
        assert result[0].element_id == "uuid-1"

    def test_includes_author_info(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        service.save_elements(test_board.id, [ELEMENT], test_user.id)
        result = service.load_elements(test_board.id, test_user.id)
        assert result[0].created_by_id == test_user.id
        assert result[0].created_by_username == test_user.username

    def test_no_access_raises_404(self, db_session, test_board, test_user2):
        service = WhiteboardService(db_session)
        with pytest.raises(NotFoundError):
            service.load_elements(test_board.id, test_user2.id)


class TestDeleteElement:

    def test_deletes_element(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        service.save_elements(test_board.id, [ELEMENT], test_user.id)
        service.delete_element(test_board.id, "uuid-1", test_user.id)

        el = db_session.query(BoardElement).filter(
            BoardElement.board_id == test_board.id,
            BoardElement.element_id == "uuid-1",
        ).first()
        assert el is None

    def test_nonexistent_element_raises_not_found(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        with pytest.raises(NotFoundError):
            service.delete_element(test_board.id, "nonexistent", test_user.id)

    def test_no_access_raises_404(self, db_session, test_user, test_board, test_user2):
        service = WhiteboardService(db_session)
        service.save_elements(test_board.id, [ELEMENT], test_user.id)
        with pytest.raises(NotFoundError):
            service.delete_element(test_board.id, "uuid-1", test_user2.id)


class TestBoardSettings:

    def test_get_defaults_when_null(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        result = service.get_settings(test_board.id, test_user.id)
        assert result == BoardSettings()  # wszystko True

    def test_get_merges_partial(self, db_session, test_user, test_board):
        test_board.settings = {"ai_enabled": False}
        db_session.commit()
        service = WhiteboardService(db_session)
        result = service.get_settings(test_board.id, test_user.id)
        assert result.ai_enabled is False
        assert result.grid_visible is True

    def test_update_patches_single_field(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        r1 = service.update_settings(test_board.id, BoardSettingsPatch(grid_visible=False), test_user.id)
        assert r1.grid_visible is False
        assert r1.ai_enabled is True

        r2 = service.update_settings(test_board.id, BoardSettingsPatch(ai_enabled=False), test_user.id)
        assert r2.ai_enabled is False
        assert r2.grid_visible is False  # poprzedni patch nie skasowany

    def test_update_non_member_raises_404(self, db_session, test_board, test_user2):
        service = WhiteboardService(db_session)
        with pytest.raises(NotFoundError):
            service.update_settings(test_board.id, BoardSettingsPatch(ai_enabled=False), test_user2.id)

    def test_update_member_non_owner_raises_403(self, db_session, test_user, test_user2, shared_workspace):
        board = Board(
            name="Shared Board", icon="PenTool", bg_color="bg-gray-500",
            workspace_id=shared_workspace.id, created_by=test_user.id,
            created_at=datetime.utcnow(), last_modified=datetime.utcnow(),
            last_modified_by=test_user.id,
        )
        db_session.add(board)
        db_session.commit()
        db_session.refresh(board)

        service = WhiteboardService(db_session)
        with pytest.raises(AppException) as exc:
            service.update_settings(board.id, BoardSettingsPatch(ai_enabled=False), test_user2.id)
        assert exc.value.status_code == 403 