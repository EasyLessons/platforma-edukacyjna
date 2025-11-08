"""
Testy dla BoardService
"""
import pytest
from datetime import datetime
from fastapi import HTTPException

from dashboard.boards.service import BoardService
from dashboard.boards.schemas import (
    CreateBoard, UpdateBoard, ToggleFavourite,
    BoardResponse, BoardListResponse
)
from core.models import Board, BoardUsers


class TestBoardServiceCreate:
    """Testy tworzenia tablic"""
    
    @pytest.mark.asyncio
    async def test_create_board_success(self, db_session, test_user, test_workspace):
        """Test pomyślnego utworzenia tablicy"""
        service = BoardService(db_session)
        
        board_data = CreateBoard(
            name="New Test Board",
            icon="NewIcon",
            bg_color="bg-green-500",
            workspace_id=test_workspace.id
        )
        
        result = await service.create_board(board_data, test_user.id)
        
        assert isinstance(result, BoardResponse)
        assert result.name == "New Test Board"
        assert result.icon == "NewIcon"
        assert result.bg_color == "bg-green-500"
        assert result.created_by == test_user.username
        assert result.owner_username == test_user.username
        assert result.is_favourite == False
        
        # Sprawdź czy tablica została dodana do bazy
        board = db_session.query(Board).filter(Board.name == "New Test Board").first()
        assert board is not None
        assert board.created_by == test_user.id
    
    @pytest.mark.asyncio
    async def test_create_board_with_default_values(self, db_session, test_user, test_workspace):
        """Test utworzenia tablicy z wartościami domyślnymi"""
        service = BoardService(db_session)
        
        board_data = CreateBoard(
            name="Board with defaults",
            workspace_id=test_workspace.id
        )
        
        result = await service.create_board(board_data, test_user.id)
        
        assert result.icon == "PenTool"  # Domyślna wartość
        assert result.bg_color == "bg-gray-500"  # Domyślna wartość
    
    @pytest.mark.asyncio
    async def test_create_board_invalid_workspace(self, db_session, test_user):
        """Test tworzenia tablicy z nieistniejącym workspace"""
        service = BoardService(db_session)
        
        board_data = CreateBoard(
            name="Invalid Board",
            workspace_id=99999  # Nieistniejący workspace
        )
        
        with pytest.raises(HTTPException) as exc_info:
            await service.create_board(board_data, test_user.id)
        
        assert exc_info.value.status_code == 404
        assert "Workspace nie znaleziony" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_create_board_creates_board_user_relation(self, db_session, test_user, test_workspace):
        """Test czy tworzenie tablicy tworzy relację BoardUsers"""
        service = BoardService(db_session)
        
        board_data = CreateBoard(
            name="Relation Test Board",
            workspace_id=test_workspace.id
        )
        
        result = await service.create_board(board_data, test_user.id)
        
        # Sprawdź relację
        board_user = db_session.query(BoardUsers).filter(
            BoardUsers.board_id == result.id,
            BoardUsers.user_id == test_user.id
        ).first()
        
        assert board_user is not None
        assert board_user.is_favourite == False
        assert board_user.is_online == True
        assert board_user.last_opened is not None


class TestBoardServiceUpdate:
    """Testy aktualizacji tablic"""
    
    @pytest.mark.asyncio
    async def test_update_board_success(self, db_session, test_user, test_board):
        """Test pomyślnej aktualizacji tablicy"""
        service = BoardService(db_session)
        
        update_data = UpdateBoard(
            name="Updated Board Name",
            icon="UpdatedIcon",
            bg_color="bg-red-500"
        )
        
        result = await service.update_board(test_board.id, update_data, test_user.id)
        
        assert isinstance(result, BoardResponse)
        assert result.name == "Updated Board Name"
        assert result.icon == "UpdatedIcon"
        assert result.bg_color == "bg-red-500"
        assert result.last_modified_by == test_user.username
    
    @pytest.mark.asyncio
    async def test_update_board_partial(self, db_session, test_user, test_board):
        """Test częściowej aktualizacji tablicy"""
        service = BoardService(db_session)
        
        original_icon = test_board.icon
        
        update_data = UpdateBoard(name="Partially Updated")
        
        result = await service.update_board(test_board.id, update_data, test_user.id)
        
        assert result.name == "Partially Updated"
        assert result.icon == original_icon
    
    @pytest.mark.asyncio
    async def test_update_board_not_found(self, db_session, test_user):
        """Test aktualizacji nieistniejącej tablicy"""
        service = BoardService(db_session)
        
        update_data = UpdateBoard(name="Non-existent")
        
        with pytest.raises(HTTPException) as exc_info:
            await service.update_board(99999, update_data, test_user.id)
        
        assert exc_info.value.status_code == 404
    
    @pytest.mark.asyncio
    async def test_update_board_no_permission(self, db_session, test_user2, test_board):
        """Test aktualizacji tablicy bez uprawnień"""
        service = BoardService(db_session)
        
        update_data = UpdateBoard(name="Unauthorized Update")
        
        with pytest.raises(HTTPException) as exc_info:
            await service.update_board(test_board.id, update_data, test_user2.id)
        
        assert exc_info.value.status_code == 403
        assert "Brak uprawnień" in str(exc_info.value.detail)


