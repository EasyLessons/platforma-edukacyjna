"""
Testy serwisu whiteboard (sesja tablicy)
api/v1/whiteboard/service.py
"""
from datetime import datetime
import pytest
import base64

from api.v1.whiteboard.service import WhiteboardService
from api.v1.whiteboard.schemas import (
    BoardSettings, BoardSettingsPatch,
    DocumentResponse, AccessCheckResponse,
)
from core.exceptions import NotFoundError, AppException, ValidationError
from core.models import Board, BoardUsers, BoardDocument
from core.presence import PresenceService


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


class TestDocument:

    SNAPSHOT_B64 = base64.b64encode(b"\x01\x02\x03fake-yjs-update").decode("ascii")

    def test_get_document_without_save_returns_none(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        result = service.load_document(test_board.id, test_user.id)
        assert isinstance(result, DocumentResponse)
        assert result.snapshot is None
        assert result.updated_at is None

    def test_save_then_load_roundtrips_snapshot(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        service.save_document(test_board.id, self.SNAPSHOT_B64, test_user.id)

        result = service.load_document(test_board.id, test_user.id)
        assert result.snapshot == self.SNAPSHOT_B64
        assert result.updated_at is not None

    def test_save_twice_overwrites_not_duplicates(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        service.save_document(test_board.id, self.SNAPSHOT_B64, test_user.id)
        other_b64 = base64.b64encode(b"newer-snapshot").decode("ascii")
        service.save_document(test_board.id, other_b64, test_user.id)

        rows = db_session.query(BoardDocument).filter(
            BoardDocument.board_id == test_board.id
        ).all()
        assert len(rows) == 1
        assert rows[0].snapshot == b"newer-snapshot"

    def test_save_invalid_base64_raises_validation_error(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        with pytest.raises(ValidationError):
            service.save_document(test_board.id, "not-valid-base64!!", test_user.id)

    def test_save_no_access_raises_404(self, db_session, test_board, test_user2):
        service = WhiteboardService(db_session)
        with pytest.raises(NotFoundError):
            service.save_document(test_board.id, self.SNAPSHOT_B64, test_user2.id)

    def test_load_no_access_raises_404(self, db_session, test_board, test_user2):
        service = WhiteboardService(db_session)
        with pytest.raises(NotFoundError):
            service.load_document(test_board.id, test_user2.id)


class TestAccessCheck:

    def test_member_has_access(self, db_session, test_user, test_board):
        service = WhiteboardService(db_session)
        result = service.check_access(test_board.id, test_user)
        assert isinstance(result, AccessCheckResponse)
        assert result.has_access is True
        assert result.user_id == test_user.id
        assert result.username == test_user.username

    def test_non_member_raises_404(self, db_session, test_board, test_user2):
        service = WhiteboardService(db_session)
        with pytest.raises(NotFoundError):
            service.check_access(test_board.id, test_user2)

    def test_nonexistent_board_raises_404(self, db_session, test_user):
        service = WhiteboardService(db_session)
        with pytest.raises(NotFoundError):
            service.check_access(999999, test_user)