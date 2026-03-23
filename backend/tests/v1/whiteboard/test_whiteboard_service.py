"""
Testy serwisu whiteboard (sesja tablicy)
api/v1/whiteboard/service.py
"""
import pytest
from datetime import datetime

from api.v1.whiteboard.service import WhiteboardService
from api.v1.whiteboard.schemas import (
    OnlineUserInfo, BoardOwnerInfo, LastModifiedByInfo,
    SaveElementsResponse, BoardElementWithAuthor,
)
from core.exceptions import NotFoundError, AppException, ValidationError
from core.models import BoardUsers, BoardElement


ELEMENT = {"element_id": "uuid-1", "type": "path", "data": {"color": "#000"}}


class TestOnlinePresence:

    def test_set_online_marks_user(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        service.set_online(test_board.id, test_user.id)

        bu = db_session.query(BoardUsers).filter(
            BoardUsers.board_id == test_board.id,
            BoardUsers.user_id == test_user.id,
        ).first()
        assert bu.is_online is True

    def test_set_online_updates_last_opened(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        service.set_online(test_board.id, test_user.id)

        bu = db_session.query(BoardUsers).filter(
            BoardUsers.board_id == test_board.id,
            BoardUsers.user_id == test_user.id,
        ).first()
        assert bu.last_opened is not None

    def test_set_online_no_access_raises_403(self, db_session, test_board, test_user2):
        service = WhiteboardService(db_session)
        with pytest.raises(AppException) as exc:
            service.set_online(test_board.id, test_user2.id)
        assert exc.value.status_code == 403

    def test_set_offline_marks_user(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        service.set_online(test_board.id, test_user.id)
        result = service.set_offline(test_board.id, test_user.id)
        assert result is True

        bu = db_session.query(BoardUsers).filter(
            BoardUsers.board_id == test_board.id,
            BoardUsers.user_id == test_user.id,
        ).first()
        assert bu.is_online is False

    def test_set_offline_nonexistent_returns_false(self, db_session, test_user2, test_board):
        service = WhiteboardService(db_session)
        result = service.set_offline(test_board.id, test_user2.id)
        assert result is False

    def test_get_online_users(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        service.set_online(test_board.id, test_user.id)
        result = service.get_online_users(test_board.id)
        assert any(u.user_id == test_user.id for u in result)

    def test_get_online_users_empty(self, db_session, test_board):
        # Ustaw wszystkich offline
        for bu in db_session.query(BoardUsers).filter(BoardUsers.board_id == test_board.id):
            bu.is_online = False
        db_session.commit()

        service = WhiteboardService(db_session)
        result = service.get_online_users(test_board.id)
        assert result == []


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

    def test_get_last_opened(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        service.set_online(test_board.id, test_user.id)
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

    def test_no_access_raises_403(self, db_session, test_board, test_user2):
        service = WhiteboardService(db_session)
        with pytest.raises(AppException) as exc:
            service.save_elements(test_board.id, [ELEMENT], test_user2.id)
        assert exc.value.status_code == 403

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

    def test_no_access_raises_403(self, db_session, test_board, test_user2):
        service = WhiteboardService(db_session)
        with pytest.raises(AppException) as exc:
            service.load_elements(test_board.id, test_user2.id)
        assert exc.value.status_code == 403


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

    def test_no_access_raises_403(self, db_session, test_user, test_board, test_user2):
        service = WhiteboardService(db_session)
        service.save_elements(test_board.id, [ELEMENT], test_user.id)
        with pytest.raises(AppException) as exc:
            service.delete_element(test_board.id, "uuid-1", test_user2.id)
        assert exc.value.status_code == 403