class TestBoardServiceDelete:
    """Testy usuwania tablic"""
    
    @pytest.mark.asyncio
    async def test_delete_board_success(self, db_session, test_user, test_board):
        """Test pomyślnego usunięcia tablicy"""
        service = BoardService(db_session)
        board_id = test_board.id
        
        result = await service.delete_board(board_id, test_user.id)
        
        assert result["success"] == True
        assert "pomyślnie usunięta" in result["message"]
        
        # Sprawdź czy tablica została usunięta
        board = db_session.query(Board).filter(Board.id == board_id).first()
        assert board is None
    
    @pytest.mark.asyncio
    async def test_delete_board_not_owner(self, db_session, test_user2, test_board):
        """Test usuwania tablicy przez użytkownika niebędącego właścicielem"""
        service = BoardService(db_session)
        
        with pytest.raises(HTTPException) as exc_info:
            await service.delete_board(test_board.id, test_user2.id)
        
        assert exc_info.value.status_code == 403
        assert "Tylko właściciel" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_delete_board_not_found(self, db_session, test_user):
        """Test usuwania nieistniejącej tablicy"""
        service = BoardService(db_session)
        
        with pytest.raises(HTTPException) as exc_info:
            await service.delete_board(99999, test_user.id)
        
        assert exc_info.value.status_code == 404


class TestBoardServiceToggleFavourite:
    """Testy toggleowania ulubionych"""
    
    @pytest.mark.asyncio
    async def test_toggle_favourite_to_true(self, db_session, test_user, test_board):
        """Test ustawienia tablicy jako ulubionej"""
        service = BoardService(db_session)
        
        toggle_data = ToggleFavourite(is_favourite=True)
        
        result = await service.toggle_favourite(test_board.id, toggle_data, test_user.id)
        
        assert result.is_favourite == True
        assert "pomyślnie zaktualizowana" in result.message
        
        # Sprawdź w bazie
        board_user = db_session.query(BoardUsers).filter(
            BoardUsers.board_id == test_board.id,
            BoardUsers.user_id == test_user.id
        ).first()
        assert board_user.is_favourite == True
    
    @pytest.mark.asyncio
    async def test_toggle_favourite_to_false(self, db_session, test_user, test_board):
        """Test usunięcia tablicy z ulubionych"""
        service = BoardService(db_session)
        
        # Najpierw ustaw jako ulubioną
        board_user = db_session.query(BoardUsers).filter(
            BoardUsers.board_id == test_board.id,
            BoardUsers.user_id == test_user.id
        ).first()
        board_user.is_favourite = True
        db_session.commit()
        
        # Teraz usuń z ulubionych
        toggle_data = ToggleFavourite(is_favourite=False)
        result = await service.toggle_favourite(test_board.id, toggle_data, test_user.id)
        
        assert result.is_favourite == False
    
    @pytest.mark.asyncio
    async def test_toggle_favourite_creates_relation(self, db_session, test_user, test_board):
        """Test czy toggle tworzy relację jeśli nie istnieje"""
        service = BoardService(db_session)
        
        # Usuń istniejącą relację
        db_session.query(BoardUsers).filter(
            BoardUsers.board_id == test_board.id,
            BoardUsers.user_id == test_user.id
        ).delete()
        db_session.commit()
        
        toggle_data = ToggleFavourite(is_favourite=True)
        result = await service.toggle_favourite(test_board.id, toggle_data, test_user.id)
        
        assert result.is_favourite == True
        
        # Sprawdź czy relacja została utworzona
        board_user = db_session.query(BoardUsers).filter(
            BoardUsers.board_id == test_board.id,
            BoardUsers.user_id == test_user.id
        ).first()
        assert board_user is not None


