"""
Testy dla BoardService - Zaktualizowana wersja
Zgodna z nową strukturą service.py, schemas.py, routes.py
"""
import pytest
from datetime import datetime
from fastapi import HTTPException

from dashboard.boards.service import BoardService
from dashboard.boards.schemas import (
    CreateBoard, UpdateBoard, ToggleFavourite,
    BoardResponse, BoardListResponse, ToggleFavouriteResponse,
    OnlineUserInfo, BoardOwnerInfo, LastModifiedByInfo, LastOpenedInfo
)
from core.models import Board, BoardUsers, User


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
        assert result.workspace_id == test_workspace.id
        assert result.owner_id == test_user.id
        assert result.owner_username == test_user.username
        assert result.created_by == test_user.username
        assert result.last_modified_by == test_user.username
        assert result.is_favourite == False
        assert result.last_opened is not None
        
        # Sprawdź czy tablica została dodana do bazy
        board = db_session.query(Board).filter(Board.name == "New Test Board").first()
        assert board is not None
        assert board.created_by == test_user.id
        assert board.workspace_id == test_workspace.id
    
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
    
    @pytest.mark.asyncio
    async def test_create_board_sets_timestamps(self, db_session, test_user, test_workspace):
        """Test czy tworzenie tablicy ustawia timestamps"""
        service = BoardService(db_session)
        
        board_data = CreateBoard(
            name="Timestamp Test",
            workspace_id=test_workspace.id
        )
        
        result = await service.create_board(board_data, test_user.id)
        
        assert result.created_at is not None
        assert result.last_modified is not None
        assert result.last_opened is not None


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
        
        # Sprawdź w bazie
        db_session.refresh(test_board)
        assert test_board.name == "Updated Board Name"
        assert test_board.last_modified_by == test_user.id
    
    @pytest.mark.asyncio
    async def test_update_board_partial(self, db_session, test_user, test_board):
        """Test częściowej aktualizacji tablicy"""
        service = BoardService(db_session)
        
        original_icon = test_board.icon
        original_color = test_board.bg_color
        
        update_data = UpdateBoard(name="Partially Updated")
        
        result = await service.update_board(test_board.id, update_data, test_user.id)
        
        assert result.name == "Partially Updated"
        assert result.icon == original_icon
        assert result.bg_color == original_color
    
    @pytest.mark.asyncio
    async def test_update_board_not_found(self, db_session, test_user):
        """Test aktualizacji nieistniejącej tablicy"""
        service = BoardService(db_session)
        
        update_data = UpdateBoard(name="Non-existent")
        
        with pytest.raises(HTTPException) as exc_info:
            await service.update_board(99999, update_data, test_user.id)
        
        assert exc_info.value.status_code == 404
        assert "nie znaleziona" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_update_board_no_permission(self, db_session, test_user2, test_board):
        """Test aktualizacji tablicy bez uprawnień"""
        service = BoardService(db_session)
        
        update_data = UpdateBoard(name="Unauthorized Update")
        
        with pytest.raises(HTTPException) as exc_info:
            await service.update_board(test_board.id, update_data, test_user2.id)
        
        assert exc_info.value.status_code == 403
        assert "Brak uprawnień" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_update_board_updates_last_modified(self, db_session, test_user, test_board):
        """Test czy update aktualizuje last_modified"""
        service = BoardService(db_session)
        
        original_modified = test_board.last_modified
        
        update_data = UpdateBoard(name="Modified")
        result = await service.update_board(test_board.id, update_data, test_user.id)
        
        assert result.last_modified > original_modified
        
        db_session.refresh(test_board)
        assert test_board.last_modified > original_modified


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
        assert "nie znaleziona" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_delete_board_cascades_board_users(self, db_session, test_user, test_user2, test_board):
        """Test czy usunięcie tablicy usuwa powiązane BoardUsers"""
        # Dodaj drugiego użytkownika do tablicy
        board_user2 = BoardUsers(
            board_id=test_board.id,
            user_id=test_user2.id,
            is_favourite=False,
            is_online=False
        )
        db_session.add(board_user2)
        db_session.commit()
        
        # Sprawdź że są 2 użytkowników
        count = db_session.query(BoardUsers).filter(
            BoardUsers.board_id == test_board.id
        ).count()
        assert count == 2
        
        # Usuń tablicę
        service = BoardService(db_session)
        await service.delete_board(test_board.id, test_user.id)
        
        # Sprawdź czy BoardUsers zostały usunięte (cascade)
        count = db_session.query(BoardUsers).filter(
            BoardUsers.board_id == test_board.id
        ).count()
        assert count == 0


