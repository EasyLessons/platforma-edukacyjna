"""
Testy serwisu whiteboard (sesja tablicy)
api/v1/whiteboard/service.py
"""
import pytest

from api.v1.whiteboard.service import WhiteboardService
from api.v1.whiteboard.schemas import (
    BoardOwnerInfo, LastModifiedByInfo,
    SaveElementsResponse, BoardElementWithAuthor,
)
from core.exceptions import NotFoundError, ValidationError
from core.models import BoardUsers, BoardElement
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


class TestBoardMetadata:

    def test_get_owner_info(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        result = service.get_owner_info(test_board.id)
        assert isinstance(result, BoardOwnerInfo)
        assert result.user_id == test_user.id
        assert result.username == test_user.username

    def test_get_owner_nonexistent_raises_not_found(self, db_session):
        service = WhiteboardService(db_session)
        with pytest.raises(NotFoundError):
            service.get_owner_info(99999)

    def test_get_last_modifier(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        result = service.get_last_modifier(test_board.id)
        assert isinstance(result, LastModifiedByInfo)
        assert result.user_id == test_user.id

    @pytest.mark.asyncio
    async def test_get_last_opened(self, db_session, redis_client, test_user, test_board):
        service = WhiteboardService(db_session, PresenceService(db_session, redis_client))
        await service.mark_opened(test_board.id, test_user.id)
        result = service.get_last_opened(test_board.id, test_user.id)
        assert result.user_id == test_user.id
        assert result.last_opened is not None

    def test_get_last_opened_no_record_raises_not_found(self, db_session, test_user2, test_board):
        service = WhiteboardService(db_session)
        with pytest.raises(NotFoundError):
            service.get_last_opened(test_board.id, test_user2.id)


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
    # 🛠️ delete_element zostaje sync (`def`) — sprzątanie Storage dla
    # obrazów jest teraz zaplanowane w tle z opóźnieniem (BackgroundTasks),
    # nie robione synchronicznie tutaj. Patrz docs/known-issues.md #2,
    # Aktualizacja 9: natychmiastowe kasowanie pliku psuło undo (Ctrl+Z
    # przywracał element z martwym URL-em → szary blok zamiast obrazka).
    # Te testy nie przekazują background_tasks (domyślnie None), więc
    # sprzątanie Storage jest w nich pomijane — testowane osobno by
    # wymagało realnego klienta Supabase Storage.

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