class TestBoardServiceList:
    """Testy listowania tablic"""
    
    @pytest.mark.asyncio
    async def test_list_boards_success(self, db_session, test_user, multiple_boards, test_workspace):
        """Test pobrania listy tablic"""
        service = BoardService(db_session)
        
        result = await service.list_boards(test_workspace.id, test_user.id, limit=10, offset=0)
        
        assert isinstance(result, BoardListResponse)
        assert len(result.boards) == 10
        assert result.total == 15
        assert result.limit == 10
        assert result.offset == 0
    
    @pytest.mark.asyncio
    async def test_list_boards_pagination(self, db_session, test_user, multiple_boards, test_workspace):
        """Test paginacji listy tablic"""
        service = BoardService(db_session)
        
        # Pierwsza strona
        page1 = await service.list_boards(test_workspace.id, test_user.id, limit=5, offset=0)
        assert len(page1.boards) == 5
        
        # Druga strona
        page2 = await service.list_boards(test_workspace.id, test_user.id, limit=5, offset=5)
        assert len(page2.boards) == 5
        
        # Sprawdź czy tablice się nie powtarzają
        page1_ids = {board.id for board in page1.boards}
        page2_ids = {board.id for board in page2.boards}
        assert len(page1_ids.intersection(page2_ids)) == 0
    
    @pytest.mark.asyncio
    async def test_list_boards_empty_workspace(self, db_session, test_user, test_workspace):
        """Test listowania tablic w pustym workspace"""
        service = BoardService(db_session)
        
        result = await service.list_boards(test_workspace.id, test_user.id, limit=10, offset=0)
        
        assert len(result.boards) == 0
        assert result.total == 0
    
    @pytest.mark.asyncio
    async def test_list_boards_contains_favourite_info(self, db_session, test_user, multiple_boards, test_workspace):
        """Test czy lista zawiera informacje o ulubionych"""
        service = BoardService(db_session)
        
        result = await service.list_boards(test_workspace.id, test_user.id, limit=15, offset=0)
        
        # Sprawdź czy niektóre tablice są oznaczone jako ulubione
        favourite_boards = [board for board in result.boards if board.is_favourite]
        assert len(favourite_boards) > 0  # Co najmniej jedna ulubiona (co 3.)


class TestBoardServiceOnlineUsers:
    """Testy pobierania użytkowników online"""
    
    @pytest.mark.asyncio
    async def test_get_online_users(self, db_session, test_user, test_user2, test_board):
        """Test pobierania użytkowników online"""
        service = BoardService(db_session)
        
        # Dodaj drugiego użytkownika jako online
        board_user2 = BoardUsers(
            board_id=test_board.id,
            user_id=test_user2.id,
            is_favourite=False,
            is_online=True,
            last_opened=datetime.utcnow()
        )
        db_session.add(board_user2)
        db_session.commit()
        
        result = await service.get_online_users(test_board.id, limit=50, offset=0)
        
        assert len(result) == 2
        assert any(user.user_id == test_user.id for user in result)
        assert any(user.user_id == test_user2.id for user in result)
    
    @pytest.mark.asyncio
    async def test_get_online_users_pagination(self, db_session, test_board):
        """Test paginacji użytkowników online"""
        service = BoardService(db_session)
        
        result = await service.get_online_users(test_board.id, limit=1, offset=0)
        
        assert len(result) <= 1


class TestBoardServiceOwnerInfo:
    """Testy pobierania informacji o właścicielu"""
    
    @pytest.mark.asyncio
    async def test_get_board_owner_info(self, db_session, test_user, test_board):
        """Test pobierania informacji o właścicielu"""
        service = BoardService(db_session)
        
        result = await service.get_board_owner_info(test_board.id)
        
        assert result.user_id == test_user.id
        assert result.username == test_user.username
    
    @pytest.mark.asyncio
    async def test_get_board_owner_info_not_found(self, db_session):
        """Test pobierania właściciela nieistniejącej tablicy"""
        service = BoardService(db_session)
        
        with pytest.raises(HTTPException) as exc_info:
            await service.get_board_owner_info(99999)
        
        assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_check_board_access_as_owner(db_session, test_user, test_board):
    """Test sprawdzania dostępu jako właściciel"""
    service = BoardService(db_session)
    
    has_access = service._check_board_access(test_board, test_user.id)
    
    assert has_access == True


@pytest.mark.asyncio
async def test_check_board_access_as_member(db_session, test_user2, test_board):
    """Test sprawdzania dostępu jako członek"""
    service = BoardService(db_session)
    
    # Dodaj test_user2 jako członka
    board_user = BoardUsers(
        board_id=test_board.id,
        user_id=test_user2.id,
        is_favourite=False,
        is_online=False
    )
    db_session.add(board_user)
    db_session.commit()
    
    has_access = service._check_board_access(test_board, test_user2.id)
    
    assert has_access == True


@pytest.mark.asyncio
async def test_check_board_access_no_access(db_session, test_user2, test_board):
    """Test sprawdzania dostępu bez uprawnień"""
    service = BoardService(db_session)
    
    has_access = service._check_board_access(test_board, test_user2.id)
    
    assert has_access == False