class TestBoardServiceToggleFavourite:
    """Testy toggleowania ulubionych"""
    
    @pytest.mark.asyncio
    async def test_toggle_favourite_to_true(self, db_session, test_user, test_board):
        """Test ustawienia tablicy jako ulubionej"""
        service = BoardService(db_session)
        
        toggle_data = ToggleFavourite(is_favourite=True)
        
        result = await service.toggle_favourite(test_board.id, toggle_data, test_user.id)
        
        assert isinstance(result, ToggleFavouriteResponse)
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
        
        # Sprawdź w bazie
        db_session.refresh(board_user)
        assert board_user.is_favourite == False
    
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
        assert board_user.is_favourite == True
        assert board_user.is_online == False
        assert board_user.last_opened is None
    
    @pytest.mark.asyncio
    async def test_toggle_favourite_nonexistent_board(self, db_session, test_user):
        """Test toggleowania dla nieistniejącej tablicy"""
        service = BoardService(db_session)
        
        toggle_data = ToggleFavourite(is_favourite=True)
        
        with pytest.raises(HTTPException) as exc_info:
            await service.toggle_favourite(99999, toggle_data, test_user.id)
        
        assert exc_info.value.status_code == 404


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
        
        # Sprawdź czy każda tablica ma wszystkie wymagane pola
        for board in result.boards:
            assert board.id is not None
            assert board.name is not None
            assert board.owner_username is not None
            assert board.created_by is not None
    
    @pytest.mark.asyncio
    async def test_list_boards_pagination(self, db_session, test_user, multiple_boards, test_workspace):
        """Test paginacji listy tablic"""
        service = BoardService(db_session)
        
        # Pierwsza strona
        page1 = await service.list_boards(test_workspace.id, test_user.id, limit=5, offset=0)
        assert len(page1.boards) == 5
        assert page1.offset == 0
        
        # Druga strona
        page2 = await service.list_boards(test_workspace.id, test_user.id, limit=5, offset=5)
        assert len(page2.boards) == 5
        assert page2.offset == 5
        
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
    
    @pytest.mark.asyncio
    async def test_list_boards_includes_timestamps(self, db_session, test_user, multiple_boards, test_workspace):
        """Test czy lista zawiera timestamps"""
        service = BoardService(db_session)
        
        result = await service.list_boards(test_workspace.id, test_user.id, limit=5, offset=0)
        
        for board in result.boards:
            assert board.created_at is not None
            assert board.last_modified is not None


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
        assert all(isinstance(user, OnlineUserInfo) for user in result)
        assert any(user.user_id == test_user.id for user in result)
        assert any(user.user_id == test_user2.id for user in result)
    
    @pytest.mark.asyncio
    async def test_get_online_users_pagination(self, db_session, test_board):
        """Test paginacji użytkowników online"""
        service = BoardService(db_session)
        
        result = await service.get_online_users(test_board.id, limit=1, offset=0)
        
        assert len(result) <= 1
    
    @pytest.mark.asyncio
    async def test_get_online_users_only_online(self, db_session, test_user, test_user2, test_board):
        """Test że zwraca tylko użytkowników online"""
        service = BoardService(db_session)
        
        # Dodaj użytkownika offline
        board_user2 = BoardUsers(
            board_id=test_board.id,
            user_id=test_user2.id,
            is_favourite=False,
            is_online=False,  # Offline
            last_opened=datetime.utcnow()
        )
        db_session.add(board_user2)
        db_session.commit()
        
        result = await service.get_online_users(test_board.id, limit=50, offset=0)
        
        # Powinien być tylko test_user (online z fixture)
        assert len(result) == 1
        assert result[0].user_id == test_user.id


class TestBoardServiceOwnerInfo:
    """Testy pobierania informacji o właścicielu"""
    
    @pytest.mark.asyncio
    async def test_get_board_owner_info(self, db_session, test_user, test_board):
        """Test pobierania informacji o właścicielu"""
        service = BoardService(db_session)
        
        result = await service.get_board_owner_info(test_board.id)
        
        assert isinstance(result, BoardOwnerInfo)
        assert result.user_id == test_user.id
        assert result.username == test_user.username
    
    @pytest.mark.asyncio
    async def test_get_board_owner_info_not_found(self, db_session):
        """Test pobierania właściciela nieistniejącej tablicy"""
        service = BoardService(db_session)
        
        with pytest.raises(HTTPException) as exc_info:
            await service.get_board_owner_info(99999)
        
        assert exc_info.value.status_code == 404
        assert "nie znaleziona" in str(exc_info.value.detail)


class TestBoardServiceLastModifier:
    """Testy pobierania informacji o ostatnim modyfikatorze"""
    
    @pytest.mark.asyncio
    async def test_get_last_modifier_info(self, db_session, test_user, test_board):
        """Test pobierania informacji o ostatnim modyfikatorze"""
        service = BoardService(db_session)
        
        result = await service.get_last_modifier_info(test_board.id)
        
        assert isinstance(result, LastModifiedByInfo)
        assert result.user_id == test_user.id
        assert result.username == test_user.username
    
    @pytest.mark.asyncio
    async def test_get_last_modifier_when_null(self, db_session, test_user, test_workspace):
        """Test pobierania modyfikatora gdy last_modified_by jest NULL"""
        # Utwórz tablicę bez last_modified_by
        board = Board(
            name="No Modifier Board",
            workspace_id=test_workspace.id,
            created_by=test_user.id,
            created_at=datetime.utcnow(),
            last_modified=datetime.utcnow(),
            last_modified_by=None  # NULL
        )
        db_session.add(board)
        db_session.commit()
        
        service = BoardService(db_session)
        result = await service.get_last_modifier_info(board.id)
        
        # Powinien zwrócić właściciela
        assert result.user_id == test_user.id
    
    @pytest.mark.asyncio
    async def test_get_last_modifier_not_found(self, db_session):
        """Test dla nieistniejącej tablicy"""
        service = BoardService(db_session)
        
        with pytest.raises(HTTPException) as exc_info:
            await service.get_last_modifier_info(99999)
        
        assert exc_info.value.status_code == 404


class TestBoardServiceLastOpened:
    """Testy pobierania informacji o ostatnim otwarciu"""
    
    @pytest.mark.asyncio
    async def test_get_last_opened_info(self, db_session, test_user, test_board):
        """Test pobierania informacji o ostatnim otwarciu"""
        service = BoardService(db_session)
        
        result = await service.get_last_opened_info(test_board.id, test_user.id)
        
        assert isinstance(result, LastOpenedInfo)
        assert result.user_id == test_user.id
        assert result.username == test_user.username
        assert result.last_opened is not None
    
    @pytest.mark.asyncio
    async def test_get_last_opened_no_relation(self, db_session, test_user2, test_board):
        """Test gdy użytkownik nie ma relacji z tablicą"""
        service = BoardService(db_session)
        
        with pytest.raises(HTTPException) as exc_info:
            await service.get_last_opened_info(test_board.id, test_user2.id)
        
        assert exc_info.value.status_code == 404
        assert "nie znaleziona" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_get_last_opened_when_null(self, db_session, test_user, test_board):
        """Test gdy last_opened jest NULL"""
        # Ustaw last_opened na NULL
        board_user = db_session.query(BoardUsers).filter(
            BoardUsers.board_id == test_board.id,
            BoardUsers.user_id == test_user.id
        ).first()
        board_user.last_opened = None
        db_session.commit()
        
        service = BoardService(db_session)
        
        with pytest.raises(HTTPException) as exc_info:
            await service.get_last_opened_info(test_board.id, test_user.id)
        
        assert exc_info.value.status_code == 404
        assert "Brak informacji" in str(exc_info.value.detail)


class TestBoardServiceAccessControl:
    """Testy kontroli dostępu"""
    
    @pytest.mark.asyncio
    async def test_check_board_access_as_owner(self, db_session, test_user, test_board):
        """Test sprawdzania dostępu jako właściciel"""
        service = BoardService(db_session)
        
        has_access = service._check_board_access(test_board, test_user.id)
        
        assert has_access == True
    
    @pytest.mark.asyncio
    async def test_check_board_access_as_member(self, db_session, test_user2, test_board):
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
    async def test_check_board_access_no_access(self, db_session, test_user2, test_board):
        """Test sprawdzania dostępu bez uprawnień"""
        service = BoardService(db_session)
        
        has_access = service._check_board_access(test_board, test_user2.id)
        
        assert has_access == False


class TestBoardServiceIntegration:
    """Testy integracyjne"""
    
    @pytest.mark.asyncio
    async def test_full_board_lifecycle(self, db_session, test_user, test_workspace):
        """Test pełnego cyklu życia tablicy"""
        service = BoardService(db_session)
        
        # 1. Create
        board_data = CreateBoard(
            name="Lifecycle Board",
            icon="TestIcon",
            bg_color="bg-blue-500",
            workspace_id=test_workspace.id
        )
        created = await service.create_board(board_data, test_user.id)
        assert created.name == "Lifecycle Board"
        
        # 2. Update
        update_data = UpdateBoard(name="Updated Lifecycle")
        updated = await service.update_board(created.id, update_data, test_user.id)
        assert updated.name == "Updated Lifecycle"
        
        # 3. Toggle favourite
        toggle_data = ToggleFavourite(is_favourite=True)
        toggled = await service.toggle_favourite(created.id, toggle_data, test_user.id)
        assert toggled.is_favourite == True
        
        # 4. Get owner info
        owner_info = await service.get_board_owner_info(created.id)
        assert owner_info.user_id == test_user.id
        
        # 5. Delete
        deleted = await service.delete_board(created.id, test_user.id)
        assert deleted["success"] == True
        
        # 6. Verify deleted
        with pytest.raises(HTTPException):
            await service.get_board_owner_info(created.id)